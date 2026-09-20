import { useEffect, useState } from 'react';
import { Server, Plug, CheckCircle, XCircle, RefreshCw, Save, Trash2 } from 'lucide-react';
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

interface Organisation {
  id: string;
  name: string;
  code: string;
}

/**
 * Serveurs BioTime des écoles.
 *
 * Chaque établissement héberge son propre serveur sur son réseau : l'URL et les
 * identifiants sont donc réglés école par école. Le mot de passe est chiffré côté
 * serveur et n'est jamais renvoyé à cette page.
 */
export default function BiotimeServeurs() {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<string, { ok: boolean; message: string }>>({});

  const [formulaire, setFormulaire] = useState({
    organisationId: '',
    url: '',
    username: '',
    password: '',
  });

  const charger = async () => {
    setChargement(true);
    setErreur('');
    try {
      const [c, o] = await Promise.all([
        api.get('/biotime/configs'),
        api.get('/organisations', { params: { limit: 200 } }),
      ]);
      setConfigs(Array.isArray(c.data) ? c.data : []);
      const liste = o.data?.data ?? o.data?.items ?? o.data ?? [];
      setOrganisations(Array.isArray(liste) ? liste : []);
    } catch (err) {
      setErreur(messageFromError(err, 'Impossible de charger les serveurs BioTime.'));
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    charger();
  }, []);

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formulaire.organisationId) return;
    setEnCours(formulaire.organisationId);
    try {
      await api.post(`/biotime/configs/${formulaire.organisationId}`, {
        url: formulaire.url,
        username: formulaire.username,
        ...(formulaire.password ? { password: formulaire.password } : {}),
      });
      setFormulaire({ organisationId: '', url: '', username: '', password: '' });
      await charger();
    } catch (err) {
      alert(messageFromError(err, "Impossible d'enregistrer ce serveur."));
    } finally {
      setEnCours(null);
    }
  };

  const tester = async (organisationId: string) => {
    setEnCours(organisationId);
    try {
      const res = await api.post(`/biotime/configs/${organisationId}/test`);
      setTests((prev) => ({ ...prev, [organisationId]: res.data }));
      await charger();
    } catch (err) {
      setTests((prev) => ({
        ...prev,
        [organisationId]: { ok: false, message: messageFromError(err, 'Test impossible.') },
      }));
    } finally {
      setEnCours(null);
    }
  };

  const synchroniser = async (organisationId: string) => {
    setEnCours(organisationId);
    try {
      await api.post(`/biotime/${organisationId}/sync-children`);
      await api.post(`/biotime/${organisationId}/sync-punches`);
      alert("Synchronisation mise en file pour cette école.");
    } catch (err) {
      alert(messageFromError(err, 'Synchronisation impossible.'));
    } finally {
      setEnCours(null);
    }
  };

  const supprimer = async (organisationId: string, nom?: string) => {
    if (!window.confirm(`Supprimer la configuration BioTime de « ${nom ?? organisationId} » ?`)) return;
    try {
      await api.delete(`/biotime/configs/${organisationId}`);
      await charger();
    } catch (err) {
      alert(messageFromError(err, 'Suppression impossible.'));
    }
  };

  const nonConfigurees = organisations.filter(
    (o) => !configs.some((c) => c.organisationId === o.id),
  );

  if (chargement) {
    return <div className="text-center text-navy-300 py-10">Chargement des serveurs BioTime...</div>;
  }

  return (
    <div className="animate-fade-in">
      <div className="glass-panel p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Serveurs BioTime</h1>
          <p className="text-navy-300 mt-1">
            Chaque école héberge son propre serveur biométrique. Renseignez ici son adresse
            et ses identifiants : ils sont chiffrés avant d'être stockés.
          </p>
        </div>

        {erreur && (
          <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            {erreur}
          </div>
        )}

        {/* Formulaire */}
        <form
          onSubmit={enregistrer}
          className="bg-white/5 p-6 rounded-2xl border border-white/10 mb-8 grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div className="md:col-span-2">
            <label className="form-label">École</label>
            <select
              required
              value={formulaire.organisationId}
              onChange={(e) => {
                const dejaConfig = configs.find((c) => c.organisationId === e.target.value);
                setFormulaire({
                  organisationId: e.target.value,
                  url: dejaConfig?.url ?? '',
                  username: dejaConfig?.username ?? '',
                  password: '',
                });
              }}
              className="form-input"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--text-primary)',
                border: '1px solid var(--glass-border)',
              }}
            >
              <option value="" style={{ background: '#1e293b' }}>
                Sélectionner une école…
              </option>
              {organisations.map((o) => (
                <option key={o.id} value={o.id} style={{ background: '#1e293b' }}>
                  {o.name} ({o.code})
                  {configs.some((c) => c.organisationId === o.id) ? ' — déjà configurée' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Adresse du serveur BioTime</label>
            <input
              required
              type="text"
              value={formulaire.url}
              onChange={(e) => setFormulaire({ ...formulaire, url: e.target.value })}
              className="form-input"
              placeholder="http://192.168.1.50:8080"
            />
          </div>

          <div>
            <label className="form-label">Utilisateur</label>
            <input
              required
              type="text"
              value={formulaire.username}
              onChange={(e) => setFormulaire({ ...formulaire, username: e.target.value })}
              className="form-input"
              placeholder="admin"
            />
          </div>

          <div className="md:col-span-2">
            <label className="form-label">
              Mot de passe{' '}
              <span className="text-navy-400 font-normal">
                — laisser vide pour conserver celui déjà enregistré
              </span>
            </label>
            <input
              type="password"
              value={formulaire.password}
              onChange={(e) => setFormulaire({ ...formulaire, password: e.target.value })}
              className="form-input"
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={enCours === formulaire.organisationId && !!formulaire.organisationId}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save size={18} /> Enregistrer ce serveur
            </button>
          </div>
        </form>

        {nonConfigurees.length > 0 && (
          <div className="mb-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-sm font-semibold">
            <Plug size={15} />
            {nonConfigurees.length} école{nonConfigurees.length > 1 ? 's' : ''} sans serveur BioTime
            <span className="font-normal text-amber-200/70">
              — aucun pointage ne peut en remonter
            </span>
          </div>
        )}

        {/* Liste */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-navy-300">
                <th className="p-4 font-semibold">École</th>
                <th className="p-4 font-semibold">Serveur</th>
                <th className="p-4 font-semibold">Dernière synchro</th>
                <th className="p-4 font-semibold">État</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {configs.map((c) => {
                const test = tests[c.organisationId];
                return (
                  <tr key={c.organisationId} className="text-white hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          <Server size={18} />
                        </div>
                        <div className="font-bold">{c.organisationName ?? c.organisationId}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">{c.url}</div>
                      <div className="text-xs text-navy-400">utilisateur : {c.username}</div>
                    </td>
                    <td className="p-4 text-sm text-navy-300">
                      {c.lastSyncedAt
                        ? `${new Date(c.lastSyncedAt).toLocaleString('fr-FR')}${
                            c.lastSyncCount !== null ? ` — ${c.lastSyncCount} élément(s)` : ''
                          }`
                        : 'Jamais'}
                    </td>
                    <td className="p-4">
                      {test ? (
                        <span
                          className={`flex items-center gap-1.5 text-sm font-medium ${
                            test.ok ? 'text-green-400' : 'text-red-400'
                          }`}
                          title={test.message}
                        >
                          {test.ok ? <CheckCircle size={16} /> : <XCircle size={16} />}
                          {test.message.slice(0, 40)}
                        </span>
                      ) : c.lastError ? (
                        <span
                          className="flex items-center gap-1.5 text-sm font-medium text-red-400"
                          title={c.lastError}
                        >
                          <XCircle size={16} /> {c.lastError.slice(0, 40)}
                        </span>
                      ) : (
                        <span className="text-sm text-navy-400">
                          {c.isActive ? 'Actif' : 'Désactivé'}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => tester(c.organisationId)}
                          disabled={enCours === c.organisationId}
                          className="p-2 hover:bg-indigo-500/10 text-indigo-400 rounded-lg transition-colors disabled:opacity-40"
                          title="Tester la connexion"
                        >
                          <Plug size={18} />
                        </button>
                        <button
                          onClick={() => synchroniser(c.organisationId)}
                          disabled={enCours === c.organisationId}
                          className="p-2 hover:bg-emerald-500/10 text-emerald-400 rounded-lg transition-colors disabled:opacity-40"
                          title="Synchroniser maintenant"
                        >
                          <RefreshCw size={18} />
                        </button>
                        <button
                          onClick={() => supprimer(c.organisationId, c.organisationName)}
                          className="p-2 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors"
                          title="Supprimer la configuration"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {configs.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-navy-400">
                    Aucun serveur BioTime configuré. Renseignez la première école ci-dessus.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
