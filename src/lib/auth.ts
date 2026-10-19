import { insforge } from './insforge';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  createdAt?: string;
}

const DEFAULT_WORKSPACE_EMAIL = 'usuario@segundocerebro.com';
const DEFAULT_WORKSPACE_PASSWORD = 'SegundoCerebro2026!';
const LOGGED_OUT_KEY = 'sc_user_explicitly_logged_out';

/**
 * Normaliza el identificador ingresado por el usuario:
 * Si es un correo válido (contiene @), se usa directamente.
 * Si es un nombre de usuario plano (ej. 'admin' o 'johna'), se convierte en un formato de correo de dominio local.
 */
export function normalizeUserIdentifier(input: string): string {
  const clean = input.trim();
  if (!clean) return clean;
  if (clean.includes('@')) {
    return clean.toLowerCase();
  }
  // Convertir nombre de usuario simple a email canónico
  const safeUsername = clean.toLowerCase().replace(/[^a-z0-9_.-]/g, '');
  return `${safeUsername}@segundocerebro.local`;
}

class AuthService {
  private currentUser: AuthUser | null = null;
  private listeners: ((user: AuthUser | null) => void)[] = [];
  private initPromise: Promise<AuthUser | null> | null = null;

  constructor() {
    this.initSession();
  }

  // Subscribe to auth state changes
  public onAuthStateChanged(callback: (user: AuthUser | null) => void) {
    this.listeners.push(callback);
    callback(this.currentUser);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      listener(this.currentUser);
    }
  }

  // Check current session
  public async initSession(): Promise<AuthUser | null> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const isExplicitlyLoggedOut = typeof window !== 'undefined' && localStorage.getItem(LOGGED_OUT_KEY) === 'true';

        if (isExplicitlyLoggedOut) {
          this.currentUser = null;
          this.notifyListeners();
          return null;
        }

        const { data, error } = await insforge.auth.getCurrentUser();
        if (data?.user) {
          this.currentUser = {
            id: data.user.id,
            email: data.user.email,
            name: (data.user.profile as any)?.name || data.user.email.split('@')[0],
            createdAt: data.user.createdAt
          };
          this.notifyListeners();
          return this.currentUser;
        }

        this.currentUser = null;
        this.notifyListeners();
        return null;
      } catch (err) {
        console.error('Error al inicializar sesión de InsForge:', err);
        this.currentUser = null;
        this.notifyListeners();
      } finally {
        this.initPromise = null;
      }
      return null;
    })();

    return this.initPromise;
  }

  /**
   * Garantiza que la sesión de InsForge esté activa con un token JWT válido y no expirado.
   * Si el token está ausente o expira en menos de 2 minutos, renueva automáticamente la sesión
   * contra InsForge backend para evitar 401s y timeouts en operaciones de Storage.
   */
  public async ensureActiveSession(): Promise<{ user: AuthUser; token: string }> {
    let token = (insforge as any).tokenManager?.getAccessToken?.() || null;
    
    // Validar expiración del JWT
    let isTokenValid = false;
    if (token) {
      try {
        const payloadBase64 = token.split('.')[1];
        if (payloadBase64) {
          const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
          const jsonStr = atob(base64);
          const payload = JSON.parse(jsonStr);
          const nowSeconds = Math.floor(Date.now() / 1000);
          if (payload.exp && payload.exp > nowSeconds + 120) {
            isTokenValid = true;
          }
        }
      } catch (e) {
        isTokenValid = false;
      }
    }

    if (!isTokenValid || !this.currentUser) {
      // Check current session from InsForge tokenManager
      const userRes = await insforge.auth.getCurrentUser();
      const currentToken = (insforge as any).tokenManager?.getAccessToken?.() || null;
      if (userRes.data?.user && currentToken) {
        this.currentUser = {
          id: userRes.data.user.id,
          email: userRes.data.user.email,
          name: (userRes.data.user.profile as any)?.name || userRes.data.user.email.split('@')[0],
          createdAt: userRes.data.user.createdAt
        };
        token = currentToken;
        this.notifyListeners();
      } else {
        throw new Error('Debes iniciar sesión para realizar operaciones de almacenamiento.');
      }
    }

    return { user: this.currentUser!, token: token! };
  }

  public async getCurrentUser(): Promise<AuthUser | null> {
    if (this.currentUser) return this.currentUser;
    return this.initSession();
  }

  public async signIn(identifier: string, password: string): Promise<{ user: AuthUser | null; error: Error | null }> {
    try {
      const email = normalizeUserIdentifier(identifier);
      const { data, error } = await insforge.auth.signInWithPassword({ email, password });
      if (error || !data?.user) {
        return { user: null, error: error || new Error('Usuario/contraseña incorrectos') };
      }

      // Eliminar bandera de logout explícito
      if (typeof window !== 'undefined') {
        localStorage.removeItem(LOGGED_OUT_KEY);
      }

      this.currentUser = {
        id: data.user.id,
        email: data.user.email,
        name: (data.user.profile as any)?.name || data.user.email.split('@')[0],
        createdAt: data.user.createdAt
      };
      this.notifyListeners();
      return { user: this.currentUser, error: null };
    } catch (err: any) {
      return { user: null, error: err };
    }
  }

  public async signUp(identifier: string, password: string, name?: string): Promise<{ user: AuthUser | null; error: Error | null }> {
    try {
      const email = normalizeUserIdentifier(identifier);
      const displayName = name || (identifier.includes('@') ? identifier.split('@')[0] : identifier);
      const { data, error } = await insforge.auth.signUp({ email, password, name: displayName });
      if (error || !data?.user) {
        return { user: null, error: error || new Error('No se pudo registrar la cuenta') };
      }

      // Eliminar bandera de logout explícito
      if (typeof window !== 'undefined') {
        localStorage.removeItem(LOGGED_OUT_KEY);
      }

      this.currentUser = {
        id: data.user.id,
        email: data.user.email,
        name: displayName,
        createdAt: data.user.createdAt
      };
      this.notifyListeners();
      return { user: this.currentUser, error: null };
    } catch (err: any) {
      return { user: null, error: err };
    }
  }

  public async signOut(): Promise<void> {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOGGED_OUT_KEY, 'true');
      }
      this.initPromise = null;
      await insforge.auth.signOut();
    } catch (e) {
      console.warn('Error durante signOut:', e);
    }
    this.currentUser = null;
    this.notifyListeners();
  }
}

export const auth = new AuthService();
