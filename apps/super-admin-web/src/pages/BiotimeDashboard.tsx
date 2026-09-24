import { useEffect, useState, useCallback } from 'react';
import {
  Server,
  Wifi,
  WifiOff,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Activity,
  Clock,
  Cpu,
  Shield,
} from 'lucide-react';
import api, { messageFromError } from '../services/api';

interface Config {
  organisationId: string;
  organisationName?: string;
  url: string;
  username: string;
  isActive: boolean;
  lastSyncedAt: string | null;
  lastSyncCount: number | null;
  lastError: string | null;
  lastErrorAt: string | null;
}

interface Terminal {
  sn: string;
  alias: string;
  ipAddress: string;
  isOnline: boolean;
  lastActivity: string | null;
  fwVersion: string | null;
}

interface SchoolDiag {
  config: Config;
  connexionOk: boolean | null;
  connexionMessage: string;
  terminaux: Terminal[];
  loading: boolean;
}

export default function BiotimeDashboard() {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [diags, setDiags] = useState<Record<string, SchoolDiag>>({});
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState('');

  const chargerConfigs = useCallback(async () => {
    setLoading(true);
    setErreur('');
    try {
      const res = await api.get('/biotime/configs');
      const liste: Config[] = Array.isArray(res.data) ? res.data : [];
      setConfigs(liste);

      const initial: Record<string, SchoolDiag> = {};
      for (const c of liste) {
        initial[c.organisationId] = {
          config: c,
          connexionOk: null,
          connexionMessage: '',
          terminaux: [],
          loading: false,
        };
      }
      setDiags(initial);
    } catch (err) {
      setErreur(messageFromError(err, 'Impossible de charger les configurations BioTime.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    chargerConfigs();
  }, [chargerConfigs]);

  const diagnostiquer = async (organisationId: string) => {
    setDiags((prev) => ({
      ...prev,
      [organisationId]: { ...prev[organisationId], loading: true },
    }));

    let connexionOk: boolean | null = null;
    let connexionMessage = '';
    let terminaux: Terminal[] = [];

    try {
      const testRes = await api.post(`/biotime/configs/${organisationId}/test`);
      connexionOk = testRes.data?.ok ?? false;
      connexionMessage = testRes.data?.message ?? 'Test terminé';
    } catch (err) {
      connexionOk = false;
      connexionMessage = messageFromError(err, 'Serveur injoignable');
    }

    if (connexionOk) {
      try {
        const termRes = await api.get(`/biotime/${organisationId}/biotime-terminals`);
        terminaux = Array.isArray(termRes.data) ? termRes.data : [];
      } catch {
        terminaux = [];
      }
    }

    setDiags((prev) => ({
      ...prev,
      [organisationId]: {
        ...prev[organisationId],
        connexionOk,
        connexionMessage,
        terminaux,
        loading: false,
      },
    }));
  };

  const diagnostiquerTout = async () => {
    for (const c of configs) {
      diagnostiquer(c.organisationId);
    }
  };

  const totalTerminaux = Object.values(diags).reduce((s, d) => s + d.terminaux.length, 0);
  const totalEnLigne = Object.values(diags).reduce(
    (s, d) => s + d.terminaux.filter((t) => t.isOnline).length,
    0,
  );
  const totalHorsLigne = totalTerminaux - totalEnLigne;
  const serveursOk = Object.values(diags).filter((d) => d.connexionOk === true).length;
  const serveursKo = Object.values(diags).filter((d) => d.connexionOk === false).length;

  if (loading) {
    return <div className="text-center text-navy-300 py-10">Chargement des configurations BioTime...</div>;
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Supervision BioTime</h1>
          <p className="text-navy-300 mt-1">
            Diagnostic infrastructure : connectivite des serveurs et etat des badgeuses par ecole.
          </p>
        </div>
        <button
          onClick={diagnostiquerTout}
          disabled={configs.length === 0}
          className="btn-primary flex items-center gap-2 disabled:opacity-40"
        >
          <Activity size={18} />
          Diagnostiquer tout
        </button>
      </div>

      {erreur && (
        <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          {erreur}
        </div>
      )}

      {configs.length === 0 ? (
        <div className="glass-panel p-10 text-center">
          <Server size={48} className="mx-auto mb-4" style={{ color: 'var(--text-secondary)', opacity: 0.5 }} />
          <p style={{ color: 'var(--text-secondary)' }}>
            Aucun serveur BioTime configure. Rendez-vous sur{' '}
            <a href="/biotime-serveurs" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>
              Serveurs BioTime
            </a>{' '}
            pour ajouter une ecole.
          </p>
        </div>
      ) : (
        <>
          {/* Indicateurs globaux */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard
              icon={<Server size={22} />}
              label="Serveurs configures"
              value={configs.length}
              color="var(--accent-primary)"
              bgColor="var(--accent-primary)"
            />
            <StatCard
              icon={<CheckCircle size={22} />}
              label="Serveurs OK"
              value={serveursOk}
              color="var(--success)"
              bgColor="var(--success)"
              muted={serveursOk === 0}
            />
            <StatCard
              icon={<Wifi size={22} />}
              label="Badgeuses en ligne"
              value={totalEnLigne}
              color="var(--success)"
              bgColor="var(--success)"
              muted={totalEnLigne === 0}
            />
            <StatCard
              icon={<WifiOff size={22} />}
              label="Badgeuses hors ligne"
              value={totalHorsLigne}
              color="var(--danger)"
              bgColor="var(--danger)"
              muted={totalHorsLigne === 0}
            />
          </div>

          {/* Alerte serveurs en erreur */}
          {serveursKo > 0 && (
            <div className="mb-6 flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium"
              style={{ background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.25)', color: 'var(--danger)' }}>
              <AlertTriangle size={18} />
              {serveursKo} serveur{serveursKo > 1 ? 's' : ''} injoignable{serveursKo > 1 ? 's' : ''} — verifiez la connectivite reseau.
            </div>
          )}

          {/* Cartes par ecole */}
          <div className="flex flex-col gap-4">
            {configs.map((config) => {
              const diag = diags[config.organisationId];
              if (!diag) return null;
              return (
                <SchoolCard
                  key={config.organisationId}
                  diag={diag}
                  onDiagnostiquer={() => diagnostiquer(config.organisationId)}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  bgColor,
  muted,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  bgColor: string;
  muted?: boolean;
}) {
  return (
    <div className="glass-panel flex items-center gap-3" style={{ padding: '1rem' }}>
      <div
        style={{
          width: '2.75rem',
          height: '2.75rem',
          borderRadius: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `color-mix(in srgb, ${bgColor} 15%, transparent)`,
          color: muted ? 'var(--text-secondary)' : color,
          opacity: muted ? 0.5 : 1,
        }}
      >
        {icon}
      </div>
      <div>
        <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</div>
        <div className="text-xl font-bold" style={{ color: muted ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
          {value}
        </div>
      </div>
    </div>
  );
}

function SchoolCard({ diag, onDiagnostiquer }: { diag: SchoolDiag; onDiagnostiquer: () => void }) {
  const { config, connexionOk, connexionMessage, terminaux, loading } = diag;
  const enLigne = terminaux.filter((t) => t.isOnline).length;
  const horsLigne = terminaux.length - enLigne;

  const statusIcon =
    connexionOk === null ? (
      <div
        className="flex items-center justify-center"
        style={{
          width: '2.5rem',
          height: '2.5rem',
          borderRadius: '0.75rem',
          background: 'var(--surface-wash)',
          color: 'var(--text-secondary)',
        }}
      >
        <Server size={20} />
      </div>
    ) : connexionOk ? (
      <div
        className="flex items-center justify-center"
        style={{
          width: '2.5rem',
          height: '2.5rem',
          borderRadius: '0.75rem',
          background: 'color-mix(in srgb, var(--success) 15%, transparent)',
          color: 'var(--success)',
        }}
      >
        <CheckCircle size={20} />
      </div>
    ) : (
      <div
        className="flex items-center justify-center"
        style={{
          width: '2.5rem',
          height: '2.5rem',
          borderRadius: '0.75rem',
          background: 'color-mix(in srgb, var(--danger) 15%, transparent)',
          color: 'var(--danger)',
        }}
      >
        <XCircle size={20} />
      </div>
    );

  return (
    <div className="glass-panel" style={{ overflow: 'hidden' }}>
      {/* En-tete ecole */}
      <div className="flex items-center justify-between" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--glass-border)' }}>
        <div className="flex items-center gap-3">
          {statusIcon}
          <div>
            <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
              {config.organisationName ?? config.organisationId}
            </h3>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{config.url}</span>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                — {config.username}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {connexionOk !== null && (
            <span
              className="text-xs font-medium px-2.5 py-1 rounded-full"
              style={{
                background: connexionOk
                  ? 'color-mix(in srgb, var(--success) 15%, transparent)'
                  : 'color-mix(in srgb, var(--danger) 15%, transparent)',
                color: connexionOk ? 'var(--success)' : 'var(--danger)',
              }}
            >
              {connexionOk ? 'Connecte' : 'Injoignable'}
            </span>
          )}
          {!config.isActive && (
            <span
              className="text-xs font-medium px-2.5 py-1 rounded-full"
              style={{
                background: 'color-mix(in srgb, var(--warning) 15%, transparent)',
                color: 'var(--warning)',
              }}
            >
              Desactive
            </span>
          )}
          <button
            onClick={onDiagnostiquer}
            disabled={loading}
            className="btn-secondary flex items-center gap-2 disabled:opacity-40"
            style={{ minHeight: '36px', padding: '0.4rem 1rem', fontSize: '0.8rem' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {connexionOk === null ? 'Tester' : 'Re-tester'}
          </button>
        </div>
      </div>

      {/* Message de connexion */}
      {connexionMessage && (
        <div
          className="text-xs px-6 py-2 flex items-center gap-2"
          style={{
            borderBottom: '1px solid var(--glass-border)',
            color: connexionOk ? 'var(--success)' : connexionOk === false ? 'var(--danger)' : 'var(--text-secondary)',
            background: 'var(--surface-wash)',
          }}
        >
          <Shield size={12} />
          {connexionMessage}
        </div>
      )}

      {/* Derniere synchro */}
      {config.lastSyncedAt && (
        <div
          className="text-xs px-6 py-2 flex items-center gap-2"
          style={{
            borderBottom: terminaux.length > 0 ? '1px solid var(--glass-border)' : 'none',
            color: 'var(--text-secondary)',
            background: 'var(--surface-wash)',
          }}
        >
          <Clock size={12} />
          Derniere synchro : {new Date(config.lastSyncedAt).toLocaleString('fr-FR')}
          {config.lastSyncCount !== null && ` — ${config.lastSyncCount} element(s)`}
        </div>
      )}

      {/* Erreur stockee */}
      {config.lastError && !connexionMessage && (
        <div
          className="text-xs px-6 py-2 flex items-center gap-2"
          style={{
            borderBottom: terminaux.length > 0 ? '1px solid var(--glass-border)' : 'none',
            color: 'var(--danger)',
            background: 'color-mix(in srgb, var(--danger) 5%, transparent)',
          }}
        >
          <AlertTriangle size={12} />
          {config.lastError}
          {config.lastErrorAt && (
            <span style={{ color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
              ({new Date(config.lastErrorAt).toLocaleString('fr-FR')})
            </span>
          )}
        </div>
      )}

      {/* Terminaux */}
      {connexionOk && terminaux.length > 0 && (
        <div style={{ padding: '1rem 1.5rem' }}>
          {/* Resume badgeuses */}
          <div className="flex items-center gap-4 mb-3">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {terminaux.length} badgeuse{terminaux.length > 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--success)' }}>
              <Wifi size={12} /> {enLigne} en ligne
            </span>
            {horsLigne > 0 && (
              <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--danger)' }}>
                <WifiOff size={12} /> {horsLigne} hors ligne
              </span>
            )}
          </div>

          {/* Liste des terminaux */}
          <div className="grid gap-2">
            {terminaux.map((t) => (
              <div
                key={t.sn}
                className="flex items-center gap-3"
                style={{
                  padding: '0.6rem 0.75rem',
                  borderRadius: '0.5rem',
                  background: 'var(--surface-wash)',
                  border: '1px solid var(--glass-border)',
                }}
              >
                {/* Indicateur status */}
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: t.isOnline ? 'var(--success)' : 'var(--danger)',
                    boxShadow: t.isOnline ? '0 0 6px var(--success)' : 'none',
                  }}
                />

                {/* Info terminal */}
                <Cpu size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                <span className="font-mono text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  {t.sn}
                </span>
                {t.alias && (
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {t.alias}
                  </span>
                )}

                <div style={{ flex: 1 }} />

                {/* IP */}
                {t.ipAddress && (
                  <span className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {t.ipAddress}
                  </span>
                )}

                {/* Derniere activite */}
                {t.lastActivity && (
                  <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                    <Clock size={10} />
                    {new Date(t.lastActivity).toLocaleString('fr-FR')}
                  </span>
                )}

                {/* Firmware */}
                {t.fwVersion && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--surface-wash-strong)', color: 'var(--text-secondary)', fontSize: '0.65rem' }}
                  >
                    FW {t.fwVersion}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connexion OK mais aucun terminal */}
      {connexionOk && terminaux.length === 0 && (
        <div className="text-center py-6" style={{ color: 'var(--text-secondary)' }}>
          <Cpu size={24} className="mx-auto mb-2" style={{ opacity: 0.4 }} />
          <p className="text-sm">Serveur connecte — aucun terminal enregistre</p>
        </div>
      )}

      {/* En cours de diagnostic */}
      {loading && (
        <div className="text-center py-6" style={{ color: 'var(--text-secondary)' }}>
          <RefreshCw size={20} className="mx-auto mb-2 animate-spin" />
          <p className="text-sm">Diagnostic en cours...</p>
        </div>
      )}
    </div>
  );
}
