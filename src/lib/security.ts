/**
 * Utilidades para cifrado, hashing y gestión de contraseñas
 * de Cuadernos y Notas en Segundo Cerebro.
 * Utiliza Web Crypto API nativa (SHA-256) soportada en todos los navegadores modernos.
 */

// Genera un hash SHA-256 hexadecimal a partir de una contraseña en texto plano
export async function hashPassword(password: string): Promise<string> {
  const clean = password.trim();
  if (!clean) return '';
  const encoder = new TextEncoder();
  const data = encoder.encode(clean);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Verifica si la contraseña ingresada coincide con el hash guardado
export async function verifyPassword(password: string, expectedHash: string): Promise<boolean> {
  if (!expectedHash) return true;
  const inputHash = await hashPassword(password);
  return inputHash === expectedHash;
}

// Claves de sesión en sessionStorage para recordar elementos desbloqueados mientras la pestaña esté abierta
const UNLOCKED_NOTEBOOKS_KEY = 'sc_unlocked_notebooks_session';
const UNLOCKED_NOTES_KEY = 'sc_unlocked_notes_session';

function getUnlockedSet(storageKey: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
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
  } catch {}
}

export function isNotebookUnlocked(notebookId: string): boolean {
  return getUnlockedSet(UNLOCKED_NOTEBOOKS_KEY).has(notebookId);
}

export function unlockNotebookSession(notebookId: string): void {
  const set = getUnlockedSet(UNLOCKED_NOTEBOOKS_KEY);
  set.add(notebookId);
  saveUnlockedSet(UNLOCKED_NOTEBOOKS_KEY, set);
}

export function lockNotebookSession(notebookId: string): void {
  const set = getUnlockedSet(UNLOCKED_NOTEBOOKS_KEY);
  set.delete(notebookId);
  saveUnlockedSet(UNLOCKED_NOTEBOOKS_KEY, set);
}

export function isNoteUnlocked(noteId: string): boolean {
  return getUnlockedSet(UNLOCKED_NOTES_KEY).has(noteId);
}

export function unlockNoteSession(noteId: string): void {
  const set = getUnlockedSet(UNLOCKED_NOTES_KEY);
  set.add(noteId);
  saveUnlockedSet(UNLOCKED_NOTES_KEY, set);
}

export function lockNoteSession(noteId: string): void {
  const set = getUnlockedSet(UNLOCKED_NOTES_KEY);
  set.delete(noteId);
  saveUnlockedSet(UNLOCKED_NOTES_KEY, set);
}
