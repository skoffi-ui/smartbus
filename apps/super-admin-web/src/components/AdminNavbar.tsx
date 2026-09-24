import { useState, useRef, useEffect } from 'react';
import { Search, Bell, LogOut, Sun, Moon, Settings, User, Shield } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getInitialTheme, setTheme, type Theme } from '../theme';
import { useI18n } from '../i18n';

export default function AdminNavbar() {
  const { t } = useI18n();
  const emplacement = useLocation();
  const naviguer = useNavigate();
  const cheminActuel = emplacement.pathname.replace('/', '') || 'Dashboard';

  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const basculerTheme = () => {
    const suivant: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(suivant);
    setThemeState(suivant);
  };

  const [menuOuvert, setMenuOuvert] = useState(false);
  const refMenu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const gererClic = (e: MouseEvent) => {
      if (refMenu.current && !refMenu.current.contains(e.target as Node)) {
        setMenuOuvert(false);
      }
    };
    document.addEventListener('mousedown', gererClic);
    return () => document.removeEventListener('mousedown', gererClic);
  }, []);

  const deconnecter = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
  };

  const initiales = (() => {
    try {
      const jeton = localStorage.getItem('accessToken');
      if (!jeton) return 'AD';
      const contenu = JSON.parse(atob(jeton.split('.')[1]));
      return `${(contenu.firstName || 'A')[0]}${(contenu.lastName || 'D')[0]}`.toUpperCase();
    } catch {
      return 'AD';
    }
  })();

  return (
    <nav className="sticky top-4 z-40 flex flex-row flex-wrap items-center justify-between rounded-2xl glass-panel p-3 backdrop-blur-xl mb-6 mx-4 md:mx-8">
      <div className="ml-[6px]">
        <div className="h-6 w-[224px] pt-1">
          <a className="text-sm font-normal text-navy-300 hover:underline" href=" ">
            {t('pages')}
            <span className="mx-1 text-sm text-navy-300 hover:text-white"> / </span>
          </a>
          <span className="text-sm font-normal capitalize text-white hover:underline">
            {cheminActuel}
          </span>
        </div>
        <p className="shrink text-[33px] capitalize text-white font-bold">
          {cheminActuel}
        </p>
      </div>

      <div className="mt-2 flex h-full items-center justify-between gap-4 sm:justify-end sm:mt-0">
        <div className="flex h-10 items-center rounded-full bg-navy-900/60 border border-white/10 px-4 text-white">
          <Search size={16} className="text-navy-300" />
          <input
            type="text"
            placeholder={t('rechercher')}
            className="ml-2 w-full bg-transparent text-sm outline-none placeholder:text-navy-300"
          />
        </div>

        <button
          onClick={basculerTheme}
          className="h-12 w-12 flex items-center justify-center rounded-full text-navy-300 hover:text-white hover:bg-white/5 transition-colors"
          title={theme === 'dark' ? t('nav.theme_clair') : t('nav.theme_sombre')}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <button className="h-12 w-12 flex items-center justify-center rounded-full text-navy-300 hover:text-white hover:bg-white/5 transition-colors">
          <Bell size={20} />
        </button>

        {/* Avatar + Menu déroulant */}
        <div className="relative" ref={refMenu}>
          <button
            onClick={() => setMenuOuvert(!menuOuvert)}
            className="h-8 w-8 rounded-full bg-gradient-to-tr from-brand-600 to-brand-400 border border-white/20 flex items-center justify-center text-sm font-bold shadow-lg cursor-pointer"
            style={{ color: '#fff' }}
          >
            {initiales}
          </button>

          {menuOuvert && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl glass-panel shadow-lg border border-white/10 overflow-hidden" style={{ zIndex: 50 }}>
              <button
                onClick={() => { setMenuOuvert(false); naviguer('/settings'); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-navy-300 hover:bg-white/5 hover:text-white transition-colors"
              >
                <User size={16} />
                {t('nav.profil')}
              </button>
              <button
                onClick={() => { setMenuOuvert(false); naviguer('/settings'); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-navy-300 hover:bg-white/5 hover:text-white transition-colors"
              >
                <Settings size={16} />
                {t('nav.parametres')}
              </button>
              <button
                onClick={() => { setMenuOuvert(false); naviguer('/settings'); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-navy-300 hover:bg-white/5 hover:text-white transition-colors border-b border-white/10"
              >
                <Shield size={16} />
                {t('nav.securite')}
              </button>
              <button
                onClick={deconnecter}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut size={16} />
                {t('nav.deconnexion')}
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
