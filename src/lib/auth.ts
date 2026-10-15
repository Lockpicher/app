import { insforge } from './insforge';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  createdAt?: string;
}

const DEFAULT_WORKSPACE_EMAIL = 'usuario@segundocerebro.com';
const DEFAULT_WORKSPACE_PASSWORD = 'SegundoCerebro2026!';

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

  // Check current session or automatically sign in to workspace account
  public async initSession(): Promise<AuthUser | null> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
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

        // If no active session, auto-authenticate with workspace user for seamless Storage writes
        console.log('Iniciando sesión en espacio de trabajo...');
        const signInRes = await insforge.auth.signInWithPassword({
          email: DEFAULT_WORKSPACE_EMAIL,
          password: DEFAULT_WORKSPACE_PASSWORD
        });

        if (signInRes.data?.user) {
          this.currentUser = {
            id: signInRes.data.user.id,
            email: signInRes.data.user.email,
            name: (signInRes.data.user.profile as any)?.name || 'Usuario Segundo Cerebro',
            createdAt: signInRes.data.user.createdAt
          };
          this.notifyListeners();
          return this.currentUser;
        }

        // If user doesn't exist, sign up
        if (signInRes.error) {
          const signUpRes = await insforge.auth.signUp({
            email: DEFAULT_WORKSPACE_EMAIL,
            password: DEFAULT_WORKSPACE_PASSWORD,
            name: 'Usuario Segundo Cerebro'
          });
          if (signUpRes.data?.user) {
            this.currentUser = {
              id: signUpRes.data.user.id,
              email: signUpRes.data.user.email,
              name: 'Usuario Segundo Cerebro',
              createdAt: signUpRes.data.user.createdAt
            };
            this.notifyListeners();
            return this.currentUser;
          }
        }
      } catch (err) {
        console.error('Error al inicializar sesión de InsForge:', err);
      }
      return null;
    })();

    return this.initPromise;
  }

  public async getCurrentUser(): Promise<AuthUser | null> {
    if (this.currentUser) return this.currentUser;
    return this.initSession();
  }

  public async signIn(email: string, password: string):Promise<{ user: AuthUser | null; error: Error | null }> {
    try {
      const { data, error } = await insforge.auth.signInWithPassword({ email, password });
      if (error || !data?.user) {
        return { user: null, error: error || new Error('No se pudo iniciar sesión') };
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

  public async signUp(email: string, password: string, name?: string): Promise<{ user: AuthUser | null; error: Error | null }> {
    try {
      const { data, error } = await insforge.auth.signUp({ email, password, name });
      if (error || !data?.user) {
        return { user: null, error: error || new Error('No se pudo registrar') };
      }

      this.currentUser = {
        id: data.user.id,
        email: data.user.email,
        name: name || data.user.email.split('@')[0],
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
      await insforge.auth.signOut();
    } catch (e) {
      console.warn('Error durante signOut:', e);
    }
    this.currentUser = null;
    this.notifyListeners();
  }
}

export const auth = new AuthService();
