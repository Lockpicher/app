/**
 * Server-Side Security Audit Logger (SOC 2 & ISO/IEC 27001)
 */

import fs from 'fs';
import path from 'path';

const AUDIT_LOG_FILE = path.resolve(process.cwd(), 'security_audit.log');

export const AuditEventType = {
  AUTH_LOGIN_SUCCESS: 'AUTH_LOGIN_SUCCESS',
  AUTH_LOGIN_FAILED: 'AUTH_LOGIN_FAILED',
  AUTH_LOGOUT: 'AUTH_LOGOUT',
  ACCESS_DENIED: 'ACCESS_DENIED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  SESSION_SYNC: 'SESSION_SYNC',
  NOTE_PASSWORD_LOCKED: 'NOTE_PASSWORD_LOCKED',
  NOTE_PASSWORD_UNLOCKED: 'NOTE_PASSWORD_UNLOCKED',
  NOTE_PASSWORD_FAILED: 'NOTE_PASSWORD_FAILED',
  FILE_UPLOADED: 'FILE_UPLOADED',
  FILE_DELETED: 'FILE_DELETED',
  SSRF_ATTEMPT_BLOCKED: 'SSRF_ATTEMPT_BLOCKED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  AI_PROMPT_EXECUTED: 'AI_PROMPT_EXECUTED'
} as const;

export const AuditSeverity = {
  INFO: 'INFO',
  WARN: 'WARN',
  SECURITY_ALERT: 'SECURITY_ALERT'
} as const;

export async function logSecurityEvent({
  eventType,
  severity = AuditSeverity.INFO,
  userId = null,
  ip = '127.0.0.1',
  resource = '',
  details = {},
  req = null
}: {
  eventType: string;
  severity?: string;
  userId?: string | null;
  ip?: string;
  resource?: string;
  details?: Record<string, any>;
  req?: any;
}) {
  const clientIp = req ? (req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || ip) : ip;
  const userAgent = req?.headers['user-agent'] || 'unknown';

  const entry = {
    timestamp: new Date().toISOString(),
    event: eventType,
    severity,
    userId: userId || 'anonymous',
    clientIp,
    userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 200) : 'unknown',
    resource,
    details: sanitizeAuditDetails(details)
  };

  const line = JSON.stringify(entry) + '\n';

  try {
    fs.appendFileSync(AUDIT_LOG_FILE, line, 'utf8');
  } catch (err: any) {
    console.error('[AuditLogger] Fallo al escribir en archivo de auditoría:', err?.message);
  }

  if (severity === AuditSeverity.SECURITY_ALERT) {
    console.warn(`[SECURITY ALERT] [${entry.timestamp}] ${eventType} desde IP ${clientIp} sobre ${resource}`);
  }
}

function sanitizeAuditDetails(details: Record<string, any>) {
  if (!details || typeof details !== 'object') return {};
  const cleaned: Record<string, any> = { ...details };
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth', 'cookie', 'authorization'];
  for (const k of Object.keys(cleaned)) {
    if (sensitiveKeys.some(s => k.toLowerCase().includes(s))) {
      cleaned[k] = '[REDACTED]';
    }
  }
  return cleaned;
}
