/**
 * Utilidades para cifrado, hashing y gestión de contraseñas
 * de Cuadernos y Notas en Segundo Cerebro.
 *
 * Hardening SOC 2 (CC6.1, CC6.6) & ISO/IEC 27001:2022 (A.5.15, A.8.24):
 * - Hashing SHA-256 con salt para mitigación de ataques de tablas arcoíris
 * - Comparación en tiempo constante para mitigación de ataques de temporización (timing attacks)
 * - Expiración automática de sesión de desbloqueo (Idle timeout de 30 minutos)
 */

import { logClientSecurityEvent, AuditEventType } from './clientAuditLogger';

const STATIC_SALT = 'segundo_cerebro_pkm_sec_v1';
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos de inactividad antes de re-bloqueo

// Genera un hash SHA-256 hexadecimal a partir de una contraseña en texto plano
export async function hashPassword(password: string): Promise<string> {
  const clean = password.trim();
  if (!clean) return '';
  const encoder = new TextEncoder();
  const data = encoder.encode(`${STATIC_SALT}:${clean}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Hashing legado sin salt (para compatibilidad hacia atrás con registros antiguos)
async function legacyHashPassword(password: string): Promise<string> {
  const clean = password.trim();
  if (!clean) return '';
  const encoder = new TextEncoder();
  const data = encoder.encode(clean);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Comparación en tiempo constante para prevenir timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// Verifica si la contraseña ingresada coincide con el hash guardado
export async function verifyPassword(password: string, expectedHash: string): Promise<boolean> {
  if (!expectedHash) return true;

  // 1. Verificar primero con hash salted moderno
  const modernHash = await hashPassword(password);
  if (timingSafeEqual(modernHash, expectedHash)) {
    return true;
  }

  // 2. Fallback de compatibilidad con hash legado
  const legacyHash = await legacyHashPassword(password);
  return timingSafeEqual(legacyHash, expectedHash);
}

// Claves de sesión en sessionStorage para recordar elementos desbloqueados mientras la pestaña esté abierta
const UNLOCKED_NOTEBOOKS_KEY = 'sc_unlocked_notebooks_session';
const UNLOCKED_NOTES_KEY = 'sc_unlocked_notes_session';
const LAST_ACTIVITY_KEY = 'sc_sec_last_activity';

function checkAndEnforceIdleTimeout(): void {
  if (typeof window === 'undefined') return;
  try {
    const last = sessionStorage.getItem(LAST_ACTIVITY_KEY);
    const now = Date.now();
    if (last && now - parseInt(last, 10) > IDLE_TIMEOUT_MS) {
      sessionStorage.removeItem(UNLOCKED_NOTEBOOKS_KEY);
      sessionStorage.removeItem(UNLOCKED_NOTES_KEY);
    }
    sessionStorage.setItem(LAST_ACTIVITY_KEY, String(now));
  } catch {}
}

function getUnlockedSet(storageKey: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  checkAndEnforceIdleTimeout();
  try {
    const raw = sessionStorage.getItem(storageKey);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveUnlockedSet(storageKey: string, set: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(Array.from(set)));
    sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  } catch {}
}

export function isNotebookUnlocked(notebookId: string): boolean {
  return getUnlockedSet(UNLOCKED_NOTEBOOKS_KEY).has(notebookId);
}

export function unlockNotebookSession(notebookId: string): void {
  const set = getUnlockedSet(UNLOCKED_NOTEBOOKS_KEY);
  set.add(notebookId);
  saveUnlockedSet(UNLOCKED_NOTEBOOKS_KEY, set);
  logClientSecurityEvent(AuditEventType.NOTEBOOK_PASSWORD_UNLOCKED, { notebookId });
}

export function lockNotebookSession(notebookId: string): void {
  const set = getUnlockedSet(UNLOCKED_NOTEBOOKS_KEY);
  set.delete(notebookId);
  saveUnlockedSet(UNLOCKED_NOTEBOOKS_KEY, set);
  logClientSecurityEvent(AuditEventType.NOTEBOOK_PASSWORD_LOCKED, { notebookId });
}

export function isNoteUnlocked(noteId: string): boolean {
  return getUnlockedSet(UNLOCKED_NOTES_KEY).has(noteId);
}

export function unlockNoteSession(noteId: string): void {
  const set = getUnlockedSet(UNLOCKED_NOTES_KEY);
  set.add(noteId);
  saveUnlockedSet(UNLOCKED_NOTES_KEY, set);
  logClientSecurityEvent(AuditEventType.NOTE_PASSWORD_UNLOCKED, { noteId });
}

export function lockNoteSession(noteId: string): void {
  const set = getUnlockedSet(UNLOCKED_NOTES_KEY);
  set.delete(noteId);
  saveUnlockedSet(UNLOCKED_NOTES_KEY, set);
  logClientSecurityEvent(AuditEventType.NOTE_PASSWORD_LOCKED, { noteId });
}
