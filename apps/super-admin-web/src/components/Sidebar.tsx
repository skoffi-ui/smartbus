import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, CreditCard, UserCircle } from 'lucide-react';

export default function Sidebar() {
  const links = [
    { name: 'Écoles', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Équipe', path: '/users', icon: Users },
    { name: 'Facturation', path: '/billing', icon: CreditCard },
    { name: 'Enfants', path: '/enfants', icon: UserCircle },
  ];

  return (
    <div className="w-64 fixed h-full bg-navy-800/80 backdrop-blur-xl border-r border-white/10 p-6 flex flex-col">
      <div className="mb-12 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center text-white font-bold text-xl shadow-lg">
          S
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">SMARTBUS</h1>
          <p className="text-xs text-brand-300 uppercase tracking-widest font-semibold">Super Admin</p>
        </div>
      </div>

      <div className="space-y-2 flex-1">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.name}
              to={link.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${
                  isActive
                    ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                    : 'text-navy-300 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <Icon size={20} className="shrink-0" />
              {link.name}
            </NavLink>
          );
        })}
      </div>

      <div className="mt-auto">
        <div className="glass-panel p-4 text-center">
          <p className="text-sm font-medium text-white mb-1">Besoin d'aide ?</p>
          <p className="text-xs text-navy-300 mb-3">Consultez la documentation technique</p>
          <button className="btn-secondary w-full text-xs">Documentation</button>
        </div>
      </div>
    </div>
  );
}
