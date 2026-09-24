import React from 'react';
import type { ReactNode } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Bus, Users, LogOut, Settings, Map, MapPin, ListOrdered, CheckSquare, AlertTriangle, Shield, Fingerprint, SlidersHorizontal, Sun, Moon } from 'lucide-react';
import { socketService } from '../services/socket.service';
import { getInitialTheme, setTheme, type Theme } from '../theme';

interface LayoutProps {
  children: ReactNode;
}

/**
 * Pages dont le contenu doit toucher le bandeau du haut.
 *
 * L'éditeur de trajet occupe toute la hauteur disponible : les 2 rem sous le
 * bandeau lui étaient prises sur la carte.
 */
const PAGES_SANS_MARGE_SOUS_BANDEAU = ['/trajets'];

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const margeSousBandeau = PAGES_SANS_MARGE_SOUS_BANDEAU.includes(location.pathname) ? 0 : '2rem';

  const handleLogout = () => {
    if (!confirm('Voulez-vous vraiment vous déconnecter ?')) return;
    localStorage.removeItem('accessToken');
    navigate('/login');
  };

  // Thème clair/sombre (voir theme.ts) — appliqué avant le rendu dans main.tsx,
  // ici seulement pour piloter l'icône et persister le choix.
  const [theme, setThemeState] = React.useState<Theme>(getInitialTheme);
  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setThemeState(next);
  };

  // Listen for critical_anomaly events to show badge counter
  const [criticalCount, setCriticalCount] = React.useState(0);
  React.useEffect(() => {
    const socket = socketService.connect();
    socket.on('critical_anomaly', () => {
      setCriticalCount(prev => prev + 1);
    });
    return () => { socket.off('critical_anomaly'); };
  }, []);

  const navItems = [
    { name: "Vue d'ensemble", path: '/dashboard', icon: LayoutDashboard },
    { name: 'Live Tracking', path: '/live', icon: Bus },
    { name: 'Flotte (Bus)', path: '/cars', icon: Bus },
    { name: 'Chauffeurs', path: '/drivers', icon: Users },
    { name: 'Parents', path: '/parents', icon: Users },
    { name: 'Élèves', path: '/children', icon: Users },
    // Nouveaux menus Transport Scolaire
    { name: 'Courses', path: '/courses', icon: Bus },
    { name: 'Trajets', path: '/trajets', icon: Map },
    { name: 'Affectation des élèves', path: '/affectation', icon: ListOrdered },
    { name: 'Suivi des montées', path: '/suivi', icon: CheckSquare },
    { name: 'Alertes', path: '/alertes', icon: AlertTriangle },
    { name: 'Centre d\'Alertes', path: '/centre-alertes', icon: Shield, badge: criticalCount },
    // BioTime
    { name: 'Annuaire BioTime', path: '/biotime-employes', icon: Fingerprint },
    { name: 'Config BioTime', path: '/biotime-config', icon: SlidersHorizontal },
  ];

  return (
    <div className="flex" style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <aside className="glass-panel" style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: '260px',
        height: '100vh',
        borderRadius: 0,
        borderRight: '1px solid var(--glass-border)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100
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
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    style={({ isActive }) => ({
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '10px 10px',
                      borderRadius: 'var(--radius-md)',
                      color: isActive ? 'var(--on-primary)' : 'var(--text-secondary)',
                      background: isActive ? 'var(--accent-primary)' : 'transparent',
                      textDecoration: 'none',
                      fontWeight: isActive ? 600 : 400,
                      transition: 'all 0.2s'
                    })}
                  >
                    <Icon size={20} color={window.location.pathname === item.path ? 'currentColor' : 'currentColor'} />
                    {item.name}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div style={{ padding: '1.5rem 1rem', borderTop: '1px solid var(--glass-border)' }}>
          <button onClick={handleLogout} className="btn w-full" style={{
            background: 'var(--danger-tint)',
            color: 'var(--danger)',
            display: 'flex', 
            justifyContent: 'flex-start',
            gap: '0.75rem'
          }}>
            <LogOut size={20} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, marginLeft: '260px', padding: '2rem', display: 'flex', flexDirection: 'column' }}>
        <header style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: margeSousBandeau, gap: '1rem' }}>
          <button
            onClick={toggleTheme}
            className="glass-panel"
            title={theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'}
            style={{ width: '48px', height: '48px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none' }}
          >
            {theme === 'dark' ? <Sun size={20} className="text-secondary" /> : <Moon size={20} className="text-secondary" />}
          </button>
          <div className="glass-panel" style={{ width: '48px', height: '48px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Settings size={20} className="text-secondary" />
          </div>
        </header>
        {/* Variante sans transform : sinon ce conteneur devient le référentiel des
            modales en position fixe et elles ne couvrent plus l'écran. */}
        <div style={{ flex: 1 }} className="animate-fade-in-soft">
          {children}
        </div>
      </main>
    </div>
  );
}
