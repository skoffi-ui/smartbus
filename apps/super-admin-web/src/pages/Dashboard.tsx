import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  Bus,
  UserCog,
  GraduationCap,
  UsersRound,
  ShieldCheck,
  UserCheck,
  Route,
  MapPinned,
  ClipboardList,
  Bell,
  CreditCard,
  Wallet,
  Network,
  Fingerprint,
  ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import api, { messageFromError } from '../services/api';

interface StatEcole {
  organisationId: string;
  nom: string;
  code: string;
  valeur: number;
}

interface StatDomaine {
  total: number;
  parEcole: StatEcole[];
  critiques?: number;
}

interface DashboardStats {
  ecoles: {
    total: number;
    actives: number;
    suspendues: number;
    trial: number;
    pending: number;
  };
  utilisateurs: { administrateurs: number; directeurs: number };
  abonnements: {
    total: number;
    actifs: number;
    parStatut: Record<string, number>;
    parPlan: Record<string, number>;
  };
  planTarifs: {
    id: string;
    plan: string;
    label: string;
    pricePerMonth: number;
    maxCars: number;
    maxChildren: number | null;
  }[];
  biotime: {
    departements: number;
    terminaux: number;
    terminauxAssignes: number;
    terminauxLibres: number;
  };
  vehicules: StatDomaine;
  chauffeurs: StatDomaine;
  parents: StatDomaine;
  eleves: StatDomaine;
  courses: StatDomaine;
  trajets: StatDomaine;
  affectations: StatDomaine;
  alertes: StatDomaine;
}

const COULEUR = {
  brand: '#818cf8',
  vert: '#34d399',
  rouge: '#f87171',
  jaune: '#fbbf24',
  bleu: '#60a5fa',
  violet: '#a78bfa',
  cyan: '#22d3ee',
} as const;

/** Style commun des graphiques Recharts, aligné sur les tokens du thème actif. */
const STYLE_TOOLTIP = {
  contentStyle: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--glass-border)',
    borderRadius: 10,
    color: 'var(--text-primary)',
    fontSize: 12,
  },
  labelStyle: {
    color: 'var(--text-primary)',
    fontWeight: 600,
    marginBottom: 4,
  },
  itemStyle: { color: 'var(--text-secondary)' },
  cursor: { fill: 'var(--glass-border)', opacity: 0.15 },
};
const STYLE_AXE = { fill: 'var(--text-secondary)', fontSize: 11 };

/**
 * Barres horizontales pour la répartition par école — une seule couleur (la
 * couleur du domaine) : la couleur suit ici le domaine affiché, pas le rang
 * de chaque école, donc aucune teinte différente par barre.
 */
function GraphiqueParEcole({
  data,
  couleur,
  unite,
}: {
  data: StatEcole[];
  couleur: string;
  unite: string;
}) {
  const hauteurLigne = 30;
  const hauteur = Math.max(data.length * hauteurLigne, 40);

  return (
    <div
      style={{ maxHeight: 220, overflowY: hauteur > 220 ? 'auto' : 'visible' }}
      className="pr-1 custom-scrollbar"
    >
      <div style={{ height: hauteur, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
            barSize={14}
          >
            <CartesianGrid horizontal={false} stroke="var(--glass-border)" />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={STYLE_AXE}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="nom"
              width={110}
              tick={STYLE_AXE}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: string) =>
                v.length > 16 ? `${v.slice(0, 15)}…` : v
              }
            />
            <Tooltip
              {...STYLE_TOOLTIP}
              formatter={(value) => [`${value ?? 0} ${unite}`, undefined]}
              labelFormatter={(label) => String(label ?? '')}
            />
            <Bar dataKey="valeur" fill={couleur} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Donut de répartition catégorielle (statuts) — couleurs réservées au statut
 * (actif/essai/suspendu...), jamais recyclées comme teintes génériques.
 * Légende toujours présente (>= 2 catégories).
 */
function GraphiqueDonut({
  data,
}: {
  data: { nom: string; valeur: number; couleur: string }[];
}) {
  const donnees = data.filter((d) => d.valeur > 0);
  if (donnees.length === 0) {
    return (
      <p className="text-navy-400 text-xs py-6 text-center">
        Aucune donnée pour l'instant.
      </p>
    );
  }
  return (
    <div style={{ height: 200, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={donnees}
            dataKey="valeur"
            nameKey="nom"
            innerRadius="58%"
            outerRadius="85%"
            paddingAngle={2}
            stroke="var(--bg-secondary)"
            strokeWidth={2}
          >
            {donnees.map((d) => (
              <Cell key={d.nom} fill={d.couleur} />
            ))}
          </Pie>
          <Tooltip
            {...STYLE_TOOLTIP}
            formatter={(value, nom) => [Number(value ?? 0), String(nom ?? '')]}
          />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            iconType="circle"
            iconSize={8}
            formatter={(value: string) => (
              <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                {value}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Tuile KPI en tête de page — un chiffre, un libellé, jamais de graphique. */
function TuileKpi({
  icone: Icone,
  label,
  valeur,
  couleur,
}: {
  icone: LucideIcon;
  label: string;
  valeur: number | string;
  couleur: string;
}) {
  return (
    <div className="glass-panel p-5 flex items-center gap-4">
      <div
        className="p-3 rounded-xl shrink-0"
        style={{ background: `${couleur}22`, color: couleur }}
      >
        <Icone size={22} />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-extrabold text-white leading-tight">
          {valeur}
        </div>
        <div className="text-xs text-navy-300 font-medium truncate">
          {label}
        </div>
      </div>
    </div>
  );
}

/**
 * Carte d'un domaine (véhicules, chauffeurs, élèves...) : le total en titre,
 * puis la répartition par école dans une liste compacte scrollable. Un seul
 * composant réutilisé pour les 8 domaines ayant une base par école, plutôt
 * que huit blocs de rendu quasi identiques.
 */
function CarteDomaine({
  icone: Icone,
  titre,
  couleur,
  stat,
  unite = '',
  sousLigne,
}: {
  icone: LucideIcon;
  titre: string;
  couleur: string;
  stat: StatDomaine;
  /** Unité affichée dans l'infobulle au survol, ex. "véhicule(s)". */
  unite?: string;
  /** Détail secondaire optionnel, ex. "dont 3 critiques". */
  sousLigne?: string;
}) {
  const triees = [...stat.parEcole].sort((a, b) => b.valeur - a.valeur);

  return (
    <div className="glass-panel p-5 flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2.5">
          <div
            className="p-2 rounded-lg shrink-0"
            style={{ background: `${couleur}22`, color: couleur }}
          >
            <Icone size={17} />
          </div>
          <h3 className="font-bold text-white text-[15px]">{titre}</h3>
        </div>
        <span className="text-2xl font-extrabold text-white">{stat.total}</span>
      </div>
      {sousLigne && (
        <div className="text-xs text-navy-400 mb-3 ml-[42px]">{sousLigne}</div>
      )}

      <div className={sousLigne ? '' : 'mt-3'}>
        {triees.length === 0 ? (
          <p className="text-navy-400 text-xs py-2">
            Aucune école provisionnée pour l'instant.
          </p>
        ) : (
          <GraphiqueParEcole data={triees} couleur={couleur} unite={unite} />
        )}
      </div>
    </div>
  );
}

function TitreSection({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-bold text-navy-300 uppercase tracking-widest mt-8 mb-3 first:mt-0">
      {children}
    </h2>
  );
}

const LABEL_STATUT_ABONNEMENT: Record<string, string> = {
  active: 'Actifs',
  pending: 'En attente',
  expired: 'Expirés',
  cancelled: 'Annulés',
  suspended: 'Suspendus',
  trial: 'Essai',
};

/** Couleurs de statut réservées — jamais recyclées comme teintes catégorielles génériques. */
const COULEUR_STATUT_ABONNEMENT: Record<string, string> = {
  active: COULEUR.vert,
  trial: COULEUR.jaune,
  pending: COULEUR.brand,
  expired: '#fb923c',
  cancelled: COULEUR.violet,
  suspended: COULEUR.rouge,
};

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    try {
      const response = await api.get('/stats/dashboard');
      setStats(response.data);
      setError('');
    } catch (err) {
      setError(
        messageFromError(err, 'Erreur lors du chargement des statistiques.'),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // L'écran reste ouvert en fond sur un poste de supervision.
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="glass-panel p-10 text-center text-navy-300 animate-fade-in">
        Chargement des statistiques de la plateforme...
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="glass-panel p-6 animate-fade-in">
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl">
          {error || 'Statistiques indisponibles.'}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-2xl font-bold text-white">Tableau de bord</h1>
          <p className="text-sm text-navy-300 mt-0.5">
            Vue d'ensemble de la plateforme SMARTBUS, en direct.
          </p>
        </div>
        <Link
          to="/ecoles"
          className="btn-secondary text-sm flex items-center gap-2"
        >
          Gérer les écoles clientes <ArrowRight size={15} />
        </Link>
      </div>

      {/* ── KPI de tête ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mt-6">
        <TuileKpi
          icone={Building2}
          label="Écoles clientes"
          valeur={stats.ecoles.total}
          couleur={COULEUR.brand}
        />
        <TuileKpi
          icone={Bus}
          label="Véhicules (flotte totale)"
          valeur={stats.vehicules.total}
          couleur={COULEUR.bleu}
        />
        <TuileKpi
          icone={UserCog}
          label="Chauffeurs"
          valeur={stats.chauffeurs.total}
          couleur={COULEUR.violet}
        />
        <TuileKpi
          icone={GraduationCap}
          label="Élèves"
          valeur={stats.eleves.total}
          couleur={COULEUR.cyan}
        />
        <TuileKpi
          icone={UsersRound}
          label="Parents"
          valeur={stats.parents.total}
          couleur={COULEUR.jaune}
        />
        <TuileKpi
          icone={Bell}
          label="Alertes critiques"
          valeur={stats.alertes.critiques ?? 0}
          couleur={
            (stats.alertes.critiques ?? 0) > 0 ? COULEUR.rouge : COULEUR.vert
          }
        />
      </div>

      {/* ── Écoles clientes : répartition par statut ── */}
      <TitreSection>Écoles clientes</TitreSection>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="grid grid-cols-2 gap-4 xl:col-span-2">
          <TuileKpi
            icone={ShieldCheck}
            label="Actives"
            valeur={stats.ecoles.actives}
            couleur={COULEUR.vert}
          />
          <TuileKpi
            icone={ShieldCheck}
            label="En essai"
            valeur={stats.ecoles.trial}
            couleur={COULEUR.jaune}
          />
          <TuileKpi
            icone={ShieldCheck}
            label="Suspendues"
            valeur={stats.ecoles.suspendues}
            couleur={COULEUR.rouge}
          />
          <TuileKpi
            icone={ShieldCheck}
            label="En attente"
            valeur={stats.ecoles.pending}
            couleur={COULEUR.brand}
          />
        </div>
        <div className="glass-panel p-5">
          <h3 className="font-bold text-white text-[15px] mb-1">
            Répartition par statut
          </h3>
          <GraphiqueDonut
            data={[
              {
                nom: 'Actives',
                valeur: stats.ecoles.actives,
                couleur: COULEUR.vert,
              },
              {
                nom: 'En essai',
                valeur: stats.ecoles.trial,
                couleur: COULEUR.jaune,
              },
              {
                nom: 'Suspendues',
                valeur: stats.ecoles.suspendues,
                couleur: COULEUR.rouge,
              },
              {
                nom: 'En attente',
                valeur: stats.ecoles.pending,
                couleur: COULEUR.brand,
              },
            ]}
          />
        </div>
      </div>

      {/* ── Comptes ── */}
      <TitreSection>Comptes</TitreSection>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <TuileKpi
          icone={ShieldCheck}
          label="Administrateurs"
          valeur={stats.utilisateurs.administrateurs}
          couleur={COULEUR.brand}
        />
        <TuileKpi
          icone={UserCheck}
          label="Directeurs d'écoles"
          valeur={stats.utilisateurs.directeurs}
          couleur={COULEUR.bleu}
        />
      </div>

      {/* ── Flotte, équipe, familles, élèves — regroupé et par école ── */}
      <TitreSection>
        Flotte, équipe &amp; familles — regroupé et par école
      </TitreSection>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <CarteDomaine
          icone={Bus}
          titre="Flotte de véhicules"
          couleur={COULEUR.bleu}
          stat={stats.vehicules}
          unite="véhicule(s)"
        />
        <CarteDomaine
          icone={UserCog}
          titre="Équipe de chauffeurs"
          couleur={COULEUR.violet}
          stat={stats.chauffeurs}
          unite="chauffeur(s)"
        />
        <CarteDomaine
          icone={GraduationCap}
          titre="Élèves"
          couleur={COULEUR.cyan}
          stat={stats.eleves}
          unite="élève(s)"
        />
        <CarteDomaine
          icone={UsersRound}
          titre="Parents"
          couleur={COULEUR.jaune}
          stat={stats.parents}
          unite="parent(s)"
        />
      </div>

      {/* ── Transport — regroupé et par école ── */}
      <TitreSection>Transport — regroupé et par école</TitreSection>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <CarteDomaine
          icone={Route}
          titre="Trajets"
          couleur={COULEUR.brand}
          stat={stats.trajets}
          unite="trajet(s)"
        />
        <CarteDomaine
          icone={MapPinned}
          titre="Courses"
          couleur={COULEUR.bleu}
          stat={stats.courses}
          unite="course(s)"
        />
        <CarteDomaine
          icone={ClipboardList}
          titre="Affectations des élèves"
          couleur={COULEUR.vert}
          stat={stats.affectations}
          unite="affectation(s)"
        />
        <CarteDomaine
          icone={Bell}
          titre="Alertes"
          couleur={COULEUR.rouge}
          stat={stats.alertes}
          unite="alerte(s)"
          sousLigne={`dont ${stats.alertes.critiques ?? 0} critique(s)`}
        />
      </div>

      {/* ── Abonnements & grille tarifaire ── */}
      <TitreSection>Abonnements &amp; grille tarifaire</TitreSection>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="glass-panel p-5">
          <div className="flex items-center gap-2.5 mb-1">
            <div
              className="p-2 rounded-lg"
              style={{ background: `${COULEUR.brand}22`, color: COULEUR.brand }}
            >
              <CreditCard size={17} />
            </div>
            <h3 className="font-bold text-white text-[15px]">
              Abonnements ({stats.abonnements.total})
            </h3>
          </div>
          <GraphiqueDonut
            data={Object.entries(stats.abonnements.parStatut).map(
              ([statut, nb]) => ({
                nom: LABEL_STATUT_ABONNEMENT[statut] ?? statut,
                valeur: nb,
                couleur: COULEUR_STATUT_ABONNEMENT[statut] ?? COULEUR.brand,
              }),
            )}
          />
        </div>

        <div className="glass-panel p-5 xl:col-span-2">
          <div className="flex items-center gap-2.5 mb-4">
            <div
              className="p-2 rounded-lg"
              style={{ background: `${COULEUR.vert}22`, color: COULEUR.vert }}
            >
              <Wallet size={17} />
            </div>
            <h3 className="font-bold text-white text-[15px]">
              Grille tarifaire
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="text-navy-400 text-xs uppercase tracking-wide">
                  <th className="py-2 pr-4 font-semibold">Forfait</th>
                  <th className="py-2 pr-4 font-semibold">Prix / mois</th>
                  <th className="py-2 pr-4 font-semibold">Véhicules max.</th>
                  <th className="py-2 font-semibold">Élèves max.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {stats.planTarifs.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 pr-4 font-bold text-white">
                      {p.label}
                    </td>
                    <td className="py-2 pr-4 text-navy-300">
                      {p.pricePerMonth.toLocaleString('fr-FR')} F CFA
                    </td>
                    <td className="py-2 pr-4 text-navy-300">{p.maxCars}</td>
                    <td className="py-2 text-navy-300">
                      {p.maxChildren ?? 'Illimité'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── BioTime centralisée ── */}
      <TitreSection>BioTime centralisée</TitreSection>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <TuileKpi
          icone={Network}
          label="Départements"
          valeur={stats.biotime.departements}
          couleur={COULEUR.brand}
        />
        <TuileKpi
          icone={Fingerprint}
          label="Terminaux (total)"
          valeur={stats.biotime.terminaux}
          couleur={COULEUR.bleu}
        />
        <TuileKpi
          icone={Fingerprint}
          label="Terminaux assignés"
          valeur={stats.biotime.terminauxAssignes}
          couleur={COULEUR.vert}
        />
        <TuileKpi
          icone={Fingerprint}
          label="Terminaux libres"
          valeur={stats.biotime.terminauxLibres}
          couleur={COULEUR.jaune}
        />
      </div>
    </div>
  );
}
