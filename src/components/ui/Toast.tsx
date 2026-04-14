import { useState, useCallback, createContext, useContext } from 'react';
import { CheckCircle, AlertCircle, Info, X, Shield } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export const useToast = () => useContext(ToastContext);

const ICONS: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

const STYLES: Record<ToastType, string> = {
  success: 'border-[#00FF88]/30 bg-[#00FF88]/[0.08] text-[#00FF88]',
  error: 'border-[#FF4444]/30 bg-[#FF4444]/[0.08] text-[#FF4444]',
  info: 'border-[#00F5FF]/30 bg-[#00F5FF]/[0.08] text-[#00F5FF]',
};

const SHIELD_ICONS: Record<ToastType, string> = {
  success: 'text-[#00FF88]',
  error: 'text-[#FF4444]',
  info: 'text-[#00F5FF]',
};

let _id = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = ++_id;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => {
          const Icon = ICONS[t.type];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-md animate-fade-in max-w-sm ${STYLES[t.type]}`}
            >
              <Shield className={`w-5 h-5 flex-shrink-0 ${SHIELD_ICONS[t.type]}`} />
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium text-white flex-1">{t.message}</span>
              <button onClick={() => remove(t.id)} className="text-white/40 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
