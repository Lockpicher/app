import { IncomingMessage, ServerResponse } from 'http';
import { 
  isR2Configured, 
  createPresignedUploadUrl, 
  createPresignedDownloadUrl, 
  deleteR2Object, 
  headR2Object,
  uploadBufferToR2,
  getR2Client,
  testR2Connection,
  getR2ObjectStream
} from './r2Server';
import { Readable } from 'stream';

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

  // 1.1 Test connection endpoint
  if (pathname === '/api/r2/test-connection' && (req.method === 'GET' || req.method === 'POST')) {
    testR2Connection()
      .then((testRes) => {
        sendJson(res, 200, testRes);
      })
      .catch((err) => {
        sendJson(res, 500, {
          connected: false,
          error: err.message || 'Error probando conexión a R2'
        });
      });
    return;
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
          // Si no hay dominio público configurado, usar endpoint local de stream con soporte HTTP Range y streaming
          downloadUrl = `/api/r2/stream?key=${encodeURIComponent(r2Key)}`;
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

  // 5. Proxy download / Range stream for images/audio/video (Direct Stream & HTTP Range support)
  if (pathname.startsWith('/api/r2/stream') && req.method === 'GET') {
    const key = url.searchParams.get('key');
    if (!key) {
      return sendJson(res, 400, { error: 'key param es requerido' });
    }

    if (!isR2Configured()) {
      return sendJson(res, 400, { error: 'Cloudflare R2 no configurado' });
    }

    // Permitir CORS en peticiones de stream
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');

    const rangeHeader = req.headers['range'];

    getR2ObjectStream(key, rangeHeader)
      .then((s3Res) => {
        if (s3Res.ContentType) {
          res.setHeader('Content-Type', s3Res.ContentType);
        }
        if (s3Res.ContentRange) {
          res.setHeader('Content-Range', s3Res.ContentRange);
          if (s3Res.ContentLength !== undefined) {
            res.setHeader('Content-Length', s3Res.ContentLength.toString());
          }
          res.statusCode = 206; // Partial Content
        } else {
          if (s3Res.ContentLength !== undefined && !(s3Res as any).ContentEncoding) {
            res.setHeader('Content-Length', s3Res.ContentLength.toString());
          }
          res.statusCode = 200;
        }

        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=86400');

        if (s3Res.Body instanceof Readable) {
          s3Res.Body.pipe(res);
        } else if (s3Res.Body && typeof (s3Res.Body as any).transformToWebStream === 'function') {
          // Si es un web stream o similar
          const nodeStream = Readable.fromWeb((s3Res.Body as any).transformToWebStream());
          nodeStream.pipe(res);
        } else {
          // Fallback a URL presignada si el body no se puede convertir a stream
          createPresignedDownloadUrl(key, 86400).then(signedUrl => {
            res.writeHead(302, { Location: signedUrl });
            res.end();
          }).catch(err => sendJson(res, 500, { error: err.message }));
        }
      })
      .catch((err: any) => {
        // Si falla el stream directo, intentar redirección presignada
        createPresignedDownloadUrl(key, 86400)
          .then((signedUrl: string) => {
            res.writeHead(302, { Location: signedUrl });
            res.end();
          })
          .catch((signErr: any) => {
            sendJson(res, 500, { error: err.message || signErr.message });
          });
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

  // 7. Direct server proxy upload (fail-safe for restrictive browser CORS/network environments)
  if (pathname === '/api/r2/upload-proxy' && req.method === 'POST') {
    if (!isR2Configured()) {
      return sendJson(res, 400, { error: 'Cloudflare R2 no configurado' });
    }

    const chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', async () => {
      try {
        const fullBuffer = Buffer.concat(chunks);
        const folder = url.searchParams.get('folder') || 'uploads';
        const originalName = url.searchParams.get('filename') || `file_${Date.now()}`;
        const contentType = req.headers['content-type'] || 'application/octet-stream';

        const cleanName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const r2Key = `uploads/${folder}/${Date.now()}_${cleanName}`;

        const uploadRes = await uploadBufferToR2(r2Key, fullBuffer, contentType);

        let downloadUrl = '';
        const { publicUrl } = getR2Client();
        if (publicUrl) {
          downloadUrl = `${publicUrl.replace(/\/$/, '')}/${r2Key}`;
        } else {
          downloadUrl = `/api/r2/stream?key=${encodeURIComponent(r2Key)}`;
        }

        return sendJson(res, 200, {
          url: downloadUrl,
          r2Key,
          name: cleanName,
          size: fullBuffer.length,
          mime: contentType,
          etag: uploadRes.etag
        });
      } catch (err: any) {
        return sendJson(res, 500, { error: err.message || 'Error en proxy de subida a R2' });
      }
    });
    return;
  }

  // Fallback 404
  sendJson(res, 404, { error: 'Endpoint R2 no encontrado' });
}
