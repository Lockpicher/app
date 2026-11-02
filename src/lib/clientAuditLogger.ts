/**
 * Client-Side Audit Logger for Security Events
 * Registra eventos de seguridad locales (bloqueos por contraseña, accesos, intentos erróneos)
 */

export const AuditEventType = {
  NOTE_PASSWORD_LOCKED: 'NOTE_PASSWORD_LOCKED',
  NOTE_PASSWORD_UNLOCKED: 'NOTE_PASSWORD_UNLOCKED',
  NOTE_PASSWORD_FAILED: 'NOTE_PASSWORD_FAILED',
  NOTEBOOK_PASSWORD_LOCKED: 'NOTEBOOK_PASSWORD_LOCKED',
  NOTEBOOK_PASSWORD_UNLOCKED: 'NOTEBOOK_PASSWORD_UNLOCKED',
  NOTEBOOK_PASSWORD_FAILED: 'NOTEBOOK_PASSWORD_FAILED',
  SESSION_LOGOUT: 'SESSION_LOGOUT',
  EXPORT_REQUESTED: 'EXPORT_REQUESTED'
} as const;

export function logClientSecurityEvent(
  event: keyof typeof AuditEventType,
  details: Record<string, any> = {}
) {
  const timestamp = new Date().toISOString();
  const payload = {
    timestamp,
    event,
    ...details
  };

  if (process.env.NODE_ENV !== 'production') {
    console.info(`[Client Audit] ${event}`, payload);
  }
}
