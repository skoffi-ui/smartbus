import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Building2, Users, CreditCard, Bus, LogOut } from 'lucide-react';

export default function TopNav() {
  const location = useLocation();
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
  };

  const navLinks = [
    { path: '/dashboard', label: 'Écoles', icon: <Building2 size={18} /> },
    { path: '/users', label: 'Équipe', icon: <Users size={18} /> },
    { path: '/billing', label: 'Facturation', icon: <CreditCard size={18} /> },
    { path: '/enfants', label: 'Enfants', icon: <Bus size={18} /> },
  ];

  return (
    <div className="glass-panel" style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      marginBottom: '2rem', 
      padding: '1rem 2rem',
      borderRadius: '1.25rem',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      border: '1px solid var(--glass-border)',
      background: 'rgba(15, 23, 42, 0.65)'
    }}>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '3rem' }}>
        {/* LOGO */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h1 style={{ 
            fontSize: '1.5rem', 
            fontWeight: 800, 
            margin: 0, 
            letterSpacing: '-0.5px',
            background: 'var(--accent-gradient)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            SMARTBUS
          </h1>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>Super Admin</span>
        </div>

        {/* NAVIGATION LINKS */}
        <nav style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', padding: '0.35rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            const isHovered = hoveredLink === link.path;
            
            return (
              <Link 
                key={link.path}
                to={link.path} 
                onMouseEnter={() => setHoveredLink(link.path)}
                onMouseLeave={() => setHoveredLink(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '0.75rem',
                  fontWeight: 500,
                  fontSize: '0.9rem',
                  color: isActive ? 'white' : (isHovered ? 'var(--text-primary)' : 'var(--text-secondary)'),
                  background: isActive ? 'var(--accent-primary)' : (isHovered ? 'rgba(255,255,255,0.08)' : 'transparent'),
                  boxShadow: isActive ? '0 4px 14px 0 rgba(59, 130, 246, 0.39)' : 'none',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  textDecoration: 'none'
                }}
              >
                <span style={{ opacity: isActive ? 1 : 0.8 }}>{link.icon}</span>
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* LOGOUT BUTTON */}
      <button 
        onClick={handleLogout} 
        onMouseEnter={() => setHoveredLink('logout')}
        onMouseLeave={() => setHoveredLink(null)}
        style={{ 
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.6rem 1.2rem', 
          borderRadius: '0.75rem', 
          fontWeight: 600,
          fontSize: '0.875rem',
          color: hoveredLink === 'logout' ? 'white' : 'var(--danger)',
          background: hoveredLink === 'logout' ? 'var(--danger)' : 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: hoveredLink === 'logout' ? '0 4px 12px rgba(239, 68, 68, 0.3)' : 'none'
        }}
      >
        <LogOut size={16} />
        Déconnexion
      </button>
    </div>
  );
}
