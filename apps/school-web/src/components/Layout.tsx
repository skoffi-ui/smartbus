import React from 'react';
import type { ReactNode } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Bus, Users, LogOut, Settings, Map, MapPin, ListOrdered, CheckSquare, AlertTriangle, Shield, Fingerprint, SlidersHorizontal, Sun, Moon } from 'lucide-react';
import { socketService } from '../services/socket.service';
import { getInitialTheme, setTheme, type Theme } from '../theme';
import { useI18n } from '../i18n';

interface LayoutProps {
  children: ReactNode;
}

const PAGES_SANS_MARGE_SOUS_BANDEAU = ['/trajets'];

export default function Layout({ children }: LayoutProps) {
  const naviguer = useNavigate();
  const emplacement = useLocation();
  const { t } = useI18n();
  const margeSousBandeau = PAGES_SANS_MARGE_SOUS_BANDEAU.includes(emplacement.pathname) ? 0 : '2rem';

  const deconnecter = () => {
    if (!confirm(t('sidebar.confirmer_deco'))) return;
    localStorage.removeItem('accessToken');
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
    const socket = socketService.connect();
    socket.on('critical_anomaly', () => {
      setNbAnomaliesCritiques(prev => prev + 1);
    });
    return () => { socket.off('critical_anomaly'); };
  }, []);

  const elementsNav = [
    { nom: t('sidebar.vue_ensemble'), chemin: '/dashboard', icone: LayoutDashboard },
    { nom: t('sidebar.live'), chemin: '/live', icone: Bus },
    { nom: t('sidebar.flotte'), chemin: '/cars', icone: Bus },
    { nom: t('sidebar.chauffeurs'), chemin: '/drivers', icone: Users },
    { nom: t('sidebar.parents'), chemin: '/parents', icone: Users },
    { nom: t('sidebar.eleves'), chemin: '/children', icone: Users },
    { nom: t('sidebar.courses'), chemin: '/courses', icone: Bus },
    { nom: t('sidebar.trajets'), chemin: '/trajets', icone: Map },
    { nom: t('sidebar.affectation'), chemin: '/affectation', icone: ListOrdered },
    { nom: t('sidebar.suivi'), chemin: '/suivi', icone: CheckSquare },
    { nom: t('sidebar.alertes'), chemin: '/alertes', icone: AlertTriangle },
    { nom: t('sidebar.centre_alertes'), chemin: '/centre-alertes', icone: Shield, badge: nbAnomaliesCritiques },
    { nom: t('sidebar.annuaire'), chemin: '/biotime-employes', icone: Fingerprint },
    { nom: t('sidebar.config_biotime'), chemin: '/biotime-config', icone: SlidersHorizontal },
    { nom: t('sidebar.parametres'), chemin: '/settings', icone: Settings },
  ];

  return (
    <div className="flex" style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Barre latérale */}
      <aside className="glass-panel" style={{
        position: 'fixed', left: 0, top: 0, width: '260px', height: '100vh',
        borderRadius: 0, borderRight: '1px solid var(--glass-border)',
        display: 'flex', flexDirection: 'column', zIndex: 100
      }}>
        <div style={{ padding: '2rem 1.5rem', borderBottom: '1px solid var(--glass-border)' }}>
          <h1 className="text-xl text-accent" style={{ fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bus size={24} />
            SMARTBUS
          </h1>
          <p className="text-sm text-secondary mt-1">Espace École</p>
        </div>

        <nav className="sidebar-nav" style={{ flex: 1, padding: '1.5rem 1rem' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {elementsNav.map((element) => {
              const Icone = element.icone;
              return (
                <li key={element.chemin}>
                  <NavLink
                    to={element.chemin}
                    style={({ isActive }) => ({
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '10px 10px', borderRadius: 'var(--radius-md)',
                      color: isActive ? 'var(--on-primary)' : 'var(--text-secondary)',
                      background: isActive ? 'var(--accent-primary)' : 'transparent',
                      textDecoration: 'none', fontWeight: isActive ? 600 : 400,
                      transition: 'all 0.2s'
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

        <div style={{ padding: '1.5rem 1rem', borderTop: '1px solid var(--glass-border)' }}>
          <button onClick={deconnecter} className="btn w-full" style={{
            background: 'var(--danger-tint)', color: 'var(--danger)',
            display: 'flex', justifyContent: 'flex-start', gap: '0.75rem'
          }}>
            <LogOut size={20} />
            {t('sidebar.deconnexion')}
          </button>
        </div>
      </aside>

      {/* Contenu principal */}
      <main style={{ flex: 1, marginLeft: '260px', padding: '2rem', display: 'flex', flexDirection: 'column' }}>
        <header style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: margeSousBandeau, gap: '1rem' }}>
          <button
            onClick={basculerTheme}
            className="glass-panel"
            title={theme === 'dark' ? t('header.theme_clair') : t('header.theme_sombre')}
            style={{ width: '48px', height: '48px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none' }}
          >
            {theme === 'dark' ? <Sun size={20} className="text-secondary" /> : <Moon size={20} className="text-secondary" />}
          </button>
          <button
            onClick={() => naviguer('/settings')}
            className="glass-panel"
            title={t('header.parametres')}
            style={{ width: '48px', height: '48px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none' }}
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
