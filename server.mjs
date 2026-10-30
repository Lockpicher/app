import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, 'dist');
const PORT = process.env.PORT || 3000;

// Load .env variables in local or container environments
function loadEnvFiles() {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env.production')
  ];

  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf-8');
        for (const line of content.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (key && !process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      } catch (e) {
        console.warn('Error reading env file:', envPath, e);
      }
    }
  }
}

loadEnvFiles();

// Initialize S3/R2 Client
let r2Client = null;

function getR2Client() {
  loadEnvFiles();
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME || 'app';
  const publicUrl = process.env.R2_PUBLIC_URL || '';
  const endpoint = process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    const missing = [
      !endpoint ? 'R2_ENDPOINT/R2_ACCOUNT_ID' : null,
      !accessKeyId ? 'R2_ACCESS_KEY_ID' : null,
      !secretAccessKey ? 'R2_SECRET_ACCESS_KEY' : null
    ].filter(Boolean).join(', ');
    throw new Error(`Configuración de Cloudflare R2 incompleta. Faltan variables: ${missing}`);
  }

  if (!r2Client) {
    r2Client = new S3Client({
      region: process.env.R2_REGION || 'auto',
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    });
  }

  return { client: r2Client, bucket, publicUrl };
}

function isR2Configured() {
  loadEnvFiles();
  return Boolean(
    (process.env.R2_ENDPOINT || process.env.R2_ACCOUNT_ID) &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY
  );
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, Authorization');
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
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

const MIME_MAP = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm'
};

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, Authorization');
    res.end();
    return;
  }

  const host = req.headers.host || 'localhost';
  const url = new URL(req.url || '/', `http://${host}`);
  const pathname = url.pathname;

  // ==========================================
  // 1. R2 API ENDPOINTS
  // ==========================================

  // 1.1 Status
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

  // 1.2 Test connection
  if (pathname === '/api/r2/test-connection' && (req.method === 'GET' || req.method === 'POST')) {
    try {
      if (!isR2Configured()) {
        const missing = [
          (!process.env.R2_ENDPOINT && !process.env.R2_ACCOUNT_ID) ? 'R2_ENDPOINT o R2_ACCOUNT_ID' : null,
          !process.env.R2_ACCESS_KEY_ID ? 'R2_ACCESS_KEY_ID' : null,
          !process.env.R2_SECRET_ACCESS_KEY ? 'R2_SECRET_ACCESS_KEY' : null
        ].filter(Boolean);
        return sendJson(res, 200, {
          connected: false,
          error: `Variables no encontradas (${missing.join(', ')})`
        });
      }

      const { client, bucket } = getR2Client();
      const endpoint = process.env.R2_ENDPOINT || (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : '');

      try {
        await client.send(new HeadObjectCommand({
          Bucket: bucket,
          Key: '__antigravity_ping_test__'
        }));
      } catch (headErr) {
        if (headErr.name === 'NotFound' || headErr.$metadata?.httpStatusCode === 404) {
          return sendJson(res, 200, { connected: true, bucket, endpoint });
        }
        throw headErr;
      }

      return sendJson(res, 200, { connected: true, bucket, endpoint });
    } catch (err) {
      return sendJson(res, 500, { connected: false, error: err.message || 'Error de conexión con R2' });
    }
  }

  // 1.3 Presigned upload URL
  if (pathname === '/api/r2/presign-upload' && req.method === 'POST') {
    if (!isR2Configured()) {
      return sendJson(res, 400, { 
        error: 'Cloudflare R2 no está configurado en las variables de entorno del servidor (R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY).' 
      });
    }

    try {
      const body = await parseJsonBody(req);
      const { key, contentType, folder, originalName } = body;
      if (!originalName) {
        return sendJson(res, 400, { error: 'originalName es requerido' });
      }

      const cleanName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const r2Key = key || `uploads/${folder || 'general'}/${Date.now()}_${cleanName}`;
      const mime = contentType || 'application/octet-stream';

      const { client, bucket, publicUrl } = getR2Client();
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: r2Key,
        ContentType: mime
      });

      const uploadUrl = await getSignedUrl(client, command, { expiresIn: 900 });
      let downloadUrl = '';
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
    } catch (err) {
      return sendJson(res, 500, { error: err.message || 'Error generando URL de subida' });
    }
  }

  // 1.4 Presigned view/download URL
  if (pathname === '/api/r2/presign-download' && req.method === 'POST') {
    if (!isR2Configured()) {
      return sendJson(res, 400, { error: 'Cloudflare R2 no configurado' });
    }

    try {
      const body = await parseJsonBody(req);
      const { key, disposition, filename } = body;
      if (!key) return sendJson(res, 400, { error: 'key es requerido' });

      let contentDisp = undefined;
      if (disposition === 'attachment') {
        const dlName = filename ? encodeURIComponent(filename) : 'download';
        contentDisp = `attachment; filename="${dlName}"`;
      }

      const { client, bucket } = getR2Client();
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ResponseContentDisposition: contentDisp
      });

      const url = await getSignedUrl(client, command, { expiresIn: 3600 });
      return sendJson(res, 200, { url });
    } catch (err) {
      return sendJson(res, 500, { error: err.message || 'Error generando URL de descarga' });
    }
  }

  // 1.5 Delete object in R2
  if (pathname === '/api/r2/delete' && req.method === 'POST') {
    if (!isR2Configured()) {
      return sendJson(res, 400, { error: 'Cloudflare R2 no configurado' });
    }

    try {
      const body = await parseJsonBody(req);
      const { key } = body;
      if (!key) return sendJson(res, 400, { error: 'key es requerido' });

      const { client, bucket } = getR2Client();
      await client.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: key
      }));
      return sendJson(res, 200, { success: true });
    } catch (err) {
      return sendJson(res, 500, { error: err.message || 'Error eliminando objeto de R2' });
    }
  }

  // 1.6 Proxy download / Range stream for images/audio/video
  if (pathname.startsWith('/api/r2/stream') && req.method === 'GET') {
    const key = url.searchParams.get('key');
    if (!key) return sendJson(res, 400, { error: 'key param es requerido' });
    if (!isR2Configured()) return sendJson(res, 400, { error: 'Cloudflare R2 no configurado' });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');

    const rangeHeader = req.headers['range'];

    try {
      const { client, bucket } = getR2Client();
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        Range: rangeHeader
      });
      const s3Res = await client.send(command);

      if (s3Res.ContentType) res.setHeader('Content-Type', s3Res.ContentType);
      if (s3Res.ContentRange) {
        res.setHeader('Content-Range', s3Res.ContentRange);
        if (s3Res.ContentLength !== undefined) res.setHeader('Content-Length', s3Res.ContentLength.toString());
        res.statusCode = 206;
      } else {
        if (s3Res.ContentLength !== undefined && !s3Res.ContentEncoding) {
          res.setHeader('Content-Length', s3Res.ContentLength.toString());
        }
        res.statusCode = 200;
      }

      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=86400');

      if (s3Res.Body instanceof Readable) {
        s3Res.Body.pipe(res);
      } else if (s3Res.Body && typeof s3Res.Body.transformToWebStream === 'function') {
        Readable.fromWeb(s3Res.Body.transformToWebStream()).pipe(res);
      } else {
        const signedUrl = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 86400 });
        res.writeHead(302, { Location: signedUrl });
        res.end();
      }
    } catch (err) {
      try {
        const { client, bucket } = getR2Client();
        const signedUrl = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 86400 });
        res.writeHead(302, { Location: signedUrl });
        res.end();
      } catch (signErr) {
        return sendJson(res, 500, { error: err.message || signErr.message });
      }
    }
    return;
  }

  // 1.7 Direct server proxy upload
  if (pathname === '/api/r2/upload-proxy' && req.method === 'POST') {
    if (!isR2Configured()) {
      return sendJson(res, 400, { error: 'Cloudflare R2 no configurado' });
    }

    const chunks = [];
    req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', async () => {
      try {
        const fullBuffer = Buffer.concat(chunks);
        const folder = url.searchParams.get('folder') || 'uploads';
        const originalName = url.searchParams.get('filename') || `file_${Date.now()}`;
        const contentType = req.headers['content-type'] || 'application/octet-stream';

        const cleanName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const r2Key = `uploads/${folder}/${Date.now()}_${cleanName}`;

        const { client, bucket, publicUrl } = getR2Client();
        const putCmd = new PutObjectCommand({
          Bucket: bucket,
          Key: r2Key,
          Body: fullBuffer,
          ContentType: contentType
        });

        const uploadRes = await client.send(putCmd);

        let downloadUrl = '';
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
          etag: uploadRes.ETag?.replace(/"/g, '')
        });
      } catch (err) {
        return sendJson(res, 500, { error: err.message || 'Error en proxy de subida a R2' });
      }
    });
    return;
  }

  // ==========================================
  // 2. ELEVENLABS SPEECH-TO-TEXT ENDPOINT
  // ==========================================
  if (pathname === '/api/transcribe' && req.method === 'POST') {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return sendJson(res, 400, {
        error: 'Clave ELEVENLABS_API_KEY no configurada en el servidor.'
      });
    }

    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', async () => {
      try {
        const bodyBuffer = Buffer.concat(chunks);
        let audioBuffer;
        let filename = 'audio.webm';
        let mimeType = 'audio/webm';
        let languageCode = 'es';

        const contentType = req.headers['content-type'] || '';
        if (contentType.includes('application/json')) {
          const json = JSON.parse(bodyBuffer.toString());
          if (!json.audio_url) {
            return sendJson(res, 400, { error: 'audio_url es requerido' });
          }
          let fetchTarget = json.audio_url;
          if (fetchTarget.startsWith('/')) {
            const host = req.headers.host || `localhost:${PORT}`;
            fetchTarget = `http://${host}${fetchTarget}`;
          }
          const audioFetch = await fetch(fetchTarget);
          if (!audioFetch.ok) throw new Error('No se pudo descargar el archivo de audio');
          audioBuffer = Buffer.from(await audioFetch.arrayBuffer());
          if (json.language_code) languageCode = json.language_code;
        } else {
          audioBuffer = bodyBuffer;
        }

        const formData = new FormData();
        const audioBlob = new Blob([audioBuffer], { type: mimeType });
        formData.append('file', audioBlob, filename);
        formData.append('model_id', 'scribe_v2');
        if (languageCode) formData.append('language_code', languageCode);

        const sttRes = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
          method: 'POST',
          headers: { 'xi-api-key': apiKey },
          body: formData
        });

        const sttData = await sttRes.json();
        if (!sttRes.ok) {
          return sendJson(res, sttRes.status, { error: sttData?.detail?.message || sttData?.message || 'Error en ElevenLabs API' });
        }

        return sendJson(res, 200, {
          text: sttData.text,
          language_code: sttData.language_code || languageCode,
          words: sttData.words
        });
      } catch (err) {
        return sendJson(res, 500, { error: err.message || 'Error procesando transcripción' });
      }
    });
    return;
  }

  // ==========================================
  // 3. AI ASSISTANT CONTEXTUAL ENDPOINTS
  // ==========================================
  if (pathname.startsWith('/api/ai/')) {
    loadEnvFiles();
    const preferredProvider = process.env.AI_PROVIDER;
    const mimoKey = process.env.MIMO_API_KEY || process.env.XIAOMI_MIMO_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const openRouterKey = process.env.OPENROUTER_API_KEY;

    if (pathname === '/api/ai/status' && req.method === 'GET') {
      if ((preferredProvider === 'xiaomi_mimo' || !geminiKey) && mimoKey) {
        return sendJson(res, 200, {
          configured: true,
          provider: 'xiaomi_mimo',
          model: process.env.MIMO_MODEL || 'mimo-v2.6-flash',
          availableModels: ['mimo-v2.6-flash', 'mimo-v2.6-pro', 'mimo-v2.5'],
          baseUrl: process.env.MIMO_BASE_URL || 'https://api.xiaomimimo.com/v1'
        });
      }
      if (geminiKey) {
        return sendJson(res, 200, {
          configured: true,
          provider: 'gemini',
          model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
          availableModels: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']
        });
      }
      if (openRouterKey) {
        return sendJson(res, 200, {
          configured: true,
          provider: 'openrouter',
          model: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash',
          availableModels: ['google/gemini-2.5-flash', 'google/gemini-2.0-flash-001', 'openai/gpt-4o-mini', 'anthropic/claude-3.5-haiku']
        });
      }
      if (mimoKey) {
        return sendJson(res, 200, {
          configured: true,
          provider: 'xiaomi_mimo',
          model: process.env.MIMO_MODEL || 'mimo-v2.6-flash',
          availableModels: ['mimo-v2.6-flash', 'mimo-v2.6-pro', 'mimo-v2.5'],
          baseUrl: process.env.MIMO_BASE_URL || 'https://api.xiaomimimo.com/v1'
        });
      }
      return sendJson(res, 200, {
        configured: false,
        provider: null,
        model: '',
        availableModels: [],
        missingKey: 'MIMO_API_KEY, GEMINI_API_KEY o OPENROUTER_API_KEY'
      });
    }

    if (pathname === '/api/ai/config' && req.method === 'POST') {
      parseJsonBody(req).then(async (body) => {
        try {
          const { provider, apiKey, model, baseUrl } = body;
          if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 5) {
            return sendJson(res, 400, { error: 'Clave de API no válida o vacía.' });
          }
          const keyTrimmed = apiKey.trim();
          if (provider === 'xiaomi_mimo') {
            process.env.MIMO_API_KEY = keyTrimmed;
            if (model) process.env.MIMO_MODEL = model;
            if (baseUrl) process.env.MIMO_BASE_URL = baseUrl;
            process.env.AI_PROVIDER = 'xiaomi_mimo';
          } else if (provider === 'gemini') {
            process.env.GEMINI_API_KEY = keyTrimmed;
            if (model) process.env.GEMINI_MODEL = model;
            process.env.AI_PROVIDER = 'gemini';
          } else {
            process.env.OPENROUTER_API_KEY = keyTrimmed;
            if (model) process.env.OPENROUTER_MODEL = model;
            process.env.AI_PROVIDER = 'openrouter';
          }
          return sendJson(res, 200, { success: true, provider, model });
        } catch (e) {
          return sendJson(res, 400, { error: e.message });
        }
      });
      return;
    }

    if (pathname === '/api/ai/chat' && req.method === 'POST') {
      const activeProvider = (process.env.AI_PROVIDER === 'xiaomi_mimo' && mimoKey) ? 'xiaomi_mimo' :
                             (mimoKey && !geminiKey && !openRouterKey) ? 'xiaomi_mimo' :
                             geminiKey ? 'gemini' :
                             openRouterKey ? 'openrouter' :
                             mimoKey ? 'xiaomi_mimo' : null;

      if (!activeProvider) {
        return sendJson(res, 400, {
          error: 'NO_API_KEY',
          message: 'El asistente de IA no está configurado en el servidor.'
        });
      }

      parseJsonBody(req).then(async (body) => {
        try {
          const { messages = [], mode = 'ask', context = null, relevantKnowledge = [], modelOverride = null } = body;
          let systemPrompt = `Eres el Asistente de Inteligencia Artificial contextual de "Segundo Cerebro" (app.kubbonet.com).
Tu propósito es ayudar al usuario a pensar mejor, sintetizar información, redactar con excelencia, organizar tareas y conectar conocimientos.
Responde siempre en español, con un tono profesional, claro, inspirador y empático. Usa Markdown bien estructurado.`;

          if (context && context.type && context.type !== 'general') {
            systemPrompt += `\n\n--- CONTEXTO ACTUAL DE LA PANTALLA ---
Tipo: ${context.type.toUpperCase()}
${context.title ? `Título: "${context.title}"` : ''}
${context.selectedText ? `TEXTO SELECCIONADO:\n"""\n${context.selectedText}\n"""` : ''}
${context.content ? `CONTENIDO ACTUAL:\n"""\n${context.content.slice(0, 4000)}\n"""` : ''}`;
          }

          if (relevantKnowledge && relevantKnowledge.length > 0) {
            systemPrompt += `\n\n--- CONOCIMIENTO PERSONAL RECUPERADO ---`;
            relevantKnowledge.forEach((item, idx) => {
              systemPrompt += `\n[Fuente ${idx + 1}] (${item.type.toUpperCase()}) "${item.title}":\n${(item.contentSnippet || '').slice(0, 600)}`;
            });
          }

          if (mode === 'edit') {
            systemPrompt += `\n\n--- MODO EDITAR ACTIVO ---
Incluye al final de tu respuesta el bloque:
\`\`\`json:proposed_edit
{
  "action": "${context?.selectedText ? 'replace_selection' : 'replace_all'}",
  "replacementSnippet": "texto completo mejorado",
  "summary": "Resumen de mejoras"
}
\`\`\``;
          }

          let reply = '';
          if (activeProvider === 'xiaomi_mimo') {
            const mModel = modelOverride || process.env.MIMO_MODEL || 'mimo-v2.6-flash';
            const mBase = (process.env.MIMO_BASE_URL || 'https://api.xiaomimimo.com/v1').replace(/\/+$/, '');
            const mRes = await fetch(`${mBase}/chat/completions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${mimoKey}`
              },
              body: JSON.stringify({
                model: mModel,
                messages: [{ role: 'system', content: systemPrompt }, ...messages]
              })
            });
            const mData = await mRes.json();
            reply = mData?.choices?.[0]?.message?.content || '';
          } else if (activeProvider === 'gemini') {
            const cleanModel = (modelOverride || process.env.GEMINI_MODEL || 'gemini-2.5-flash').replace(/^google\//, '');
            const gUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${geminiKey}`;
            const contents = messages.map(m => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }]
            }));
            const gRes = await fetch(gUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemPrompt }] },
                contents: contents.length > 0 ? contents : [{ role: 'user', parts: [{ text: 'Hola' }] }]
              })
            });
            const gData = await gRes.json();
            reply = gData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          } else {
            const oModel = modelOverride || process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
            const oRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${openRouterKey}`
              },
              body: JSON.stringify({
                model: oModel,
                messages: [{ role: 'system', content: systemPrompt }, ...messages]
              })
            });
            const oData = await oRes.json();
            reply = oData?.choices?.[0]?.message?.content || '';
          }

          let proposedEdit = null;
          let toolAction = null;
          const editMatch = reply.match(/```json:proposed_edit[\s\S]*?```/i);
          if (editMatch) {
            try {
              proposedEdit = JSON.parse(editMatch[0].replace(/```json(:proposed_edit)?/i, '').replace(/```$/, '').trim());
              reply = reply.replace(editMatch[0], '').trim();
            } catch (e) {}
          }
          const toolMatch = reply.match(/```json:tool_action[\s\S]*?```/i);
          if (toolMatch) {
            try {
              toolAction = JSON.parse(toolMatch[0].replace(/```json(:tool_action)?/i, '').replace(/```$/, '').trim());
              reply = reply.replace(toolMatch[0], '').trim();
            } catch (e) {}
          }

          return sendJson(res, 200, {
            success: true,
            reply,
            proposedEdit,
            toolAction,
            references: relevantKnowledge.map(k => ({ id: k.id, type: k.type, title: k.title }))
          });
        } catch (err) {
          return sendJson(res, 500, { error: err.message });
        }
      });
      return;
    }
  }

  // ==========================================
  // 4. STATIC SPA ASSET SERVING
  // ==========================================
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  let safePath = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(DIST_DIR, safePath);

  // If directory, try index.html inside
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  // SPA Fallback: if file doesn't exist or is a route path, serve dist/index.html
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Antigravity application is building or dist/ not found.');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_MAP[ext] || 'application/octet-stream';
  const stat = fs.statSync(filePath);

  res.statusCode = 200;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', stat.size);

  // Cache static assets with hash for 1 year, index.html no-cache
  if (ext === '.html') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Antigravity Server] Running on http://0.0.0.0:${PORT}`);
  console.log(`[Cloudflare R2] Configured: ${isR2Configured()}`);
});
