import { useEffect, useState } from 'react';
import {
  CreditCard,
  Calendar,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import api, { messageFromError } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { monOrganisationId } from '../constants/schoolFeatures';

interface Abonnement {
  id: string;
  plan: string;
  status: string;
  startDate: string;
  endDate: string;
  pricePerMonth: number;
  maxCars: number;
}

interface PlanTarif {
  plan: string;
  label: string;
  description: string;
  pricePerMonth: number;
  maxCars: number;
}

const STATUT_LABELS: Record<string, { texte: string; couleur: string }> = {
  trial: { texte: 'Essai gratuit', couleur: '#3b82f6' },
  pending: { texte: 'En attente de paiement', couleur: '#f59e0b' },
  active: { texte: 'Actif', couleur: '#10b981' },
  expired: { texte: 'Expiré', couleur: '#ef4444' },
  cancelled: { texte: 'Annulé', couleur: '#64748b' },
  suspended: { texte: 'Suspendu', couleur: '#ef4444' },
};

export default function Abonnement() {
  const toast = useToast();
  const [abonnement, setAbonnement] = useState<Abonnement | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [planChoisi, setPlanChoisi] = useState('standard');
  const [paiementEnCours, setPaiementEnCours] = useState(false);
  // Grille tarifaire réelle (voir PlanTarif, backend) — remplace les prix
  // qui étaient jusque-là inventés côté client, sans rapport avec ce que
  // /payments/checkout applique réellement.
  const [tarifs, setTarifs] = useState<PlanTarif[]>([]);

  const charger = async () => {
    setErreur('');
    try {
      const organisationId = monOrganisationId();
      const [reponseAbonnement, reponseTarifs] = await Promise.all([
        api.get(`/subscriptions/organisation/${organisationId}`),
        api.get('/plan-tarifs'),
      ]);
      const liste: Abonnement[] = Array.isArray(reponseAbonnement.data)
        ? reponseAbonnement.data
        : [];
      // Le plus récent d'abord (déjà trié côté serveur), le seul qui compte
      // pour l'école — une école n'a jamais qu'un abonnement actif à la fois.
      setAbonnement(liste[0] ?? null);
      if (liste[0]) setPlanChoisi(liste[0].plan);
      setTarifs(Array.isArray(reponseTarifs.data) ? reponseTarifs.data : []);
    } catch (err) {
      setErreur(messageFromError(err, "Impossible de charger l'abonnement."));
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    charger();
  }, []);

  const payer = async () => {
    setPaiementEnCours(true);
    try {
      await api.post('/payments/checkout', { plan: planChoisi });
      toast.success(
        "Paiement effectué. Votre abonnement est prolongé d'un mois.",
      );
      await charger();
    } catch (err) {
      toast.error(messageFromError(err, 'Erreur lors du paiement.'));
    } finally {
      setPaiementEnCours(false);
    }
  };

  const statut = abonnement ? STATUT_LABELS[abonnement.status] : null;
  const joursRestants = abonnement
    ? Math.ceil(
        (new Date(abonnement.endDate).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      )
    : null;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <CreditCard size={26} className="text-indigo-600" /> Mon abonnement
        </h1>
        <p className="text-slate-500 mt-1">
          Consultez et renouvelez l'abonnement de votre établissement.
        </p>
      </div>

      {/* Bandeau mode test — tant que le vrai CinetPay n'est pas branché, ce
          paiement ne débite jamais réellement le directeur. Ne jamais laisser
          croire le contraire. */}
      <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
        <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">
          <strong>Mode test.</strong> Le paiement en ligne réel (Orange Money,
          MTN, Wave, carte) n'est pas encore activé sur cette plateforme. Ce
          bouton simule un paiement réussi et prolonge réellement votre
          abonnement d'un mois, sans débiter d'argent.
        </p>
      </div>

      {erreur && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {erreur}
        </div>
      )}

      {chargement ? (
        <p className="text-center text-slate-500 py-10">Chargement...</p>
      ) : (
        <>
          {abonnement ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-800">
                  Abonnement actuel
                </h2>
                <span
                  className="px-3 py-1 rounded-full text-xs font-bold"
                  style={{
                    background: `${statut?.couleur}18`,
                    color: statut?.couleur,
                  }}
                >
                  {statut?.texte ?? abonnement.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500 block mb-1">Forfait</span>
                  <span className="font-semibold text-slate-800 capitalize">
                    {abonnement.plan}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-1">
                    Prix mensuel
                  </span>
                  <span className="font-semibold text-slate-800 flex items-center gap-1">
                    <DollarSign size={14} className="text-emerald-600" />
                    {abonnement.pricePerMonth.toLocaleString()} FCFA
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-1">Expire le</span>
                  <span className="font-semibold text-slate-800 flex items-center gap-1">
                    <Calendar size={14} />
                    {new Date(abonnement.endDate).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-1">
                    Jours restants
                  </span>
                  <span
                    className={`font-semibold flex items-center gap-1 ${joursRestants !== null && joursRestants <= 5 ? 'text-red-600' : 'text-slate-800'}`}
                  >
                    {joursRestants !== null && joursRestants <= 5 && (
                      <AlertTriangle size={14} />
                    )}
                    {joursRestants !== null ? Math.max(joursRestants, 0) : '—'}{' '}
                    jour(s)
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center mb-6">
              <p className="text-slate-500">
                Aucun abonnement enregistré encore pour votre établissement.
              </p>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">
              {abonnement
                ? 'Renouveler / changer de forfait'
                : 'Choisir un forfait'}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
              {tarifs.map((p) => (
                <button
                  key={p.plan}
                  type="button"
                  onClick={() => setPlanChoisi(p.plan)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    planChoisi === p.plan
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    {planChoisi === p.plan && (
                      <CheckCircle2 size={15} className="text-indigo-600" />
                    )}
                    {p.label}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {p.description}
                  </div>
                  <div className="text-sm font-semibold text-slate-700 mt-2">
                    {p.pricePerMonth.toLocaleString()} FCFA/mois
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={payer}
              disabled={paiementEnCours}
              className="w-full py-3 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <CreditCard size={18} />
              {paiementEnCours
                ? 'Traitement...'
                : "Payer et prolonger d'un mois"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
