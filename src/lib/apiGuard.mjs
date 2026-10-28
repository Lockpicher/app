import crypto from 'crypto';

/**
 * Caché en memoria para validación de tokens contra InsForge backend
 * Estructura: Map<tokenHash, { result: object, expiresAt: number }>
 */
const authCache = new Map();

/**
 * Limpia entradas expiradas de la caché de autenticación
 */
function cleanAuthCache() {
  const now = Date.now();
  for (const [key, val] of authCache.entries()) {
    if (val.expiresAt <= now) {
      authCache.delete(key);
    }
  }
}

/**
 * Calcula el hash SHA-256 de un token
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Envía una respuesta JSON con cabeceras CORS compatibles con el servidor actual
 */
export function sendJson(res, status, data, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, Authorization');
  if (extraHeaders) {
    for (const [key, val] of Object.entries(extraHeaders)) {
      if (val !== undefined && val !== null) {
        res.setHeader(key, val);
      }
    }
  }
  res.end(JSON.stringify(data));
}

/**
 * Lee el cuerpo de una petición HTTP hasta un límite de bytes acumulados.
 * Si se supera maxBytes, responde 413, drena/aborta y resuelve { buffer: null, tooLarge: true }.
 */
/**
 * Envía el 413 sólo cuando el cliente ha terminado de enviar el cuerpo (o tras
 * un tiempo máximo). Si se responde antes, Node cierra el socket mientras el
 * cliente aún está subiendo y éste recibe ECONNRESET sin llegar a leer el 413.
 */
function respond413WhenDrained(req, res, resolve) {
  let settled = false;
  const payload = JSON.stringify({ error: 'PAYLOAD_TOO_LARGE' });
  const finish = () => {
    if (settled) return;
    settled = true;
    clearTimeout(guard);
    try {
      if (res && !res.headersSent && !res.writableEnded) {
        res.statusCode = 413;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Length', Buffer.byteLength(payload));
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, Authorization');
        res.end(payload);
      }
    } catch {
      // el socket ya no está disponible: no hay nada más que hacer
    }
    resolve({ buffer: null, tooLarge: true });
  };
  const guard = setTimeout(finish, 10000);
  req.on('end', finish);
  req.on('close', finish);
  req.on('error', finish);
  req.resume();
}

export function readBodyWithLimit(req, maxBytes, optionalRes = null) {
  return new Promise((resolve) => {
    const res = optionalRes || req.res;
    let totalBytes = 0;
    const chunks = [];
    let tooLarge = false;

    // Comprobación temprana por Content-Length si la cabecera está presente
    const headerLen = parseInt(req.headers?.['content-length'] || '0', 10);
    if (headerLen > maxBytes) {
      respond413WhenDrained(req, res, resolve);
      return;
    }

    if (req.complete || req.readableEnded) {
      resolve({ buffer: Buffer.concat(chunks), tooLarge: false });
      return;
    }

    function onData(chunk) {
      if (tooLarge) return;
      const chunkBuf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += chunkBuf.length;
      if (totalBytes > maxBytes) {
        tooLarge = true;
        req.removeListener('data', onData);
        req.removeListener('end', onEnd);
        req.removeListener('error', onError);
        respond413WhenDrained(req, res, resolve);
        return;
      }
      chunks.push(chunkBuf);
    }

    function onEnd() {
      if (tooLarge) return;
      resolve({ buffer: Buffer.concat(chunks), tooLarge: false });
    }

    function onError(err) {
      if (tooLarge) return;
      resolve({ buffer: null, tooLarge: false, error: err });
    }

    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
  });
}

/**
 * Parsea un buffer a objeto JSON de forma segura sin lanzar excepciones no controladas.
 */
export function parseJsonSafe(buffer, maxBytes = null) {
  if (buffer === null || buffer === undefined) return {};
  if (maxBytes !== null && maxBytes !== undefined) {
    const len = Buffer.isBuffer(buffer) ? buffer.length : Buffer.byteLength(String(buffer));
    if (len > maxBytes) return null;
  }
  const str = Buffer.isBuffer(buffer) ? buffer.toString('utf-8') : String(buffer);
  if (!str.trim()) return {};
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

/**
 * Obtiene la dirección IP del cliente (primer valor de x-forwarded-for o remoteAddress).
 */
export function getClientIp(req) {
  if (!req) return '127.0.0.1';
  const xForwardedFor = req.headers?.['x-forwarded-for'];
  if (xForwardedFor) {
    const first = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor.split(',')[0];
    if (first && first.trim()) {
      return first.trim();
    }
  }
  return req.socket?.remoteAddress || req.connection?.remoteAddress || '127.0.0.1';
}

/**
 * Crea un limitador de frecuencia en memoria basado en ventanas temporales e IP
 */
export function createRateLimiter({ windowMs, max }) {
  const hits = new Map();

  function limiter(ip) {
    const now = Date.now();
    for (const [key, entry] of hits.entries()) {
      if (entry.resetTime <= now) {
        hits.delete(key);
      }
    }

    const key = ip || 'unknown';
    let entry = hits.get(key);
    if (!entry || entry.resetTime <= now) {
      entry = { count: 1, resetTime: now + windowMs };
      hits.set(key, entry);
      return true;
    }

    if (entry.count < max) {
      entry.count++;
      return true;
    }

    return false;
  }

  limiter.getRetryAfter = function(ip) {
    const key = ip || 'unknown';
    const entry = hits.get(key);
    if (!entry) return Math.ceil(windowMs / 1000);
    const remainingMs = Math.max(0, entry.resetTime - Date.now());
    return Math.ceil(remainingMs / 1000) || 1;
  };

  limiter.retryAfter = limiter.getRetryAfter;

  limiter.reset = function() {
    hits.clear();
  };

  return limiter;
}

/**
 * Extrae el JWT de la cookie sb_session o de Authorization: Bearer, y lo valida contra InsForge.
 * Devuelve { ok: true, user } | { ok: false, status: number, error: string }
 */
export async function authenticateRequest(req, opts = {}) {
  let token = opts.token || null;
  if (!token && req) {
    // 1. Extraer de cookie sb_session
    const cookieHeader = req.headers?.cookie || req.headers?.Cookie || '';
    if (cookieHeader) {
      const match = cookieHeader.match(/(?:^|;\s*)sb_session=([^;]+)/);
      if (match) {
        token = decodeURIComponent(match[1].trim());
      }
    }

    // 2. Extraer de Authorization: Bearer
    if (!token) {
      const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
      if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
        token = authHeader.slice(7).trim();
      }
    }
  }

  if (!token) {
    return { ok: false, status: 401, error: 'UNAUTHORIZED' };
  }

  cleanAuthCache();
  const tokenHash = hashToken(token);
  const cached = authCache.get(tokenHash);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const baseUrl = opts.baseUrl || process.env.INSFORGE_BASE_URL || 'https://insforge.kora.ovh';
  const url = `${baseUrl.replace(/\/$/, '')}/api/auth/sessions/current`;

  let response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), opts.timeoutMs || 5000);
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err) {
    // InsForge no responde (error de red o timeout): fail-closed
    return { ok: false, status: 503, error: 'AUTH_BACKEND_UNAVAILABLE' };
  }

  if (response.ok) {
    try {
      const data = await response.json();
      const user = data?.user || data;
      const result = { ok: true, user };
      authCache.set(tokenHash, {
        expiresAt: Date.now() + 60 * 1000,
        result
      });
      return result;
    } catch {
      return { ok: false, status: 503, error: 'AUTH_BACKEND_UNAVAILABLE' };
    }
  }

  if (response.status === 401 || response.status === 403) {
    const result = { ok: false, status: 401, error: 'UNAUTHORIZED' };
    authCache.set(tokenHash, {
      expiresAt: Date.now() + 10 * 1000,
      result
    });
    return result;
  }

  return { ok: false, status: 503, error: 'AUTH_BACKEND_UNAVAILABLE' };
}
