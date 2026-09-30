import React from 'react';
import type { ReactNode } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Bus,
  Users,
  UserPlus,
  LogOut,
  Settings,
  Map,
  ListOrdered,
  CheckSquare,
  Shield,
  Sun,
  Moon,
  CreditCard,
} from 'lucide-react';
import { socketService } from '../services/socket.service';
import api from '../services/api';
import { getInitialTheme, setTheme, type Theme } from '../theme';
import { useI18n } from '../i18n';
import { useConfirm } from './ConfirmProvider';
import {
  aAcces,
  peutGererEquipe,
  type SchoolFeature,
} from '../constants/schoolFeatures';

interface LayoutProps {
  children: ReactNode;
}

const PAGES_SANS_MARGE_SOUS_BANDEAU = ['/trajets'];

export default function Layout({ children }: LayoutProps) {
  const naviguer = useNavigate();
  const emplacement = useLocation();
  const { t } = useI18n();
  const confirmer = useConfirm();
  const margeSousBandeau = PAGES_SANS_MARGE_SOUS_BANDEAU.includes(
    emplacement.pathname,
  )
    ? 0
    : '2rem';

  const deconnecter = async () => {
    if (!(await confirmer(t('sidebar.confirmer_deco')))) return;
    // Les deux jetons doivent partir : oublier `refreshToken` laisserait un
    // jeton valable jusqu'à 30 jours dans le localStorage après déconnexion.
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    naviguer('/login');
  };

  const [theme, setThemeState] = React.useState<Theme>(getInitialTheme);
  const basculerTheme = () => {
    const suivant: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(suivant);
    setThemeState(suivant);
  };

  const [nbAnomaliesCritiques, setNbAnomaliesCritiques] = React.useState(0);
  React.useEffect(() => {
    // Le badge ne partait jamais que de 0, incrémenté seulement par les
    // événements reçus EN DIRECT depuis l'ouverture de la page — toute
    // anomalie déjà non résolue avant l'arrivée sur l'écran (redémarrage du
    // navigateur, autre onglet fermé…) restait invisible tant qu'aucune
    // nouvelle anomalie n'arrivait. `GET /alertes-critiques/count` (déjà
    // construit, jamais appelé) donne le vrai compte au chargement.
    if (aAcces('centre-alertes')) {
      api
        .get('/alertes-critiques/count')
        .then((res) => {
          setNbAnomaliesCritiques(res.data?.count ?? 0);
        })
        .catch(() => {});
    }

    const socket = socketService.connect();
    socket.on('critical_anomaly', () => {
      setNbAnomaliesCritiques((prev) => prev + 1);
    });
    return () => {
      socket.off('critical_anomaly');
    };
  }, []);

  const tousLesElementsNav: {
    nom: string;
    chemin: string;
    icone: typeof Bus;
    feature?: SchoolFeature | SchoolFeature[];
    equipe?: boolean;
    badge?: number;
  }[] = [
    {
      nom: t('sidebar.vue_ensemble'),
      chemin: '/dashboard',
      icone: LayoutDashboard,
    },
    { nom: t('sidebar.live'), chemin: '/live', icone: Bus, feature: 'live' },
    { nom: t('sidebar.flotte'), chemin: '/cars', icone: Bus, feature: 'cars' },
    {
      nom: t('sidebar.chauffeurs'),
      chemin: '/drivers',
      icone: Users,
      feature: 'drivers',
    },
    {
      nom: t('sidebar.parents'),
      chemin: '/parents',
      icone: Users,
      feature: 'parents',
    },
    {
      nom: t('sidebar.eleves'),
      chemin: '/children',
      icone: Users,
      feature: 'children',
    },
    {
      nom: t('sidebar.courses'),
      chemin: '/courses',
      icone: Bus,
      feature: 'courses',
    },
    {
      nom: t('sidebar.trajets'),
      chemin: '/trajets',
      icone: Map,
      feature: 'trajets',
    },
    {
      nom: t('sidebar.affectation'),
      chemin: '/affectation',
      icone: ListOrdered,
      feature: 'affectation',
    },
    {
      nom: t('sidebar.suivi'),
      chemin: '/suivi',
      icone: CheckSquare,
      feature: 'suivi',
    },
    // Fusionné : anomalies critiques ET alertes de proximité vivent maintenant
    // sur le même écran (voir CentreAlertes.tsx) — accessible dès que l'école
    // a au moins l'une des deux fonctionnalités.
    {
      nom: t('sidebar.centre_alertes'),
      chemin: '/centre-alertes',
      icone: Shield,
      feature: ['centre-alertes', 'alertes'],
      badge: nbAnomaliesCritiques,
    },
    // Accordé par le Super Admin, par école (Organisation.allowAdditionalDirectors) —
    // n'a rien à voir avec les fonctionnalités school-web habituelles (`feature`).
    {
      nom: t('sidebar.mon_equipe'),
      chemin: '/mon-equipe',
      icone: UserPlus,
      equipe: true,
    },
    {
      nom: t('sidebar.parametres'),
      chemin: '/settings',
      icone: Settings,
      feature: 'settings',
    },
    // Sans `feature` : toujours visible, y compris une école suspendue.
    { nom: t('sidebar.abonnement'), chemin: '/abonnement', icone: CreditCard },
  ];
  // Dashboard (sans `feature`) est toujours visible ; le reste dépend des
  // permissions accordées par le Super Admin à cette école (voir schoolFeatures.ts).
  const elementsNav = tousLesElementsNav.filter(
    (e) =>
      (!e.feature ||
        (Array.isArray(e.feature)
          ? e.feature.some(aAcces)
          : aAcces(e.feature))) &&
      (!e.equipe || peutGererEquipe()),
  );

  return (
    <div
      className="flex"
      style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}
    >
      {/* Barre latérale */}
      <aside
        className="glass-panel"
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: '260px',
          height: '100vh',
          borderRadius: 0,
          borderRight: '1px solid var(--glass-border)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 100,
        }}
      >
        <div
          style={{
            padding: '2rem 1.5rem',
            borderBottom: '1px solid var(--glass-border)',
          }}
        >
          <h1
            className="text-xl text-accent"
            style={{
              fontWeight: 700,
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Bus size={24} />
            SMARTBUS
          </h1>
          <p className="text-sm text-secondary mt-1">Espace École</p>
        </div>

        <nav
          className="sidebar-nav"
          style={{ flex: 1, padding: '1.5rem 1rem' }}
        >
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            {elementsNav.map((element) => {
              const Icone = element.icone;
              return (
                <li key={element.chemin}>
                  <NavLink
                    to={element.chemin}
                    style={({ isActive }) => ({
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '10px 10px',
                      borderRadius: 'var(--radius-md)',
                      color: isActive
                        ? 'var(--on-primary)'
                        : 'var(--text-secondary)',
                      background: isActive
                        ? 'var(--accent-primary)'
                        : 'transparent',
                      textDecoration: 'none',
                      fontWeight: isActive ? 600 : 400,
                      transition: 'all 0.2s',
                    })}
                  >
                    <Icone size={20} color="currentColor" />
                    {element.nom}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div
          style={{
            padding: '1.5rem 1rem',
            borderTop: '1px solid var(--glass-border)',
          }}
        >
          <button
            onClick={deconnecter}
            className="btn w-full"
            style={{
              background: 'var(--danger-tint)',
              color: 'var(--danger)',
              display: 'flex',
              justifyContent: 'flex-start',
              gap: '0.75rem',
            }}
          >
            <LogOut size={20} />
            {t('sidebar.deconnexion')}
          </button>
        </div>
      </aside>

      {/* Contenu principal */}
      <main
        style={{
          flex: 1,
          marginLeft: '260px',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <header
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            marginBottom: margeSousBandeau,
            gap: '1rem',
          }}
        >
          <button
            onClick={basculerTheme}
            className="glass-panel"
            title={
              theme === 'dark'
                ? t('header.theme_clair')
                : t('header.theme_sombre')
            }
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
            }}
          >
            {theme === 'dark' ? (
              <Sun size={20} className="text-secondary" />
            ) : (
              <Moon size={20} className="text-secondary" />
            )}
          </button>
          <button
            onClick={() => naviguer('/settings')}
            className="glass-panel"
            title={t('header.parametres')}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
            }}
          >
            <Settings size={20} className="text-secondary" />
          </button>
        </header>
        <div style={{ flex: 1 }} className="animate-fade-in-soft">
          {children}
        </div>
      </main>
    </div>
  );
}
