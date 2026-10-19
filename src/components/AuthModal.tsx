import React, { useState } from 'react';
import { 
  Lock, 
  Mail, 
  KeyRound, 
  User, 
  X, 
  ArrowRight, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  LogOut,
  Sparkles,
  ShieldCheck,
  Eye,
  EyeOff
} from 'lucide-react';
import { auth, AuthUser } from '../lib/auth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
  onAuthSuccess?: (user: AuthUser) => void;
  onSignOut?: () => void;
  isMandatory?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onAuthSuccess,
  onSignOut,
  isMandatory = false
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedIdentifier = email.trim();
    if (!trimmedIdentifier || !password) {
      setErrorMsg('Por favor ingresa tu usuario/correo y contraseña.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'signin') {
        const { user, error } = await auth.signIn(trimmedIdentifier, password);
        if (error || !user) {
          setErrorMsg(error?.message || 'Usuario o contraseña incorrectos.');
        } else {
          setSuccessMsg(`¡Bienvenido de nuevo, ${user.name || user.email}!`);
          if (onAuthSuccess) onAuthSuccess(user);
          setTimeout(() => {
            onClose();
          }, 800);
        }
      } else {
        const { user, error } = await auth.signUp(trimmedIdentifier, password, name.trim() || undefined);
        if (error || !user) {
          setErrorMsg(error?.message || 'No se pudo crear la cuenta. Intenta con otro nombre o correo.');
        } else {
          setSuccessMsg(`¡Cuenta creada con éxito! Bienvenido, ${user.name || user.email}.`);
          if (onAuthSuccess) onAuthSuccess(user);
          setTimeout(() => {
            onClose();
          }, 1000);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Ocurrió un error inesperado.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await auth.signOut();
      setEmail('');
      setPassword('');
      setName('');
      setMode('signin');
      if (onSignOut) onSignOut();
      setSuccessMsg('Sesión cerrada correctamente.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al cerrar sesión.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
      onClick={(e) => {
        if (!isMandatory && e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div className="relative w-full max-w-md bg-[#161622] border border-[#2a2a3c] rounded-2xl shadow-2xl overflow-hidden transition-all">
        {/* Glow decorative top bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500" />

        {/* Close Button (only if not mandatory login) */}
        {!isMandatory && (
          <button
            onClick={onClose}
            disabled={isLoading}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#232334] transition"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="p-6 sm:p-7">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600/30 to-purple-600/30 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-inner">
              <Sparkles className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-wide">
                Segundo Cerebro
              </h3>
              <p className="text-xs text-gray-400">
                {currentUser 
                  ? 'Gestiona tu cuenta y sincronización' 
                  : (mode === 'signin' ? 'Accede a tus notas, proyectos y tareas' : 'Crea tu espacio de conocimiento')}
              </p>
            </div>
          </div>

          {/* Current user card if logged in */}
          {currentUser ? (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-[#1b1b2a] border border-[#2d2d42] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-400">
                    Cuenta Activa
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Conectado
                  </span>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/40 text-blue-300 font-bold flex items-center justify-center text-sm flex-shrink-0">
                    {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : currentUser.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">
                      {currentUser.name || 'Usuario'}
                    </p>
                    <p className="text-xs text-gray-400 truncate font-mono">
                      {currentUser.email}
                    </p>
                  </div>
                </div>

                <div className="pt-2 text-[11px] text-gray-400 flex items-center gap-1.5 border-t border-[#26263a]">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                  <span>Sincronización en tiempo real activa con InsForge</span>
                </div>
              </div>

              {errorMsg && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-950/40 border border-red-800/40 text-red-300 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-xs">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 text-xs font-semibold transition"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <LogOut className="w-4 h-4" />
                      <span>Cerrar Sesión</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#232334] hover:bg-[#2b2b40] text-gray-200 text-xs font-medium border border-[#34344c] transition"
                >
                  Continuar trabajando
                </button>
              </div>
            </div>
          ) : (
            <div>
              {/* Tabs Switcher: Iniciar Sesión / Registrarse */}
              <div className="grid grid-cols-2 p-1 bg-[#12121a] rounded-xl border border-[#242436] mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className={`py-2 text-xs font-semibold rounded-lg transition ${
                    mode === 'signin'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Iniciar Sesión
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className={`py-2 text-xs font-semibold rounded-lg transition ${
                    mode === 'signup'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Crear Cuenta
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1.5">
                      Nombre completo
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ej. Juan Pérez"
                        className="w-full pl-9 pr-3 py-2 bg-[#1b1b28] border border-[#2e2e42] rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">
                    {mode === 'signin' ? 'Usuario o Correo electrónico' : 'Nombre de usuario o Correo'}
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={mode === 'signin' ? 'ej. johna o tu@correo.com' : 'ej. johna o tu@correo.com'}
                      className="w-full pl-9 pr-3 py-2 bg-[#1b1b28] border border-[#2e2e42] rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition font-sans"
                    />
                  </div>
                  {mode === 'signup' && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      Puedes usar solo un nombre de usuario (ej. <code>admin</code>) o tu correo tradicional.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">
                    Contraseña
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-9 py-2 bg-[#1b1b28] border border-[#2e2e42] rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(prev => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {mode === 'signup' && (
                    <p className="text-[10px] text-gray-500 mt-1">
                      Mínimo 6 caracteres
                    </p>
                  )}
                </div>

                {errorMsg && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-950/40 border border-red-800/40 text-red-300 text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-xs">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{successMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-white shadow-lg transition ${
                    mode === 'signin'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-900/30'
                      : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-900/30'
                  }`}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>{mode === 'signin' ? 'Iniciar Sesión' : 'Crear Cuenta'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
