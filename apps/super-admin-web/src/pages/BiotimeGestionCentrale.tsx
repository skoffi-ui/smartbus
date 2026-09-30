import { useEffect, useState } from 'react';
import {
  Server,
  Building2,
  Wifi,
  RefreshCw,
  Plus,
  Link as LinkIcon,
  Unlink,
  AlertCircle,
  CheckCircle2,
  Search,
} from 'lucide-react';
import api, { messageFromError } from '../services/api';
import { useConfirm } from '../components/ConfirmProvider';

interface Organisation {
  id: string;
  name: string;
  code: string;
  biotimeDepartmentId: number | null;
  biotimeDepartmentName: string | null;
}

interface Terminal {
  id: string;
  serialNumber: string;
  terminalName: string;
  biotimeTerminalId: number | null;
  ipAddress: string | null;
  model: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR';
  organisationId: string | null;
  organisation?: {
    id: string;
    name: string;
    code: string;
  };
  createdAt: string;
}

export default function BiotimeGestionCentrale() {
  const confirmer = useConfirm();
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [terminaux, setTerminaux] = useState<Terminal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'departments' | 'terminals'>(
    'departments',
  );
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [showCreateDeptModal, setShowCreateDeptModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedOrgForDept, setSelectedOrgForDept] = useState('');
  const [selectedTerminal, setSelectedTerminal] = useState<Terminal | null>(
    null,
  );
  const [selectedOrgForAssign, setSelectedOrgForAssign] = useState('');
  const [terminalName, setTerminalName] = useState('');

  const chargerDonnees = async () => {
    setLoading(true);
    setError('');
    try {
      // Ces deux-là viennent de notre base (via /organisations et la table
      // biotime_terminals) — jamais du vrai serveur BioTime. Contrairement à
      // avant, un serveur BioTime injoignable ne doit plus empêcher d'afficher
      // les écoles et les terminaux déjà connus localement.
      //
      // /organisations est paginé (PaginationResponseDto : { data, total, page,
      // limit }, jamais un tableau brut) — `Array.isArray(orgsRes.data)` était
      // donc toujours faux et "Total organisations" affichait 0 quel que soit
      // le vrai total. `limit: 100` (le maximum accepté par l'API) pour que
      // cette page, qui doit voir TOUTES les écoles, ne se limite pas aux 10
      // premières par défaut.
      const [orgsRes, termsRes] = await Promise.all([
        api.get('/organisations', { params: { limit: 100 } }),
        api.get('/admin/biotime/terminals'),
      ]);
      setOrganisations(
        Array.isArray(orgsRes.data?.data) ? orgsRes.data.data : [],
      );
      setTerminaux(Array.isArray(termsRes.data) ? termsRes.data : []);
    } catch (err) {
      setError(messageFromError(err, 'Impossible de charger les données.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chargerDonnees();
  }, []);

  const creerDepartement = async () => {
    if (!selectedOrgForDept) return;
    setError('');
    setSuccess('');
    try {
      await api.post('/admin/biotime/departments/create', {
        organisationId: selectedOrgForDept,
      });
      setSuccess('Département BioTime créé avec succès !');
      setShowCreateDeptModal(false);
      setSelectedOrgForDept('');
      chargerDonnees();
    } catch (err) {
      setError(messageFromError(err, 'Échec de la création du département.'));
    }
  };

  const syncTerminaux = async () => {
    setError('');
    setSuccess('');
    try {
      const res = await api.post('/admin/biotime/terminals/sync');
      setSuccess(
        `Synchronisation réussie : ${res.data.synced} terminaux synchronisés.`,
      );
      chargerDonnees();
    } catch (err) {
      setError(
        messageFromError(err, 'Échec de la synchronisation des terminaux.'),
      );
    }
  };

  const assignerTerminal = async () => {
    if (!selectedTerminal || !selectedOrgForAssign) return;
    setError('');
    setSuccess('');
    try {
      await api.post('/admin/biotime/terminals/assign', {
        serialNumber: selectedTerminal.serialNumber,
        organisationId: selectedOrgForAssign,
        terminalName: terminalName || undefined,
      });
      setSuccess(
        `Terminal ${selectedTerminal.serialNumber} assigné avec succès !`,
      );
      setShowAssignModal(false);
      setSelectedTerminal(null);
      setSelectedOrgForAssign('');
      setTerminalName('');
      chargerDonnees();
    } catch (err) {
      setError(messageFromError(err, "Échec de l'assignation du terminal."));
    }
  };

  const desassignerTerminal = async (terminalId: string) => {
    if (
      !(await confirmer('Êtes-vous sûr de vouloir désassigner ce terminal ?', {
        danger: true,
      }))
    )
      return;
    setError('');
    setSuccess('');
    try {
      await api.delete(`/admin/biotime/terminals/${terminalId}/unassign`);
      setSuccess('Terminal désassigné avec succès !');
      chargerDonnees();
    } catch (err) {
      setError(messageFromError(err, 'Échec de la désassignation.'));
    }
  };

  const organisationsSansDepartement = organisations.filter(
    (org) => !org.biotimeDepartmentId,
  );
  const terminauxDisponibles = terminaux.filter((t) => !t.organisationId);
  const terminauxAssignes = terminaux.filter((t) => t.organisationId);

  const filteredOrgs = organisations.filter(
    (org) =>
      org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.code.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (loading) {
    return <div className="text-center text-navy-300 py-10">Chargement…</div>;
  }

  return (
    <div className="animate-fade-in">
      <div className="glass-panel p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Gestion BioTime Centralisée
            </h1>
            <p className="text-navy-300 mt-1">
              Un serveur BioTime pour toutes les écoles • Départements et
              terminaux
            </p>
          </div>
          <button
            onClick={chargerDonnees}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Actualiser
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 flex items-start gap-3">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-start gap-3">
            <CheckCircle2 size={20} className="shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-white/10">
          <button
            onClick={() => setActiveTab('departments')}
            className={`pb-3 px-4 font-semibold transition-colors relative ${
              activeTab === 'departments'
                ? 'text-indigo-400'
                : 'text-navy-300 hover:text-white'
            }`}
          >
            Départements
            {activeTab === 'departments' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-400" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('terminals')}
            className={`pb-3 px-4 font-semibold transition-colors relative ${
              activeTab === 'terminals'
                ? 'text-indigo-400'
                : 'text-navy-300 hover:text-white'
            }`}
          >
            Terminaux
            {activeTab === 'terminals' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-400" />
            )}
          </button>
        </div>

        {/* Tab: Départements */}
        {activeTab === 'departments' && (
          <div>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="text-3xl font-bold text-white">
                  {organisations.length}
                </div>
                <div className="text-sm text-navy-300 mt-1">
                  Total organisations
                </div>
              </div>
              <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20">
                <div className="text-3xl font-bold text-emerald-400">
                  {organisations.filter((o) => o.biotimeDepartmentId).length}
                </div>
                <div className="text-sm text-emerald-300/70 mt-1">
                  Avec département
                </div>
              </div>
              <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/20">
                <div className="text-3xl font-bold text-amber-400">
                  {organisationsSansDepartement.length}
                </div>
                <div className="text-sm text-amber-300/70 mt-1">
                  Sans département
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between mb-6">
              <div className="relative flex-1 max-w-md">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Rechercher une organisation…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="form-input pl-10 w-full"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--glass-border)',
                  }}
                />
              </div>
              {organisationsSansDepartement.length > 0 && (
                <button
                  onClick={() => setShowCreateDeptModal(true)}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus size={16} />
                  Créer un département
                </button>
              )}
            </div>

            {/* Liste organisations */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-navy-300">
                    <th className="p-4 font-semibold">Statut</th>
                    <th className="p-4 font-semibold">Organisation</th>
                    <th className="p-4 font-semibold">Code</th>
                    <th className="p-4 font-semibold">Département BioTime</th>
                    <th className="p-4 font-semibold">ID Département</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredOrgs.map((org) => (
                    <tr
                      key={org.id}
                      className="text-white hover:bg-white/5 transition-colors"
                    >
                      <td className="p-4">
                        {org.biotimeDepartmentId ? (
                          <span className="flex items-center gap-2 text-emerald-400 font-medium text-sm">
                            <CheckCircle2 size={16} /> Configuré
                          </span>
                        ) : (
                          <span className="flex items-center gap-2 text-amber-400 font-medium text-sm">
                            <AlertCircle size={16} /> Non configuré
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                            <Building2 size={14} />
                          </div>
                          <span className="font-semibold">{org.name}</span>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-sm text-navy-300">
                        {org.code}
                      </td>
                      <td className="p-4 text-sm">
                        {org.biotimeDepartmentName || (
                          <span className="text-navy-400">—</span>
                        )}
                      </td>
                      <td className="p-4 font-mono text-sm text-navy-300">
                        {org.biotimeDepartmentId || (
                          <span className="text-navy-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab: Terminaux */}
        {activeTab === 'terminals' && (
          <div>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="text-3xl font-bold text-white">
                  {terminaux.length}
                </div>
                <div className="text-sm text-navy-300 mt-1">
                  Total terminaux
                </div>
              </div>
              <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20">
                <div className="text-3xl font-bold text-emerald-400">
                  {terminauxDisponibles.length}
                </div>
                <div className="text-sm text-emerald-300/70 mt-1">
                  Disponibles
                </div>
              </div>
              <div className="bg-indigo-500/10 rounded-xl p-4 border border-indigo-500/20">
                <div className="text-3xl font-bold text-indigo-400">
                  {terminauxAssignes.length}
                </div>
                <div className="text-sm text-indigo-300/70 mt-1">Assignés</div>
              </div>
            </div>

            {/* Actions */}
            <div className="mb-6">
              <button
                onClick={syncTerminaux}
                className="btn-secondary flex items-center gap-2"
              >
                <RefreshCw size={16} />
                Synchroniser depuis BioTime
              </button>
            </div>

            {/* Terminaux disponibles */}
            <div className="mb-8">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Wifi size={20} className="text-emerald-400" />
                Terminaux disponibles ({terminauxDisponibles.length})
              </h3>
              {terminauxDisponibles.length === 0 ? (
                <div className="text-center text-navy-400 py-8">
                  Aucun terminal disponible. Synchronisez depuis BioTime pour en
                  voir.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {terminauxDisponibles.map((t) => (
                    <div
                      key={t.id}
                      className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-indigo-500/30 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20">
                            <Server size={18} className="text-emerald-400" />
                          </div>
                          <div>
                            <div className="font-mono text-sm font-semibold text-white">
                              {t.serialNumber}
                            </div>
                            <div className="text-xs text-navy-300">
                              {t.terminalName}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1 text-sm text-navy-300 mb-4">
                        <div>IP: {t.ipAddress || '—'}</div>
                        <div>Modèle: {t.model || '—'}</div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedTerminal(t);
                          setTerminalName(t.terminalName);
                          setShowAssignModal(true);
                        }}
                        className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
                      >
                        <LinkIcon size={14} />
                        Assigner à une école
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Terminaux assignés */}
            <div>
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <LinkIcon size={20} className="text-indigo-400" />
                Terminaux assignés ({terminauxAssignes.length})
              </h3>
              {terminauxAssignes.length === 0 ? (
                <div className="text-center text-navy-400 py-8">
                  Aucun terminal assigné.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-navy-300">
                        <th className="p-4 font-semibold">N° série</th>
                        <th className="p-4 font-semibold">Nom</th>
                        <th className="p-4 font-semibold">IP</th>
                        <th className="p-4 font-semibold">Organisation</th>
                        <th className="p-4 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {terminauxAssignes.map((t) => (
                        <tr
                          key={t.id}
                          className="text-white hover:bg-white/5 transition-colors"
                        >
                          <td className="p-4 font-mono text-sm">
                            {t.serialNumber}
                          </td>
                          <td className="p-4 text-sm">{t.terminalName}</td>
                          <td className="p-4 font-mono text-sm text-navy-300">
                            {t.ipAddress || '—'}
                          </td>
                          <td className="p-4 text-sm">
                            {t.organisation ? (
                              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                                <Building2 size={14} />
                                {t.organisation.name}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="p-4">
                            <button
                              onClick={() => desassignerTerminal(t.id)}
                              className="text-red-400 hover:text-red-300 flex items-center gap-2 text-sm"
                            >
                              <Unlink size={14} />
                              Désassigner
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal: Créer département */}
      {showCreateDeptModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-panel p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">
              Créer un département BioTime
            </h3>
            <p className="text-navy-300 text-sm mb-6">
              Sélectionnez l'organisation pour laquelle créer un département sur
              le serveur BioTime central.
            </p>
            <div className="mb-6">
              <label className="form-label">Organisation</label>
              <select
                value={selectedOrgForDept}
                onChange={(e) => setSelectedOrgForDept(e.target.value)}
                className="form-input"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--glass-border)',
                }}
              >
                <option value="" style={{ background: '#1e293b' }}>
                  Sélectionner une organisation…
                </option>
                {organisationsSansDepartement.map((org) => (
                  <option
                    key={org.id}
                    value={org.id}
                    style={{ background: '#1e293b' }}
                  >
                    {org.name} ({org.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCreateDeptModal(false);
                  setSelectedOrgForDept('');
                }}
                className="btn-secondary flex-1"
              >
                Annuler
              </button>
              <button
                onClick={creerDepartement}
                disabled={!selectedOrgForDept}
                className="btn-primary flex-1 disabled:opacity-40"
              >
                Créer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Assigner terminal */}
      {showAssignModal && selectedTerminal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-panel p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">
              Assigner un terminal
            </h3>
            <p className="text-navy-300 text-sm mb-6">
              Terminal :{' '}
              <span className="font-mono font-semibold">
                {selectedTerminal.serialNumber}
              </span>
            </p>
            <div className="space-y-4 mb-6">
              <div>
                <label className="form-label">Organisation</label>
                <select
                  value={selectedOrgForAssign}
                  onChange={(e) => setSelectedOrgForAssign(e.target.value)}
                  className="form-input"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--glass-border)',
                  }}
                >
                  <option value="" style={{ background: '#1e293b' }}>
                    Sélectionner une organisation…
                  </option>
                  {organisations.map((org) => (
                    <option
                      key={org.id}
                      value={org.id}
                      style={{ background: '#1e293b' }}
                    >
                      {org.name} ({org.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">
                  Nom personnalisé (optionnel)
                </label>
                <input
                  type="text"
                  value={terminalName}
                  onChange={(e) => setTerminalName(e.target.value)}
                  placeholder="Ex: Badgeuse Bus 1"
                  className="form-input"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--glass-border)',
                  }}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedTerminal(null);
                  setSelectedOrgForAssign('');
                  setTerminalName('');
                }}
                className="btn-secondary flex-1"
              >
                Annuler
              </button>
              <button
                onClick={assignerTerminal}
                disabled={!selectedOrgForAssign}
                className="btn-primary flex-1 disabled:opacity-40"
              >
                Assigner
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
