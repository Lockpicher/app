const fs = require('fs');
const path = require('path');

const targetFile = path.resolve('server.mjs');
let code = fs.readFileSync(targetFile, 'utf8');

// 1. Add auditLogger imports and applySecurityHeaders
if (!code.includes("import { logSecurityEvent")) {
  code = code.replace(
    "import { isAllowedUrl } from './src/lib/webScraperServer.ts';",
    "import { isAllowedUrl } from './src/lib/webScraperServer.ts';\nimport { logSecurityEvent, AuditEventType, AuditSeverity } from './src/lib/auditLogger.mjs';\nimport { applySecurityHeaders, sendSafeError } from './src/lib/apiGuard.mjs';"
  );
}

// 2. Add rate limiters
const limitersBlock = `
// SOC 2 / ISO 27001 Rate Limiters
const authLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 10 }); // 10 intentos de auth por minuto por IP
const aiLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 30 }); // 30 consultas IA por minuto por IP
const generalApiLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 120 }); // 120 peticiones API por minuto por IP
`;

code = code.replace(
  "const transcribeLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 10 });",
  "const transcribeLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 10 });\n" + limitersBlock
);

// 3. Rate limiting and audit logging on /api/r2/session
const oldSessionPost = `    if (pathname === '/api/r2/session') {
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
        }`;

const newSessionPost = `    if (pathname === '/api/r2/session') {
      if (req.method === 'POST') {
        const clientIp = getClientIp(req);
        if (!authLimiter(clientIp)) {
          const retryAfter = authLimiter.getRetryAfter(clientIp);
          res.setHeader('Retry-After', retryAfter);
          logSecurityEvent({
            eventType: AuditEventType.RATE_LIMIT_EXCEEDED,
            severity: AuditSeverity.SECURITY_ALERT,
            ip: clientIp,
            resource: '/api/r2/session',
            req
          });
          return sendJson(res, 429, { error: 'Demasiados intentos de autenticación. Por favor espera un minuto.', retryAfter });
        }

        const { buffer, tooLarge } = await readBodyWithLimit(req, 16 * 1024, res);
        if (tooLarge) {
          logSecurityEvent({ eventType: AuditEventType.PAYLOAD_TOO_LARGE, severity: AuditSeverity.WARN, resource: '/api/r2/session', req });
          return;
        }
        const body = parseJsonSafe(buffer);
        if (!body || !body.token || typeof body.token !== 'string') {
          return sendJson(res, 400, { error: 'token es requerido' });
        }

        const auth = await authenticateRequest(req, { token: body.token });
        if (!auth.ok) {
          logSecurityEvent({
            eventType: AuditEventType.AUTH_LOGIN_FAILED,
            severity: AuditSeverity.WARN,
            resource: '/api/r2/session',
            req,
            details: { error: auth.error }
          });
          return sendJson(res, auth.status, { error: auth.error });
        }

        logSecurityEvent({
          eventType: AuditEventType.AUTH_LOGIN_SUCCESS,
          userId: auth.user.id,
          resource: '/api/r2/session',
          req
        });`;

code = code.replace(oldSessionPost, newSessionPost);

// 4. Rate limiting on AI assistant endpoints
const oldAiCheck = `  if (pathname.startsWith('/api/ai/')) {
    loadEnvFiles();`;

const newAiCheck = `  if (pathname.startsWith('/api/ai/')) {
    const clientIp = getClientIp(req);
    if (!aiLimiter(clientIp)) {
      const retryAfter = aiLimiter.getRetryAfter(clientIp);
      res.setHeader('Retry-After', retryAfter);
      logSecurityEvent({
        eventType: AuditEventType.RATE_LIMIT_EXCEEDED,
        severity: AuditSeverity.SECURITY_ALERT,
        ip: clientIp,
        resource: pathname,
        req
      });
      return sendJson(res, 429, { error: 'Límite de consultas de IA excedido. Por favor espera un momento.', retryAfter });
    }
    loadEnvFiles();`;

code = code.replace(oldAiCheck, newAiCheck);

// 5. Apply Security Headers on static files
const oldStaticHeaders = `  // Cache static assets with hash for 1 year, index.html no-cache
  if (ext === '.html') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }`;

const newStaticHeaders = `  applySecurityHeaders(res, req);

  // Cache static assets with hash for 1 year, index.html no-cache
  if (ext === '.html') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }`;

code = code.replace(oldStaticHeaders, newStaticHeaders);

fs.writeFileSync(targetFile, code, 'utf8');
console.log('server.mjs successfully updated with SOC 2 / ISO 27001 hardening!');
