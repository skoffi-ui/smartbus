import { useState } from 'react';
import { Search, Bell, LogOut, Sun, Moon } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { getInitialTheme, setTheme, type Theme } from '../theme';

export default function AdminNavbar() {
  const location = useLocation();
  const currentPath = location.pathname.replace('/', '') || 'Dashboard';

  // Thème clair/sombre (voir theme.ts) — appliqué avant le rendu dans main.tsx,
  // ici seulement pour piloter l'icône et persister le choix.
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setThemeState(next);
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
  };

  return (
    <nav className="sticky top-4 z-40 flex flex-row flex-wrap items-center justify-between rounded-2xl glass-panel p-3 backdrop-blur-xl mb-6 mx-4 md:mx-8">
      <div className="ml-[6px]">
        <div className="h-6 w-[224px] pt-1">
          <a className="text-sm font-normal text-navy-300 hover:underline" href=" ">
            Pages
            <span className="mx-1 text-sm text-navy-300 hover:text-white"> / </span>
          </a>
          <span className="text-sm font-normal capitalize text-white hover:underline">
            {currentPath}
          </span>
        </div>
        <p className="shrink text-[33px] capitalize text-white font-bold">
          {currentPath}
        </p>
      </div>

      <div className="mt-2 flex h-full items-center justify-between gap-4 sm:justify-end sm:mt-0">
        <div className="flex h-10 items-center rounded-full bg-navy-900/60 border border-white/10 px-4 text-white">
          <Search size={16} className="text-navy-300" />
          <input
            type="text"
            placeholder="Rechercher..."
            className="ml-2 w-full bg-transparent text-sm outline-none placeholder:text-navy-300"
          />
        </div>

        <button
          onClick={toggleTheme}
          className="h-12 w-12 flex items-center justify-center rounded-full text-navy-300 hover:text-white hover:bg-white/5 transition-colors"
          title={theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <button className="h-12 w-12 flex items-center justify-center rounded-full text-navy-300 hover:text-white hover:bg-white/5 transition-colors">
          <Bell size={20} />
        </button>

        <div
          className="h-8 w-8 rounded-full bg-gradient-to-tr from-brand-600 to-brand-400 border border-white/20 flex items-center justify-center text-sm font-bold shadow-lg cursor-pointer"
          style={{ color: '#fff' }}
        >
          AD
        </div>

        <button onClick={handleLogout} className="h-12 w-12 flex items-center justify-center rounded-full text-red-400 hover:text-red-300 hover:bg-white/5 transition-colors ml-2" title="Déconnexion">
          <LogOut size={20} />
        </button>
      </div>
    </nav>
  );
}
