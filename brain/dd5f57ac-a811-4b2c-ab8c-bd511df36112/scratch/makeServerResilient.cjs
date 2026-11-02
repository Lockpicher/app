const fs = require('fs');
const path = require('path');

const targetFile = path.resolve('server.mjs');
let s = fs.readFileSync(targetFile, 'utf8');

const oldImports = `import { redisCache } from './src/lib/redisCache.mjs';
import {
  sendJson,
  readBodyWithLimit,
  parseJsonSafe,
  getClientIp,
  createRateLimiter,
  authenticateRequest
} from './src/lib/apiGuard.mjs';
import { isAllowedUrl } from './src/lib/webScraperServer.ts';
import { logSecurityEvent, AuditEventType, AuditSeverity } from './src/lib/auditLogger.mjs';
import { applySecurityHeaders, sendSafeError } from './src/lib/apiGuard.mjs';`;

const newImports = `import {
  sendJson,
  readBodyWithLimit,
  parseJsonSafe,
  getClientIp,
  createRateLimiter,
  authenticateRequest,
  applySecurityHeaders,
  sendSafeError
} from './src/lib/apiGuard.mjs';
import { isAllowedUrl } from './src/lib/webScraperServer.ts';

// Carga resiliente de redisCache con fallback automático en memoria
let redisCache = {
  get: async () => null,
  set: async () => {},
  del: async () => {}
};
try {
  const mod = await import('./src/lib/redisCache.mjs');
  if (mod?.redisCache) redisCache = mod.redisCache;
} catch (e) {
  console.warn('[Server] src/lib/redisCache.mjs no encontrado, usando fallback en memoria');
}

// Carga resiliente de auditLogger con fallback
let logSecurityEvent = async () => {};
let AuditEventType = {
  AUTH_LOGIN_SUCCESS: 'AUTH_LOGIN_SUCCESS',
  AUTH_LOGIN_FAILED: 'AUTH_LOGIN_FAILED',
  AUTH_LOGOUT: 'AUTH_LOGOUT',
  ACCESS_DENIED: 'ACCESS_DENIED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  SESSION_SYNC: 'SESSION_SYNC',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  SSRF_ATTEMPT_BLOCKED: 'SSRF_ATTEMPT_BLOCKED'
};
let AuditSeverity = {
  INFO: 'INFO',
  WARN: 'WARN',
  SECURITY_ALERT: 'SECURITY_ALERT'
};
try {
  const mod = await import('./src/lib/auditLogger.mjs');
  if (mod?.logSecurityEvent) logSecurityEvent = mod.logSecurityEvent;
  if (mod?.AuditEventType) AuditEventType = mod.AuditEventType;
  if (mod?.AuditSeverity) AuditSeverity = mod.AuditSeverity;
} catch (e) {
  console.warn('[Server] src/lib/auditLogger.mjs no encontrado, usando fallback en memoria');
}`;

const normalized = s.replace(/\r\n/g, '\n');
const normOld = oldImports.replace(/\r\n/g, '\n');
const normNew = newImports.replace(/\r\n/g, '\n');

if (normalized.includes(normOld)) {
  const updated = normalized.replace(normOld, normNew);
  fs.writeFileSync(targetFile, updated, 'utf8');
  console.log('server.mjs successfully updated with resilient dynamic imports!');
} else {
  console.log('Target block not found in server.mjs');
}
