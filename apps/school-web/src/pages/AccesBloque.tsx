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
        background: '#0f172a',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: '#1e293b',
          borderRadius: '1rem',
          border: '1px solid rgba(239,68,68,0.3)',
          padding: '2rem',
          color: '#e2e8f0',
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
            background: 'rgba(239,68,68,0.12)',
            color: '#ef4444',
            marginBottom: '1.25rem',
          }}
        >
          <AlertTriangle size={24} />
        </div>

        <h1 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 0.75rem' }}>{titre}</h1>
        <p style={{ lineHeight: 1.6, color: '#94a3b8', margin: '0 0 1.5rem' }}>{detail}</p>

        {blocage.message && info && (
          <p
            style={{
              fontSize: '0.85rem',
              color: '#64748b',
              background: 'rgba(148,163,184,0.08)',
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
              href="/dashboard"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.1rem',
                borderRadius: '0.6rem',
                background: '#4f46e5',
                color: '#fff',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.9rem',
              }}
            >
              <CreditCard size={16} /> Régulariser mon abonnement
            </a>
          )}

          <button
            onClick={() => window.location.reload()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.1rem',
              borderRadius: '0.6rem',
              background: 'rgba(148,163,184,0.12)',
              color: '#e2e8f0',
              border: '1px solid rgba(148,163,184,0.2)',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={16} /> Réessayer
          </button>

          <button
            onClick={seDeconnecter}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.1rem',
              borderRadius: '0.6rem',
              background: 'transparent',
              color: '#94a3b8',
              border: '1px solid rgba(148,163,184,0.2)',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            <LogOut size={16} /> Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
