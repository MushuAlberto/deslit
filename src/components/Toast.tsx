import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  title?: string;
  message: string;
  type: ToastType;
  duration?: number; // in ms
}

interface ToastContextType {
  toast: (message: string, type?: ToastType, title?: string, duration?: number) => void;
  success: (message: string, title?: string, duration?: number) => void;
  error: (message: string, title?: string, duration?: number) => void;
  warning: (message: string, title?: string, duration?: number) => void;
  info: (message: string, title?: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: React.ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info', title?: string, duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastMessage = { id, message, type, title, duration };
    setToasts((prev) => [...prev, newToast]);
  }, []);

  const success = useCallback((message: string, title?: string, duration?: number) => {
    toast(message, 'success', title || 'Éxito', duration);
  }, [toast]);

  const error = useCallback((message: string, title?: string, duration?: number) => {
    toast(message, 'error', title || 'Error', duration);
  }, [toast]);

  const warning = useCallback((message: string, title?: string, duration?: number) => {
    toast(message, 'warning', title || 'Advertencia', duration);
  }, [toast]);

  const info = useCallback((message: string, title?: string, duration?: number) => {
    toast(message, 'info', title || 'Información', duration);
  }, [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
};

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
};

interface ToastCardProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

const ToastCard: React.FC<ToastCardProps> = ({ toast, onDismiss }) => {
  const { id, title, message, type, duration = 4000 } = toast;
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remainingPct = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remainingPct);
      if (elapsed >= duration) {
        clearInterval(interval);
        onDismiss(id);
      }
    }, 16);

    return () => clearInterval(interval);
  }, [id, duration, onDismiss]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-rose-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'info':
      default:
        return <Info className="w-5 h-5 text-sky-500" />;
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'success':
        return 'bg-slate-900/95 border-emerald-500/30';
      case 'error':
        return 'bg-slate-900/95 border-rose-500/30';
      case 'warning':
        return 'bg-slate-900/95 border-amber-500/30';
      case 'info':
      default:
        return 'bg-slate-900/95 border-violeta/30';
    }
  };

  const getProgressColor = () => {
    switch (type) {
      case 'success':
        return 'bg-emerald-500';
      case 'error':
        return 'bg-rose-500';
      case 'warning':
        return 'bg-amber-500';
      case 'info':
      default:
        return 'bg-violeta';
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      className={`pointer-events-auto relative overflow-hidden p-4 rounded-2xl border backdrop-blur-md shadow-2xl flex items-start gap-3 w-full ${getBgColor()}`}
    >
      <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
      
      <div className="flex-grow min-w-0 pr-4">
        {title && <h5 className="text-white text-xs font-black uppercase tracking-wider mb-1">{title}</h5>}
        <p className="text-slate-300 text-xs font-medium leading-relaxed break-words">{message}</p>
      </div>

      <button
        onClick={() => onDismiss(id)}
        className="flex-shrink-0 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-all cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Countdown progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-slate-800">
        <div
          className={`h-full transition-all duration-[16ms] linear ${getProgressColor()}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </motion.div>
  );
};
