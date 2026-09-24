import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, CreditCard, Activity, Cpu, Server, Calendar, Wifi, Settings } from 'lucide-react';
import { useI18n } from '../i18n';

export default function Sidebar() {
  const { t } = useI18n();

  const liens = [
    { nom: t('sidebar.ecoles'), chemin: '/dashboard', icone: LayoutDashboard },
    { nom: t('sidebar.equipe'), chemin: '/users', icone: Users },
    { nom: t('sidebar.abonnements'), chemin: '/subscriptions', icone: Calendar },
    { nom: t('sidebar.facturation'), chemin: '/billing', icone: CreditCard },
    { nom: t('sidebar.diagnostic'), chemin: '/biotime', icone: Activity },
    { nom: t('sidebar.serveurs'), chemin: '/biotime-serveurs', icone: Server },
    { nom: t('sidebar.badgeuses'), chemin: '/biotime-terminaux', icone: Wifi },
    { nom: t('sidebar.materiel'), chemin: '/devices', icone: Cpu },
    { nom: t('sidebar.parametres'), chemin: '/settings', icone: Settings },
  ];

  return (
    <div className="w-64 fixed h-full bg-navy-800/80 backdrop-blur-xl border-r border-white/10 p-6 flex flex-col">
      <div className="mb-12 flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center font-bold text-xl shadow-lg"
          style={{ color: '#fff' }}
        >
          S
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">SMARTBUS</h1>
          <p className="text-xs text-brand-300 uppercase tracking-widest font-semibold">Super Admin</p>
        </div>
      </div>

      <div className="space-y-2 flex-1">
        {liens.map((lien) => {
          const Icone = lien.icone;
          return (
            <NavLink
              key={lien.nom}
              to={lien.chemin}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${
                  isActive
                    ? 'bg-brand-500 shadow-md shadow-brand-500/20'
                    : 'text-navy-300 hover:bg-white/5 hover:text-white'
                }`
              }
              style={({ isActive }) => (isActive ? { color: '#fff' } : undefined)}
            >
              <Icone size={20} className="shrink-0" />
              {lien.nom}
            </NavLink>
          );
        })}
      </div>

      <div className="mt-auto">
        <div className="glass-panel p-4 text-center">
          <p className="text-sm font-medium text-white mb-1">{t('sidebar.aide')}</p>
          <p className="text-xs text-navy-300 mb-3">{t('sidebar.aide_desc')}</p>
          <button className="btn-secondary w-full text-xs">{t('sidebar.documentation')}</button>
        </div>
      </div>
    </div>
  );
}
