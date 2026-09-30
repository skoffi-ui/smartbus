import { useEffect, useState } from 'react';
import { ShieldCheck, Users } from 'lucide-react';

interface Organisation {
  id: string;
  name: string;
  code: string;
  email: string;
  status: string;
  dbProvisioned: boolean;
  createdAt: string;
  subscriptions?: any[];
  allowedFeatures?: string[] | null;
  allowAdditionalDirectors?: boolean;
}

import api, { messageFromError } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useConfirm } from '../components/ConfirmProvider';
import {
  SCHOOL_FEATURES,
  SCHOOL_FEATURE_LABELS,
} from '../constants/schoolFeatures';

/**
 * Liste et gestion des écoles clientes : accès aux fonctionnalités, droit de
 * gérer une équipe de directeurs, suspension et suppression.
 *
 * Séparé du Dashboard (qui se limite aux statistiques globales, agrégées et
 * par école) — ces actions de gestion ne sont pas des indicateurs à lire
 * d'un coup d'œil, elles engagent une action sur une école précise.
 */
export default function Ecoles() {
  const toast = useToast();
  const confirmer = useConfirm();
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [orgPourAcces, setOrgPourAcces] = useState<Organisation | null>(null);
  const [featuresSelectionnees, setFeaturesSelectionnees] = useState<string[]>(
    [],
  );
  const [toutAutoriser, setToutAutoriser] = useState(true);
  const [enregistrementAcces, setEnregistrementAcces] = useState(false);

  // Autorisation "cette école peut créer des comptes directeur
  // supplémentaires" (voir Organisation.allowAdditionalDirectors, accordée
  // école par école — les écoles elles-mêmes sont désormais créées par les
  // directeurs eux-mêmes, voir CreerMonEcole.tsx côté school-web, pas depuis
  // ici).
  const [orgPourEquipe, setOrgPourEquipe] = useState<Organisation | null>(null);
  const [autoriserEquipe, setAutoriserEquipe] = useState(false);
  const [enregistrementEquipe, setEnregistrementEquipe] = useState(false);

  const fetchOrganisations = async () => {
    try {
      // L'API renvoie un objet PaginationResponseDto { data, total, page, limit }
      // (défaut 10 par page) — cette liste doit voir TOUTES les écoles, donc
      // `limit: 100` (le maximum accepté) plutôt que de se limiter aux 10 premières.
      const response = await api.get('/organisations', {
        params: { limit: 100 },
      });
      setOrganisations(response.data.data);
    } catch (err: any) {
      if (err.response?.status === 401) {
        handleLogout();
      } else {
        setError(
          messageFromError(
            err,
            'Erreur lors du chargement des écoles clientes.',
          ),
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganisations();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
  };

  const handleStatusToggle = async (id: string, currentStatus: string) => {
    try {
      const action = currentStatus === 'suspended' ? 'activate' : 'suspend';
      await api.patch(`/organisations/${id}/${action}`, {});
      fetchOrganisations(); // Recharge la liste après modification
    } catch (err) {
      toast.error(
        messageFromError(err, 'Action non autorisée ou erreur serveur.'),
      );
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmer(
      'Toutes ses données seront définitivement effacées !',
      { titre: '⚠️ DANGER : Supprimer cette école ?', danger: true },
    );
    if (!ok) return;

    try {
      await api.delete(`/organisations/${id}`);
      fetchOrganisations();
    } catch (err) {
      toast.error(messageFromError(err, 'Erreur lors de la suppression.'));
    }
  };

  const ouvrirAcces = (org: Organisation) => {
    setOrgPourAcces(org);
    setToutAutoriser(!org.allowedFeatures);
    setFeaturesSelectionnees(org.allowedFeatures ?? [...SCHOOL_FEATURES]);
  };

  const basculerFeature = (feature: string) => {
    setFeaturesSelectionnees((prev) =>
      prev.includes(feature)
        ? prev.filter((f) => f !== feature)
        : [...prev, feature],
    );
  };

  const enregistrerAcces = async () => {
    if (!orgPourAcces) return;
    setEnregistrementAcces(true);
    try {
      await api.patch(`/organisations/${orgPourAcces.id}`, {
        allowedFeatures: toutAutoriser ? null : featuresSelectionnees,
      });
      toast.success(`Accès mis à jour pour ${orgPourAcces.name}.`);
      setOrgPourAcces(null);
      fetchOrganisations();
    } catch (err) {
      toast.error(
        messageFromError(err, 'Erreur lors de la mise à jour des accès.'),
      );
    } finally {
      setEnregistrementAcces(false);
    }
  };

  const ouvrirEquipe = (org: Organisation) => {
    setOrgPourEquipe(org);
    setAutoriserEquipe(!!org.allowAdditionalDirectors);
  };

  const enregistrerEquipe = async () => {
    if (!orgPourEquipe) return;
    setEnregistrementEquipe(true);
    try {
      await api.patch(`/organisations/${orgPourEquipe.id}`, {
        allowAdditionalDirectors: autoriserEquipe,
      });
      toast.success(
        `Droit de gestion d'équipe mis à jour pour ${orgPourEquipe.name}.`,
      );
      setOrgPourEquipe(null);
      fetchOrganisations();
    } catch (err) {
      toast.error(messageFromError(err, 'Erreur lors de la mise à jour.'));
    } finally {
      setEnregistrementEquipe(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="glass-panel p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">
            Liste des Écoles Clientes
          </h2>
          <div className="text-sm text-navy-300 font-medium">
            {organisations.length} établissement(s)
          </div>
        </div>
        {/* Plus de bouton "Créer une école" ici : un directeur s'inscrit lui-même
            (voir CandidatureDirecteur.tsx), est activé ci-dessous puis crée son
            école lui-même une fois connecté (voir CreerMonEcole.tsx). */}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center text-navy-300 py-10">
            Connexion à la base de données centrale...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-navy-300">
                  <th className="p-4 font-semibold">Code</th>
                  <th className="p-4 font-semibold">Nom de l'école</th>
                  <th className="p-4 font-semibold">Email Contact</th>
                  <th className="p-4 font-semibold">Date d'inscription</th>
                  <th className="p-4 font-semibold">Statut</th>
                  <th className="p-4 font-semibold">Abonnement</th>
                  <th className="p-4 font-semibold">BDD Isolée</th>
                  <th className="p-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {organisations.map((org) => (
                  <tr
                    key={org.id}
                    className="hover:bg-white/5 transition-colors"
                  >
                    <td className="p-4">
                      <strong className="text-brand-400 font-mono">
                        {org.code}
                      </strong>
                    </td>
                    <td className="p-4 font-bold text-white">{org.name}</td>
                    <td className="p-4 text-navy-300">{org.email}</td>
                    <td className="p-4 text-sm text-navy-300">
                      {new Date(org.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          org.status === 'active'
                            ? 'bg-green-500/20 text-green-400'
                            : org.status === 'suspended'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                        }`}
                      >
                        {org.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4">
                      {(() => {
                        const sub = org.subscriptions?.[0];
                        if (!sub)
                          return (
                            <span className="text-navy-300 text-sm">Aucun</span>
                          );

                        const isExpired = sub.status === 'expired';
                        const isSuspended = sub.status === 'suspended';
                        const dateFin = new Date(
                          sub.endDate,
                        ).toLocaleDateString();

                        return (
                          <div className="text-sm">
                            <strong
                              className={
                                isExpired
                                  ? 'text-red-400'
                                  : isSuspended
                                    ? 'text-yellow-400'
                                    : 'text-green-400'
                              }
                            >
                              {sub.plan.toUpperCase()}
                            </strong>
                            <br />
                            <span className="text-navy-300 text-xs">
                              Fin: {dateFin}
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="p-4">
                      {org.dbProvisioned ? (
                        <span className="text-green-400 text-sm font-bold">
                          {' '}
                          Créée
                        </span>
                      ) : (
                        <span className="text-yellow-400 text-sm font-bold">
                          ⏳ En attente
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => ouvrirAcces(org)}
                        className="btn-secondary mr-2 text-xs"
                        title={
                          org.allowedFeatures
                            ? `${org.allowedFeatures.length} fonctionnalité(s) autorisée(s)`
                            : 'Aucune restriction'
                        }
                      >
                        <ShieldCheck size={13} className="inline mr-1" />
                        Accès
                      </button>
                      <button
                        onClick={() => ouvrirEquipe(org)}
                        className="btn-secondary mr-2 text-xs"
                        title={
                          org.allowAdditionalDirectors
                            ? 'Peut créer des directeurs supplémentaires'
                            : 'Un seul directeur autorisé'
                        }
                      >
                        <Users size={13} className="inline mr-1" />
                        Équipe
                      </button>
                      <button
                        onClick={() => handleStatusToggle(org.id, org.status)}
                        className="btn-secondary mr-2 text-xs"
                      >
                        {org.status === 'suspended' ? ' Activer' : ' Bloquer'}
                      </button>
                      <button
                        onClick={() => handleDelete(org.id)}
                        className="btn-secondary text-xs text-red-400 border-red-400/20 hover:bg-red-500/10"
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}

                {organisations.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-navy-300">
                      Aucune école n'a encore été créée sur la plateforme.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {orgPourAcces && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-panel p-6 max-w-lg w-full">
            <h3 className="text-xl font-bold text-white mb-1">
              Accès de {orgPourAcces.name}
            </h3>
            <p className="text-navy-300 text-sm mb-6">
              Fonctionnalités school-web accessibles au directeur de cette
              école.
            </p>

            <label
              className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 mb-4 cursor-pointer"
              style={{ color: 'var(--text-primary)' }}
            >
              <input
                type="checkbox"
                checked={toutAutoriser}
                onChange={(e) => setToutAutoriser(e.target.checked)}
                style={{ accentColor: 'var(--accent-primary)' }}
              />
              <span className="font-semibold text-sm">
                Tout autoriser (aucune restriction)
              </span>
            </label>

            {!toutAutoriser && (
              <div className="grid grid-cols-2 gap-2 mb-6 max-h-72 overflow-y-auto pr-1">
                {SCHOOL_FEATURES.map((feature) => (
                  <label
                    key={feature}
                    className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5 border border-white/10 cursor-pointer text-sm"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <input
                      type="checkbox"
                      checked={featuresSelectionnees.includes(feature)}
                      onChange={() => basculerFeature(feature)}
                      style={{ accentColor: 'var(--accent-primary)' }}
                    />
                    {SCHOOL_FEATURE_LABELS[feature]}
                  </label>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button
                className="btn-secondary flex-1"
                onClick={() => setOrgPourAcces(null)}
              >
                Annuler
              </button>
              <button
                className="btn-primary flex-1"
                onClick={enregistrerAcces}
                disabled={enregistrementAcces}
              >
                {enregistrementAcces ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {orgPourEquipe && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-panel p-6 max-w-lg w-full">
            <h3 className="text-xl font-bold text-white mb-1">
              Équipe de {orgPourEquipe.name}
            </h3>
            <p className="text-navy-300 text-sm mb-6">
              Autorise le directeur de cette école à inviter lui-même des
              collaborateurs (comptes directeur supplémentaires) et à les
              bloquer/débloquer.
            </p>

            <label
              className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 mb-6 cursor-pointer"
              style={{ color: 'var(--text-primary)' }}
            >
              <input
                type="checkbox"
                checked={autoriserEquipe}
                onChange={(e) => setAutoriserEquipe(e.target.checked)}
                style={{ accentColor: 'var(--accent-primary)' }}
              />
              <span className="font-semibold text-sm">
                Autoriser la création de comptes directeur supplémentaires
              </span>
            </label>

            <div className="flex gap-3">
              <button
                className="btn-secondary flex-1"
                onClick={() => setOrgPourEquipe(null)}
              >
                Annuler
              </button>
              <button
                className="btn-primary flex-1"
                onClick={enregistrerEquipe}
                disabled={enregistrementEquipe}
              >
                {enregistrementEquipe ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
