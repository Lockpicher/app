import { IncomingMessage, ServerResponse } from 'http';
import { 
  isR2Configured, 
  createPresignedUploadUrl, 
  createPresignedDownloadUrl, 
  deleteR2Object, 
  uploadBufferToR2,
  getR2Client,
  testR2Connection,
  getR2ObjectStream
} from './r2Server';
import { Readable } from 'stream';
import {
  sendJson,
  readBodyWithLimit,
  parseJsonSafe,
  authenticateRequest
} from './apiGuard.mjs';

export async function r2Middleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (!pathname.startsWith('/api/r2')) {
    return next();
  }

  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, Authorization');
    res.end();
    return;
  }

  // 1.0 Sesión
  if (pathname === '/api/r2/session') {
    if (req.method === 'POST') {
      const { buffer, tooLarge } = await readBodyWithLimit(req, 16 * 1024, res);
      if (tooLarge) return;
      const body = parseJsonSafe(buffer);
      if (!body || !body.token || typeof body.token !== 'string') {
        return sendJson(res, 400, { error: 'token es requerido' });
      }

      const auth = await authenticateRequest(req, { token: body.token });
      if (!auth.ok) {
        return sendJson(res, auth.status, { error: auth.error });
      }

      const isSecure = (req.socket as any)?.encrypted === true || req.headers['x-forwarded-proto'] === 'https';
      let cookieStr = `sb_session=${body.token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=43200`;
      if (isSecure) cookieStr += '; Secure';
      res.setHeader('Set-Cookie', cookieStr);
      return sendJson(res, 200, {
        ok: true,
        user: {
          id: auth.user.id,
          email: auth.user.email
        }
      });
    }

    if (req.method === 'DELETE') {
      const isSecure = (req.socket as any)?.encrypted === true || req.headers['x-forwarded-proto'] === 'https';
      let cookieStr = 'sb_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0';
      if (isSecure) cookieStr += '; Secure';
      res.setHeader('Set-Cookie', cookieStr);
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  // Todos los demás endpoints /api/r2/* requieren autenticación
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return sendJson(res, auth.status, { error: auth.error });
  }

  // 1.1 Status endpoint
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

  // 1.2 Test connection endpoint (Límite 1 MB)
  if (pathname === '/api/r2/test-connection' && (req.method === 'GET' || req.method === 'POST')) {
    if (req.method === 'POST') {
      const { tooLarge } = await readBodyWithLimit(req, 1024 * 1024, res);
      if (tooLarge) return;
    }

    try {
      const testRes = await testR2Connection();
      return sendJson(res, 200, testRes);
    } catch (err: any) {
      return sendJson(res, 500, {
        connected: false,
        error: err.message || 'Error probando conexión a R2'
      });
    }
  }

  // 1.3 Presigned upload URL (Límite 1 MB)
  if (pathname === '/api/r2/presign-upload' && req.method === 'POST') {
    if (!isR2Configured()) {
      return sendJson(res, 400, { 
        error: 'Cloudflare R2 no está configurado en las variables de entorno del servidor (R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY).' 
      });
    }

    const { buffer, tooLarge } = await readBodyWithLimit(req, 1024 * 1024, res);
    if (tooLarge) return;
    const body = parseJsonSafe(buffer);
    if (!body) return sendJson(res, 400, { error: 'JSON inválido' });

    try {
      const { key, contentType, folder, originalName } = body;
      if (!originalName) {
        return sendJson(res, 400, { error: 'originalName es requerido' });
      }

      const cleanName = (originalName as string).replace(/[^a-zA-Z0-9._-]/g, '_');
      const r2Key = key || `uploads/${folder || 'general'}/${Date.now()}_${cleanName}`;
      const mime = contentType || 'application/octet-stream';

      const { uploadUrl } = await createPresignedUploadUrl(r2Key, mime, 900);
      
      let downloadUrl = '';
      const { publicUrl } = getR2Client();
      if (publicUrl) {
        downloadUrl = `${publicUrl.replace(/\/$/, '')}/${r2Key}`;
      } else {
        downloadUrl = `/api/r2/stream?key=${encodeURIComponent(r2Key)}`;
      }

      return sendJson(res, 200, {
        uploadUrl,
        r2Key,
        downloadUrl,
        cleanName
      });
    } catch (err: any) {
      return sendJson(res, 500, { error: err.message || 'Error generando URL de subida' });
    }
  }

  // 1.4 Presigned view/download URL (Límite 1 MB)
  if (pathname === '/api/r2/presign-download' && req.method === 'POST') {
    if (!isR2Configured()) {
      return sendJson(res, 400, { error: 'Cloudflare R2 no configurado' });
    }

    const { buffer, tooLarge } = await readBodyWithLimit(req, 1024 * 1024, res);
    if (tooLarge) return;
    const body = parseJsonSafe(buffer);
    if (!body) return sendJson(res, 400, { error: 'JSON inválido' });

    try {
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
    } catch (err: any) {
      return sendJson(res, 500, { error: err.message || 'Error generando URL de descarga' });
    }
  }

  // 1.5 Delete object in R2 (Límite 1 MB)
  if (pathname === '/api/r2/delete') {
    if (req.method !== 'POST') {
      return sendJson(res, 405, { error: 'Method Not Allowed' });
    }
    if (!isR2Configured()) {
      return sendJson(res, 400, { error: 'Cloudflare R2 no configurado' });
    }

    const { buffer, tooLarge } = await readBodyWithLimit(req, 1024 * 1024, res);
    if (tooLarge) return;
    const body = parseJsonSafe(buffer);
    if (!body) return sendJson(res, 400, { error: 'JSON inválido' });

    try {
      const { key } = body;
      if (!key) return sendJson(res, 400, { error: 'key es requerido' });

      await deleteR2Object(key);
      return sendJson(res, 200, { success: true });
    } catch (err: any) {
      return sendJson(res, 500, { error: err.message || 'Error eliminando objeto de R2' });
    }
  }

  // 1.6 Proxy download / Range stream for images/audio/video (Direct Stream & HTTP Range support)
  // DETALLE CRÍTICO: La autenticación ya se comprobó arriba antes de tocar R2
  if (pathname.startsWith('/api/r2/stream') && req.method === 'GET') {
    const key = url.searchParams.get('key');
    if (!key) {
      return sendJson(res, 400, { error: 'key param es requerido' });
    }

    if (!isR2Configured()) {
      return sendJson(res, 400, { error: 'Cloudflare R2 no configurado' });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');

    const rangeHeader = req.headers['range'];

    try {
      const s3Res = await getR2ObjectStream(key, rangeHeader);
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
        const nodeStream = Readable.fromWeb((s3Res.Body as any).transformToWebStream());
        nodeStream.pipe(res);
      } else {
        const signedUrl = await createPresignedDownloadUrl(key, 86400);
        res.writeHead(302, { Location: signedUrl });
        res.end();
      }
    } catch (err: any) {
      try {
        const signedUrl = await createPresignedDownloadUrl(key, 86400);
        res.writeHead(302, { Location: signedUrl });
        res.end();
      } catch (signErr: any) {
        return sendJson(res, 500, { error: err.message || signErr.message });
      }
    }
    return;
  }

  // 1.7 Run migration endpoint (Límite 1 MB)
  if (pathname === '/api/r2/migrate' && req.method === 'POST') {
    const { buffer, tooLarge } = await readBodyWithLimit(req, 1024 * 1024, res);
    if (tooLarge) return;
    const body = parseJsonSafe(buffer);

    try {
      const dryRun = Boolean(body?.dryRun);
      const { runStorageMigration } = await import('../../scratch/migrate_to_r2');
      const result = await runStorageMigration(dryRun);
      return sendJson(res, 200, result);
    } catch (err: any) {
      return sendJson(res, 500, { error: err.message || 'Error en migración' });
    }
  }

  // 1.8 Direct server proxy upload (Límite 200 MB)
  if (pathname === '/api/r2/upload-proxy' && req.method === 'POST') {
    if (!isR2Configured()) {
      return sendJson(res, 400, { error: 'Cloudflare R2 no configurado' });
    }

    const { buffer: fullBuffer, tooLarge } = await readBodyWithLimit(req, 200 * 1024 * 1024, res);
    if (tooLarge) return;

    try {
      const folder = url.searchParams.get('folder') || 'uploads';
      const originalName = url.searchParams.get('filename') || `file_${Date.now()}`;
      const contentType = req.headers['content-type'] || 'application/octet-stream';

      const cleanName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const r2Key = `uploads/${folder}/${Date.now()}_${cleanName}`;

      const uploadRes = await uploadBufferToR2(r2Key, fullBuffer!, contentType);

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
        size: fullBuffer!.length,
        mime: contentType,
        etag: uploadRes.etag
      });
    } catch (err: any) {
      return sendJson(res, 500, { error: err.message || 'Error en proxy de subida a R2' });
    }
  }

  // Fallback 404
  sendJson(res, 404, { error: 'Endpoint R2 no encontrado' });
}
