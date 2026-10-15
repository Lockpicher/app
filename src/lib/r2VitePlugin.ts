import { IncomingMessage, ServerResponse } from 'http';
import { 
  isR2Configured, 
  createPresignedUploadUrl, 
  createPresignedDownloadUrl, 
  deleteR2Object, 
  headR2Object,
  uploadBufferToR2,
  getR2Client
} from './r2Server';

async function parseJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: any[] = [];
    req.on('data', (chunk: any) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const str = Buffer.concat(chunks).toString('utf-8');
        resolve(str ? JSON.parse(str) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, data: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export function r2Middleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (!pathname.startsWith('/api/r2')) {
    return next();
  }

  // 1. Status endpoint
  if (pathname === '/api/r2/status' && req.method === 'GET') {
    const configured = isR2Configured();
    let bucket = '';
    let publicUrl = '';
    if (configured) {
      try {
        const conf = getR2Client();
        bucket = conf.bucket;
        publicUrl = conf.publicUrl || '';
      } catch {}
    }
    return sendJson(res, 200, {
      configured,
      bucket,
      hasPublicUrl: Boolean(publicUrl),
      publicUrl: publicUrl ? publicUrl.replace(/\/$/, '') : null
    });
  }

  // 2. Presigned upload URL
  if (pathname === '/api/r2/presign-upload' && req.method === 'POST') {
    if (!isR2Configured()) {
      return sendJson(res, 400, { 
        error: 'Cloudflare R2 no está configurado en las variables de entorno del servidor (R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY).' 
      });
    }

    parseJsonBody(req)
      .then(async (body) => {
        const { key, contentType, folder, originalName } = body;
        if (!originalName) {
          return sendJson(res, 400, { error: 'originalName es requerido' });
        }

        // Generate safe stable R2 key: uploads/${folder || 'general'}/${timestamp}_${sanitized}
        const cleanName = (originalName as string).replace(/[^a-zA-Z0-9._-]/g, '_');
        const r2Key = key || `uploads/${folder || 'general'}/${Date.now()}_${cleanName}`;
        const mime = contentType || 'application/octet-stream';

        const { uploadUrl } = await createPresignedUploadUrl(r2Key, mime, 900);
        
        let downloadUrl = '';
        const { publicUrl } = getR2Client();
        if (publicUrl) {
          downloadUrl = `${publicUrl.replace(/\/$/, '')}/${r2Key}`;
        } else {
          // If private, create initial presigned view URL
          downloadUrl = await createPresignedDownloadUrl(r2Key, 86400);
        }

        return sendJson(res, 200, {
          uploadUrl,
          r2Key,
          downloadUrl,
          cleanName
        });
      })
      .catch((err) => {
        return sendJson(res, 500, { error: err.message || 'Error generando URL de subida' });
      });
    return;
  }

  // 3. Presigned view/download URL
  if (pathname === '/api/r2/presign-download' && req.method === 'POST') {
    if (!isR2Configured()) {
      return sendJson(res, 400, { error: 'Cloudflare R2 no configurado' });
    }

    parseJsonBody(req)
      .then(async (body) => {
        const { key, disposition, filename } = body;
        if (!key) {
          return sendJson(res, 400, { error: 'key es requerido' });
        }

        let contentDisp: string | undefined = undefined;
        if (disposition === 'attachment') {
          const dlName = filename ? encodeURIComponent(filename) : 'download';
          contentDisp = `attachment; filename="${dlName}"`;
        }

        const url = await createPresignedDownloadUrl(key, 3600, contentDisp);
        return sendJson(res, 200, { url });
      })
      .catch((err) => {
        return sendJson(res, 500, { error: err.message || 'Error generando URL de descarga' });
      });
    return;
  }

  // 4. Delete object in R2
  if (pathname === '/api/r2/delete' && req.method === 'POST') {
    if (!isR2Configured()) {
      return sendJson(res, 400, { error: 'Cloudflare R2 no configurado' });
    }

    parseJsonBody(req)
      .then(async (body) => {
        const { key } = body;
        if (!key) return sendJson(res, 400, { error: 'key es requerido' });

        await deleteR2Object(key);
        return sendJson(res, 200, { success: true });
      })
      .catch((err) => {
        return sendJson(res, 500, { error: err.message || 'Error eliminando objeto de R2' });
      });
    return;
  }

  // 5. Proxy download / Range stream for audio/video (HTTP Range support)
  if (pathname.startsWith('/api/r2/stream') && req.method === 'GET') {
    const key = url.searchParams.get('key');
    if (!key) {
      return sendJson(res, 400, { error: 'key param es requerido' });
    }

    if (!isR2Configured()) {
      return sendJson(res, 400, { error: 'Cloudflare R2 no configurado' });
    }

    // Redirect to presigned URL or fetch stream
    createPresignedDownloadUrl(key, 3600)
      .then((signedUrl: string) => {
        res.writeHead(307, { Location: signedUrl });
        res.end();
      })
      .catch((err: any) => {
        sendJson(res, 500, { error: err.message });
      });
    return;
  }

  // 6. Run migration endpoint
  if (pathname === '/api/r2/migrate' && req.method === 'POST') {
    parseJsonBody(req)
      .then(async (body) => {
        const dryRun = Boolean(body?.dryRun);
        const { runStorageMigration } = await import('../../scratch/migrate_to_r2');
        const result = await runStorageMigration(dryRun);
        return sendJson(res, 200, result);
      })
      .catch((err) => {
        return sendJson(res, 500, { error: err.message || 'Error en migración' });
      });
    return;
  }

  // Fallback 404
  sendJson(res, 404, { error: 'Endpoint R2 no encontrado' });
}
