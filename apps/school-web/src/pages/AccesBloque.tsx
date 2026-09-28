import { useEffect, useState } from 'react';
import { AlertTriangle, CreditCard, RefreshCw, LogOut } from 'lucide-react';
import { BLOCK_REASON_KEY, type GatewayErrorCode } from '../services/api';

interface Blocage {
  code: GatewayErrorCode | null;
  message: string;
}

/** Explication affichée selon la raison renvoyée par l'API Gateway. */
const EXPLICATIONS: Partial<Record<GatewayErrorCode, { titre: string; detail: string; action: 'paiement' | 'recharger' }>> = {
  TENANT_SUSPENDED: {
    titre: 'Établissement suspendu',
    detail:
      "L'accès à la gestion du transport est suspendu, généralement pour un abonnement échu. " +
      'Vos données sont conservées : elles redeviennent accessibles dès la régularisation.',
    action: 'paiement',
  },
  TENANT_INACTIVE: {
    titre: "Établissement pas encore activé",
    detail:
      "Votre établissement n'est pas encore activé. Finalisez la création de votre organisation " +
      'et la souscription à un forfait pour accéder à la plateforme.',
    action: 'paiement',
  },
  TENANT_NOT_FOUND: {
    titre: 'Établissement introuvable',
    detail:
      "Aucun établissement ne correspond à votre compte. Contactez l'assistance SMARTBUS.",
    action: 'recharger',
  },
  APP_UPDATE_REQUIRED: {
    titre: 'Mise à jour requise',
    detail:
      "Cette version de l'application est trop ancienne pour le serveur. Rechargez la page " +
      'pour récupérer la dernière version.',
    action: 'recharger',
  },
};

export default function AccesBloque() {
  const [blocage, setBlocage] = useState<Blocage>({ code: null, message: '' });

  useEffect(() => {
    try {
      const brut = sessionStorage.getItem(BLOCK_REASON_KEY);
      if (brut) setBlocage(JSON.parse(brut));
    } catch {
      // Navigation privée ou stockage vidé : on garde le message par défaut.
    }
  }, []);

  const info = blocage.code ? EXPLICATIONS[blocage.code] : undefined;
  const titre = info?.titre ?? 'Accès momentanément bloqué';
  const detail =
    info?.detail ??
    blocage.message ??
    "L'accès à votre établissement est actuellement bloqué. Contactez l'assistance SMARTBUS.";

  const seDeconnecter = () => {
    localStorage.removeItem('accessToken');
    try {
      sessionStorage.removeItem(BLOCK_REASON_KEY);
    } catch { /* stockage indisponible */ }
    window.location.href = '/login';
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        background: 'var(--bg-primary)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'var(--bg-secondary)',
          borderRadius: '1rem',
          border: '1px solid var(--danger-border-tint)',
          padding: '2rem',
          color: 'var(--text-primary)',
        }}
      >
        <div
          style={{
            width: '3rem',
            height: '3rem',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--danger-tint)',
            color: 'var(--danger)',
            marginBottom: '1.25rem',
          }}
        >
          <AlertTriangle size={24} />
        </div>

        <h1 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 0.75rem' }}>{titre}</h1>
        <p style={{ lineHeight: 1.6, color: 'var(--text-secondary)', margin: '0 0 1.5rem' }}>{detail}</p>

        {blocage.message && info && (
          <p
            style={{
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              background: 'var(--surface-variant)',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              margin: '0 0 1.5rem',
            }}
          >
            {blocage.message}
          </p>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          {info?.action === 'paiement' && (
            <a
              href="/abonnement"
              className="btn btn-primary"
              style={{ textDecoration: 'none', fontSize: '0.9rem' }}
            >
              <CreditCard size={16} /> Régulariser mon abonnement
            </a>
          )}

          <button
            onClick={() => window.location.reload()}
            className="btn btn-secondary"
            style={{ fontSize: '0.9rem' }}
          >
            <RefreshCw size={16} /> Réessayer
          </button>

          <button
            onClick={seDeconnecter}
            className="btn"
            style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--glass-border)', fontSize: '0.9rem' }}
          >
            <LogOut size={16} /> Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
