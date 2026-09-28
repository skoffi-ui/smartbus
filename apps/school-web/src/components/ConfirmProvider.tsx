import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useI18n } from '../i18n';

/**
 * Remplace `confirm()`/`window.confirm()` par une boîte de dialogue stylée
 * (thème M3, voir design.md), à la place de la boîte native du navigateur.
 *
 * Usage : `const confirmer = useConfirm(); if (!(await confirmer('Sûr ?'))) return;`
 */
interface ConfirmOptions {
  titre?: string;
  libelleConfirmer?: string;
  libelleAnnuler?: string;
  /** Action destructrice (suppression...) : bouton de confirmation en rouge. */
  danger?: boolean;
}

type ConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [etat, setEtat] = useState<{ message: string; options: ConfirmOptions } | null>(null);
  const resolveRef = useRef<((valeur: boolean) => void) | null>(null);

  const confirmer: ConfirmFn = useCallback((message, options = {}) => {
    setEtat({ message, options });
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const repondre = useCallback((valeur: boolean) => {
    setEtat(null);
    resolveRef.current?.(valeur);
    resolveRef.current = null;
  }, []);

  useEffect(() => {
    if (!etat) return;
    const surEchap = (e: KeyboardEvent) => {
      if (e.key === 'Escape') repondre(false);
    };
    window.addEventListener('keydown', surEchap);
    return () => window.removeEventListener('keydown', surEchap);
  }, [etat, repondre]);

  return (
    <ConfirmContext.Provider value={confirmer}>
      {children}
      {etat && (
        <div
          className="animate-fade-in-soft"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3500,
            padding: '1rem',
          }}
          onClick={() => repondre(false)}
        >
          <div
            className="premium-modal"
            style={{ maxWidth: '420px', width: '100%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="premium-modal-header">
              <div
                className="premium-modal-icon"
                style={etat.options.danger ? { color: 'var(--danger)' } : undefined}
              >
                <AlertTriangle size={18} />
              </div>
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                {etat.options.titre || t('action.confirmation_titre')}
              </span>
            </div>
            <div className="premium-modal-body">
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                {etat.message}
              </p>
            </div>
            <div className="premium-modal-footer">
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => repondre(false)}>
                {etat.options.libelleAnnuler || t('action.annuler')}
              </button>
              <button
                className="btn"
                style={{
                  flex: 1,
                  background: etat.options.danger ? 'var(--danger-container)' : 'var(--accent-gradient)',
                  color: etat.options.danger ? '#fff' : 'var(--on-primary)',
                }}
                onClick={() => repondre(true)}
              >
                {etat.options.libelleConfirmer || t('action.confirmer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm() doit être utilisé sous <ConfirmProvider>');
  return ctx;
}
