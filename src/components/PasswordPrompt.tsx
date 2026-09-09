
import React, { useState } from 'react';
import { Lock, X, KeyRound, AlertCircle } from 'lucide-react';

interface PasswordPromptProps {
  onSuccess: () => void;
  onCancel: () => void;
  correctPassword: string;
  moduleName: string;
}

export const PasswordPrompt: React.FC<PasswordPromptProps> = ({ 
  onSuccess, 
  onCancel, 
  correctPassword,
  moduleName 
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim().toUpperCase() === correctPassword.trim().toUpperCase() || password === correctPassword) {
      onSuccess();
    } else {
      setError(true);
      setPassword('');
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-nucleo/60 backdrop-blur-xl flex items-center justify-center p-6">
      <div className={`
        bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl border border-white/20 transition-all duration-300
        ${error ? 'animate-bounce border-rose-500 shadow-rose-500/20' : ''}
      `}>
        <div className="flex justify-between items-start mb-8">
          <div className="flex flex-col gap-2">
            <div className="w-12 h-12 bg-calido rounded-2xl flex items-center justify-center text-nucleo">
              <Lock size={24} />
            </div>
            <h2 className="text-2xl font-black text-nucleo uppercase tracking-tight mt-4">Acceso Restringido</h2>
            <p className="text-[10px] font-black text-violeta/60 uppercase tracking-widest leading-relaxed">
              Módulo: {moduleName}
            </p>
          </div>
          <button onClick={onCancel} className="w-10 h-10 bg-calido rounded-xl flex items-center justify-center text-violeta hover:bg-violeta hover:text-white transition-all">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <p className="text-[10px] font-black text-violeta uppercase tracking-widest ml-4">Contraseña Requerida</p>
            <div className="relative group">
              <div className="absolute inset-y-0 left-6 flex items-center text-violeta/30 group-focus-within:text-ionizado transition-colors">
                <KeyRound size={18} />
              </div>
              <input 
                type="password" 
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`
                  w-full bg-calido border-2 rounded-[2rem] py-5 pl-16 pr-8 text-xl font-black text-nucleo outline-none transition-all
                  ${error ? 'border-rose-500 focus:border-rose-500' : 'border-transparent focus:border-ionizado focus:bg-white'}
                `}
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-rose-500 font-black text-[10px] uppercase tracking-widest ml-4 mt-2">
                <AlertCircle size={12} /> Contraseña incorrecta
              </div>
            )}
          </div>

          <button 
            type="submit"
            className="w-full bg-nucleo text-white py-5 rounded-[2rem] text-xs font-black uppercase tracking-[0.3em] shadow-xl shadow-nucleo/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            Verificar Acceso
          </button>
        </form>

        <p className="text-center mt-8 text-[9px] font-bold text-violeta/40 uppercase tracking-widest">
          Sistema de Seguridad SQM Litio
        </p>
      </div>
    </div>
  );
};
