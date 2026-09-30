import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle, XCircle, Info } from 'lucide-react';

/**
 * Remplace `alert()` par une notification stylée (thème M3, voir design.md),
 * plutôt qu'une boîte de dialogue native du navigateur.
 */
type TypeToast = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  type: TypeToast;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const ICONES: Record<TypeToast, React.ComponentType<{ size?: number }>> = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
};

const STYLES: Record<TypeToast, { bg: string; border: string; color: string }> =
  {
    success: {
      bg: 'var(--success-tint)',
      border: 'var(--success-border-tint)',
      color: 'var(--success)',
    },
    error: {
      bg: 'var(--danger-tint)',
      border: 'var(--danger-border-tint)',
      color: 'var(--danger)',
    },
    info: {
      bg: 'var(--accent-tint)',
      border: 'var(--accent-border-tint)',
      color: 'var(--accent-primary)',
    },
  };

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const empiler = useCallback((type: TypeToast, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((toast) => toast.id !== id)),
      4500,
    );
  }, []);

  const api: ToastApi = {
    success: (message) => empiler('success', message),
    error: (message) => empiler('error', message),
    info: (message) => empiler('info', message),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          zIndex: 3000,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          maxWidth: 'min(380px, calc(100vw - 3rem))',
        }}
      >
        {toasts.map((toast) => {
          const Icone = ICONES[toast.type];
          const style = STYLES[toast.type];
          return (
            <div
              key={toast.id}
              className="glass-panel animate-slide-in"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
                padding: '0.85rem 1rem',
                background: style.bg,
                borderColor: style.border,
                color: style.color,
                fontSize: '0.875rem',
                fontWeight: 500,
                lineHeight: 1.4,
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <Icone size={18} />
              <span style={{ flex: 1 }}>{toast.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx)
    throw new Error('useToast() doit être utilisé sous <ToastProvider>');
  return ctx;
}
