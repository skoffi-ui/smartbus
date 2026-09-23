import { useEffect, useState } from 'react';
import { Plus, X, Calendar, DollarSign, Building2, Check, XCircle, Clock, Ban, AlertTriangle } from 'lucide-react';
import api, { messageFromError } from '../services/api';

interface Subscription {
  id: string;
  plan: string;
  status: string;
  startDate: string;
  endDate: string;
  pricePerMonth: number;
  maxCars: number;
  organisation: {
    id: string;
    name: string;
    code: string;
  };
  createdAt: string;
}

interface Organisation {
  id: string;
  name: string;
  code: string;
  status: string;
}

const PLANS = [
  { value: 'starter', label: 'DÉMARRAGE', maxCars: 2, description: 'Jusqu\'à 2 cars' },
  { value: 'basic', label: 'BASIQUE', maxCars: 5, description: 'Jusqu\'à 5 cars' },
  { value: 'standard', label: 'STANDARD', maxCars: 15, description: 'Jusqu\'à 15 cars' },
  { value: 'premium', label: 'PREMIUM', maxCars: 30, description: 'Jusqu\'à 30 cars' },
  { value: 'enterprise', label: 'ENTREPRISE', maxCars: 999, description: 'Illimité' },
];

const PLAN_LABELS: Record<string, string> = {
  starter: 'DÉMARRAGE',
  basic: 'BASIQUE',
  standard: 'STANDARD',
  premium: 'PREMIUM',
  enterprise: 'ENTREPRISE',
};

const STATUS_CONFIG = {
  trial: { label: 'ESSAI', color: 'bg-blue-500/20 text-blue-400', icon: Clock },
  pending: { label: 'EN ATTENTE', color: 'bg-yellow-500/20 text-yellow-400', icon: Clock },
  active: { label: 'ACTIF', color: 'bg-green-500/20 text-green-400', icon: Check },
  expired: { label: 'EXPIRÉ', color: 'bg-red-500/20 text-red-400', icon: XCircle },
  cancelled: { label: 'ANNULÉ', color: 'bg-gray-500/20 text-gray-400', icon: Ban },
  suspended: { label: 'SUSPENDU', color: 'bg-orange-500/20 text-orange-400', icon: AlertTriangle },
};

export default function Subscriptions() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);

  const [formData, setFormData] = useState({
    organisationId: '',
    plan: 'standard',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    pricePerMonth: 50000,
    maxCars: 15,
  });

  const fetchSubscriptions = async () => {
    try {
      const response = await api.get('/subscriptions');
      setSubscriptions(response.data.data || response.data);
    } catch (err: any) {
      if (err.response?.status === 401) {
        handleLogout();
      } else {
        setError(messageFromError(err, 'Erreur lors du chargement des abonnements.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganisations = async () => {
    try {
      const response = await api.get('/organisations?limit=200');
      setOrganisations(response.data.data || response.data);
    } catch (err) {
      console.error('Erreur de chargement des organisations', err);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
    fetchOrganisations();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
  };

  const handleOpenModal = (subscription?: Subscription) => {
    if (subscription) {
      setEditingSubscription(subscription);
      setFormData({
        organisationId: subscription.organisation.id,
        plan: subscription.plan,
        startDate: subscription.startDate.split('T')[0],
        endDate: subscription.endDate.split('T')[0],
        pricePerMonth: subscription.pricePerMonth,
        maxCars: subscription.maxCars,
      });
    } else {
      setEditingSubscription(null);
      setFormData({
        organisationId: '',
        plan: 'standard',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        pricePerMonth: 50000,
        maxCars: 15,
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingSubscription(null);
  };

  const handlePlanChange = (plan: string) => {
    const selectedPlan = PLANS.find(p => p.value === plan);
    if (selectedPlan) {
      setFormData(prev => ({
        ...prev,
        plan,
        maxCars: selectedPlan.maxCars,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingSubscription) {
        await api.patch(`/subscriptions/${editingSubscription.id}`, {
          plan: formData.plan,
          startDate: formData.startDate,
          endDate: formData.endDate,
          pricePerMonth: formData.pricePerMonth,
          maxCars: formData.maxCars,
        });
      } else {
        await api.post('/subscriptions', {
          ...formData,
          status: 'active' // Définir explicitement le statut à 'active'
        });
      }

      fetchSubscriptions();
      handleCloseModal();
    } catch (err) {
      alert(messageFromError(err, 'Erreur lors de la sauvegarde.'));
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir annuler cet abonnement ?')) return;

    try {
      await api.patch(`/subscriptions/${id}/cancel`, {});
      fetchSubscriptions();
    } catch (err) {
      alert(messageFromError(err, 'Erreur lors de l\'annulation.'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('⚠️ DANGER : Êtes-vous sûr de vouloir supprimer définitivement cet abonnement ?')) return;

    try {
      await api.delete(`/subscriptions/${id}`);
      fetchSubscriptions();
    } catch (err) {
      alert(messageFromError(err, 'Erreur lors de la suppression.'));
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="glass-panel p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Gestion des Abonnements</h2>
            <p className="text-navy-300 text-sm mt-1">Créer et gérer les abonnements des écoles clientes</p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={18} />
            Nouvel Abonnement
          </button>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-4">{error}</div>}

        {loading ? (
          <div className="text-center text-navy-300 py-10">
            Chargement des abonnements...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-navy-300">
                  <th className="p-4 font-semibold">École</th>
                  <th className="p-4 font-semibold">Plan</th>
                  <th className="p-4 font-semibold">Statut</th>
                  <th className="p-4 font-semibold">Période</th>
                  <th className="p-4 font-semibold">Prix/mois</th>
                  <th className="p-4 font-semibold">Max Cars</th>
                  <th className="p-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {subscriptions.map((sub) => {
                  const statusConfig = STATUS_CONFIG[sub.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
                  const StatusIcon = statusConfig.icon;

                  return (
                    <tr key={sub.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Building2 size={16} className="text-brand-400" />
                          <div>
                            <div className="font-bold text-white">{sub.organisation.name}</div>
                            <div className="text-xs text-navy-300 font-mono">{sub.organisation.code}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400">
                          {PLAN_LABELS[sub.plan] || sub.plan.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit ${statusConfig.color}`}>
                          <StatusIcon size={12} />
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-navy-300">
                        <div className="flex items-center gap-1">
                          <Calendar size={14} />
                          <span>
                            {new Date(sub.startDate).toLocaleDateString('fr-FR')} → {new Date(sub.endDate).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-white font-bold">
                        <div className="flex items-center gap-1">
                          <DollarSign size={14} className="text-green-400" />
                          {sub.pricePerMonth.toLocaleString()} FCFA
                        </div>
                      </td>
                      <td className="p-4 text-white font-semibold">
                        {sub.maxCars} {sub.maxCars === 999 ? '(Illimité)' : ''}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleOpenModal(sub)}
                            className="btn-secondary text-xs"
                          >
                            Modifier
                          </button>
                          {['trial', 'pending', 'active'].includes(sub.status) && (
                            <button
                              onClick={() => handleCancel(sub.id)}
                              className="btn-secondary text-xs text-orange-400 border-orange-400/20 hover:bg-orange-500/10"
                            >
                              Annuler
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(sub.id)}
                            className="btn-secondary text-xs text-red-400 border-red-400/20 hover:bg-red-500/10"
                          >
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {subscriptions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-navy-300">
                      Aucun abonnement créé. Commencez par créer le premier abonnement pour une école.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Création/Modification */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-panel p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">
                {editingSubscription ? 'Modifier l\'abonnement' : 'Créer un nouvel abonnement'}
              </h3>
              <button onClick={handleCloseModal} className="text-navy-300 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Organisation */}
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  École cliente *
                </label>
                <select
                  value={formData.organisationId}
                  onChange={(e) => setFormData({ ...formData, organisationId: e.target.value })}
                  className="w-full px-4 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-white focus:border-brand-400 focus:outline-none"
                  required
                  disabled={!!editingSubscription}
                >
                  <option value="">Sélectionner une école</option>
                  {organisations
                    .filter(org => org.status === 'active')
                    .map(org => (
                      <option key={org.id} value={org.id}>
                        {org.name} ({org.code})
                      </option>
                    ))}
                </select>
                {editingSubscription && (
                  <p className="text-xs text-navy-300 mt-1">L'école ne peut pas être modifiée après création</p>
                )}
              </div>

              {/* Plan */}
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Plan d'abonnement *
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {PLANS.map((plan) => (
                    <button
                      key={plan.value}
                      type="button"
                      onClick={() => handlePlanChange(plan.value)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        formData.plan === plan.value
                          ? 'border-brand-400 bg-brand-400/10'
                          : 'border-white/10 bg-navy-800/30 hover:border-white/20'
                      }`}
                    >
                      <div className="font-bold text-white text-sm">{plan.label}</div>
                      <div className="text-xs text-navy-300 mt-1">{plan.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Date de début *
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-4 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-white focus:border-brand-400 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Date de fin *
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-4 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-white focus:border-brand-400 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Prix et Max Cars */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Prix par mois (FCFA) *
                  </label>
                  <input
                    type="number"
                    value={formData.pricePerMonth}
                    onChange={(e) => setFormData({ ...formData, pricePerMonth: Number(e.target.value) })}
                    className="w-full px-4 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-white focus:border-brand-400 focus:outline-none"
                    min="0"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Nombre max de cars *
                  </label>
                  <input
                    type="number"
                    value={formData.maxCars}
                    onChange={(e) => setFormData({ ...formData, maxCars: Number(e.target.value) })}
                    className="w-full px-4 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-white focus:border-brand-400 focus:outline-none"
                    min="1"
                    max="999"
                    required
                  />
                  <p className="text-xs text-navy-300 mt-1">999 = Illimité</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="btn-primary flex-1"
                >
                  {editingSubscription ? 'Enregistrer les modifications' : 'Créer l\'abonnement'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="btn-secondary"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
