import { useEffect, useState } from 'react';
import { Wifi, WifiOff, Server, RefreshCw } from 'lucide-react';
import api, { messageFromError } from '../services/api';

interface Config {
  organisationId: string;
  organisationName?: string;
  url: string;
  isActive: boolean;
}

interface Terminal {
  sn: string;
  alias: string;
  ipAddress: string;
  isOnline: boolean;
  lastActivity: string | null;
  fwVersion: string | null;
  pushVersion: string | null;
  platform: string | null;
}

export default function BiotimeTerminaux() {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [ecoleId, setEcoleId] = useState('');
  const [terminaux, setTerminaux] = useState<Terminal[]>([]);
  const [chargement, setChargement] = useState(true);
  const [chargementTerminaux, setChargementTerminaux] = useState(false);
  const [erreur, setErreur] = useState('');

  const chargerConfigs = async () => {
    setChargement(true);
    try {
      const res = await api.get('/biotime/configs');
      const liste = Array.isArray(res.data) ? res.data.filter((c: Config) => c.isActive) : [];
      setConfigs(liste);
      if (liste.length === 1) {
        setEcoleId(liste[0].organisationId);
      }
    } catch (err) {
      setErreur(messageFromError(err, 'Impossible de charger les configurations BioTime.'));
    } finally {
      setChargement(false);
    }
  };

  const chargerTerminaux = async (orgId: string) => {
    if (!orgId) { setTerminaux([]); return; }
    setChargementTerminaux(true);
    setErreur('');
    try {
      const res = await api.get(`/biotime/${orgId}/biotime-terminals`);
      setTerminaux(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setErreur(messageFromError(err, 'Impossible de lire les terminaux de cette école.'));
      setTerminaux([]);
    } finally {
      setChargementTerminaux(false);
    }
  };

  useEffect(() => { chargerConfigs(); }, []);
  useEffect(() => { if (ecoleId) chargerTerminaux(ecoleId); }, [ecoleId]);

  const enLigne = terminaux.filter((t) => t.isOnline).length;
  const horsLigne = terminaux.length - enLigne;

  if (chargement) {
    return <div className="text-center text-navy-300 py-10">Chargement…</div>;
  }

  return (
    <div className="animate-fade-in">
      <div className="glass-panel p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Supervision des Badgeuses</h1>
            <p className="text-navy-300 mt-1">
              État temps réel des terminaux biométriques depuis les serveurs BioTime
            </p>
          </div>
          <button
            onClick={() => chargerTerminaux(ecoleId)}
            disabled={!ecoleId || chargementTerminaux}
            className="btn-secondary flex items-center gap-2 disabled:opacity-40"
          >
            <RefreshCw size={16} className={chargementTerminaux ? 'animate-spin' : ''} />
            Rafraîchir
          </button>
        </div>

        {erreur && (
          <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            {erreur}
          </div>
        )}

        {/* Sélecteur d'école */}
        <div className="mb-6">
          <label className="form-label">École</label>
          <select
            value={ecoleId}
            onChange={(e) => setEcoleId(e.target.value)}
            className="form-input"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)' }}
          >
            <option value="" style={{ background: '#1e293b' }}>Sélectionner une école…</option>
            {configs.map((c) => (
              <option key={c.organisationId} value={c.organisationId} style={{ background: '#1e293b' }}>
                {c.organisationName ?? c.organisationId}
              </option>
            ))}
          </select>
        </div>

        {/* Indicateurs */}
        {ecoleId && !chargementTerminaux && terminaux.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
              <div className="text-3xl font-bold text-white">{terminaux.length}</div>
              <div className="text-sm text-navy-300 mt-1">Total terminaux</div>
            </div>
            <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20 text-center">
              <div className="text-3xl font-bold text-emerald-400">{enLigne}</div>
              <div className="text-sm text-emerald-300/70 mt-1">En ligne</div>
            </div>
            <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20 text-center">
              <div className="text-3xl font-bold text-red-400">{horsLigne}</div>
              <div className="text-sm text-red-300/70 mt-1">Hors ligne</div>
            </div>
          </div>
        )}

        {/* Table */}
        {chargementTerminaux ? (
          <div className="text-center text-navy-300 py-10">Interrogation du serveur BioTime…</div>
        ) : !ecoleId ? (
          <div className="text-center text-navy-400 py-10">
            Sélectionnez une école pour voir ses badgeuses.
          </div>
        ) : terminaux.length === 0 ? (
          <div className="text-center text-navy-400 py-10">
            Aucun terminal trouvé sur ce serveur BioTime.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-navy-300">
                  <th className="p-4 font-semibold">Statut</th>
                  <th className="p-4 font-semibold">N° série</th>
                  <th className="p-4 font-semibold">Nom</th>
                  <th className="p-4 font-semibold">Adresse IP</th>
                  <th className="p-4 font-semibold">Dernière activité</th>
                  <th className="p-4 font-semibold">Firmware</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {terminaux.map((t) => (
                  <tr key={t.sn} className="text-white hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      {t.isOnline ? (
                        <span className="flex items-center gap-2 text-emerald-400 font-medium text-sm">
                          <Wifi size={16} /> En ligne
                        </span>
                      ) : (
                        <span className="flex items-center gap-2 text-red-400 font-medium text-sm">
                          <WifiOff size={16} /> Hors ligne
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                          <Server size={14} />
                        </div>
                        <span className="font-mono text-sm">{t.sn}</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm">{t.alias || '—'}</td>
                    <td className="p-4 font-mono text-sm text-navy-300">{t.ipAddress || '—'}</td>
                    <td className="p-4 text-sm text-navy-300">
                      {t.lastActivity
                        ? new Date(t.lastActivity).toLocaleString('fr-FR')
                        : '—'}
                    </td>
                    <td className="p-4 text-sm text-navy-300">{t.fwVersion || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
