import React, { useState } from 'react';
import { Lock, Eye, EyeOff, X, AlertCircle } from 'lucide-react';

interface PasswordUnlockModalProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onVerify: (password: string) => Promise<boolean>;
  onSuccess: () => void;
}

export const PasswordUnlockModal: React.FC<PasswordUnlockModalProps> = ({
  isOpen,
  title,
  subtitle,
  onClose,
  onVerify,
  onSuccess
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMsg('Ingresa la contraseña para desbloquear');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMsg(null);
      const isValid = await onVerify(password);
      if (isValid) {
        setPassword('');
        onSuccess();
      } else {
        setErrorMsg('Contraseña incorrecta. Inténtalo de nuevo.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al verificar la contraseña');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-sm bg-[#161622] border border-[#2b2b3d] rounded-2xl shadow-2xl overflow-hidden p-6 text-center space-y-4">
        {/* Header Icon */}
        <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <Lock className="w-6 h-6" />
        </div>

        <div>
          <h3 className="text-base font-bold text-white tracking-tight">
            {title}
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            {subtitle || 'Este elemento está protegido con contraseña.'}
          </p>
        </div>

        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2 text-left">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder="Ingresa la contraseña..."
              autoFocus
              className="w-full px-3.5 py-2.5 bg-[#121218] border border-[#2c2c40] rounded-xl text-xs text-white placeholder-gray-500 outline-none focus:border-amber-500 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setPassword('');
                setErrorMsg(null);
                onClose();
              }}
              className="flex-1 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white bg-[#1a1a26] hover:bg-[#232334] transition border border-[#2b2b3d]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2 rounded-xl text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 transition shadow-md shadow-amber-950/30 disabled:opacity-50"
            >
              {isLoading ? 'Verificando...' : 'Desbloquear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
