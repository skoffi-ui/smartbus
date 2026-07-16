import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Bus, Users, GraduationCap, ShieldCheck, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import './Dashboard.css';

export default function Dashboard() {
  const [stats, setStats] = useState({ cars: 0, drivers: 0, parents: 0, children: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [carsRes, driversRes, parentsRes, childrenRes] = await Promise.all([
          api.get('/cars'),
          api.get('/drivers'),
          api.get('/parents'),
          api.get('/children')
        ]);
        setStats({
          cars: carsRes.data.length || 0,
          drivers: driversRes.data.length || 0,
          parents: parentsRes.data.length || 0,
          children: childrenRes.data.length || 0
        });
      } catch (err) {
        console.error("Erreur de chargement des statistiques", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl" style={{ margin: 0 }}>Tableau de bord</h1>
        <p className="text-secondary" style={{ marginTop: '0.25rem' }}>Aperçu de l'activité de votre établissement</p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
          <div className="text-secondary">Chargement...</div>
        </div>
      ) : (
        <div className="dashboard-grid">
          {/* Card 1: Eleves */}
          <div className="glass-panel dashboard-card">
            <div className="stat-icon-wrapper stat-blue">
              <GraduationCap size={24} />
            </div>
            <div>
              <p className="text-sm text-secondary mb-2" style={{ margin: 0, fontWeight: 500 }}>Élèves Inscrits</p>
              <h3 className="text-2xl" style={{ margin: 0 }}>{stats.children}</h3>
            </div>
          </div>

          {/* Card 2: Parents */}
          <div className="glass-panel dashboard-card">
            <div className="stat-icon-wrapper stat-indigo">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm text-secondary mb-2" style={{ margin: 0, fontWeight: 500 }}>Parents Associés</p>
              <h3 className="text-2xl" style={{ margin: 0 }}>{stats.parents}</h3>
            </div>
          </div>

          {/* Card 3: Chauffeurs */}
          <div className="glass-panel dashboard-card">
            <div className="stat-icon-wrapper stat-emerald">
              <ShieldCheck size={24} />
            </div>
            <div>
              <p className="text-sm text-secondary mb-2" style={{ margin: 0, fontWeight: 500 }}>Chauffeurs Actifs</p>
              <h3 className="text-2xl" style={{ margin: 0 }}>{stats.drivers}</h3>
            </div>
          </div>

          {/* Card 4: Vehicules */}
          <div className="glass-panel dashboard-card">
            <div className="stat-icon-wrapper stat-amber">
              <Bus size={24} />
            </div>
            <div>
              <p className="text-sm text-secondary mb-2" style={{ margin: 0, fontWeight: 500 }}>Flotte de Bus</p>
              <h3 className="text-2xl" style={{ margin: 0 }}>{stats.cars}</h3>
            </div>
          </div>
        </div>
      )}

      {/* Decorative / Quick Actions section */}
      {!loading && (
        <div className="dashboard-bottom-grid">
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <Activity size={24} style={{ color: 'var(--accent-primary)' }} />
              <h3 className="text-xl" style={{ margin: 0 }}>Activité Récente</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="activity-item">
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }}></div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 500, fontSize: '0.95rem' }}>Système opérationnel</p>
                  <p className="text-secondary" style={{ margin: 0, fontSize: '0.8rem' }}>Tous les services fonctionnent normalement.</p>
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--success)', background: 'rgba(16, 185, 129, 0.1)', padding: '0.2rem 0.6rem', borderRadius: '1rem' }}>En ligne</span>
              </div>
            </div>
          </div>
          
          <div className="glass-panel welcome-card" style={{ padding: '2rem' }}>
            <h3 className="text-xl" style={{ margin: '0 0 0.5rem 0' }}>Bienvenue sur votre portail</h3>
            <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              Gérez facilement vos élèves, parents, chauffeurs et véhicules depuis ce tableau de bord unifié. 
              SmartBus vous permet d'assurer un suivi optimal du transport scolaire.
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <Link to="/children" className="btn welcome-card-btn-light" style={{ textDecoration: 'none' }}>
                Voir les élèves
              </Link>
              <Link to="/cars" className="btn welcome-card-btn" style={{ textDecoration: 'none' }}>
                Gérer la flotte
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
