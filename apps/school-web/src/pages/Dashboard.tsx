import React, { useEffect, useState } from 'react';
import api, { messageFromError } from '../services/api';
import { Bus, Users, GraduationCap, ShieldCheck, Activity, CreditCard, Clock, Plus, MapPin, Route as RouteIcon, Zap } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import CheckoutModal from '../components/CheckoutModal';
import './Dashboard.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ cars: 0, drivers: 0, parents: 0, children: 0 });
  const [loading, setLoading] = useState(true);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [erreur, setErreur] = useState('');
  const [erreurAbonnement, setErreurAbonnement] = useState('');

  // Décoder l'ID d'organisation depuis le JWT
  const organisationId = (() => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return '';
      const p = JSON.parse(atob(token.split('.')[1]));
      return p.organisationId || p.tenantId || '';
    } catch { return ''; }
  })();

  const fetchStatsAndSubscription = async () => {
    setLoading(true);
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

      // L'abonnement vit dans la SUPER APP : son indisponibilité ne doit pas
      // vider le tableau de bord de l'école, qui vient d'un autre service.
      if (organisationId) {
        try {
          const subRes = await api.get(`/subscriptions/organisation/${organisationId}`);
          const subs = Array.isArray(subRes.data) ? subRes.data : [subRes.data];
          if (subs.length > 0) setSubscription(subs[0]);
        } catch (subErr) {
          setErreurAbonnement(messageFromError(subErr, "Abonnement momentanément indisponible."));
        }
      }

      // Activité récente : les montées et descentes réellement enregistrées.
      //
      // Cette liste lisait `/notifications`, une table qui n'est alimentée que par
      // certains chemins d'ingestion : le bloc restait donc vide alors que des
      // centaines de badgeages existaient. Les montées sont la source qui fait foi,
      // et le nom de l'élève vient des enfants déjà chargés ci-dessus.
      try {
        const monteesRes = await api.get('/montees');
        const montees: any[] = Array.isArray(monteesRes.data) ? monteesRes.data : monteesRes.data?.data || [];
        const enfants: any[] = Array.isArray(childrenRes.data) ? childrenRes.data : childrenRes.data?.data || [];
        const nomParId = new Map(
          enfants.map((e: any) => [e.id, `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim() || 'Élève']),
        );

        const recentes = montees
          .slice()
          .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
          .slice(0, 8)
          .map((m: any) => {
            const nom = nomParId.get(m.childId) || 'Élève';
            const descente = m.sens === 'descente';
            const refuse = m.statut === 'refuse';
            return {
              id: m.id,
              title: nom,
              // Minuscule voulue : le rendu ci-dessous reconnaît une descente en
              // cherchant « descendu » dans le message pour choisir sa pastille.
              message: refuse
                ? m.validationMessage || 'Badgeage refusé.'
                : `${descente ? 'descendu' : 'embarqué'} à ${String(m.heure ?? '').slice(0, 5)}`,
              type: refuse ? 'WARNING' : 'INFO',
              createdAt: m.createdAt,
              metadata: {},
            };
          });

        setRecentActivities(recentes);
      } catch {
        // Information d'appoint : son absence ne justifie pas une erreur en console.
        setRecentActivities([]);
      }
    } catch (err) {
      setErreur(messageFromError(err, 'Impossible de charger les données de la page.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatsAndSubscription();
  }, []);

  return (
    <div className="animate-fade-in">
      {erreur && (
        <div style={{
          margin: '0 0 1rem', padding: '0.75rem 1rem', borderRadius: '0.5rem',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
          color: 'var(--danger)', fontSize: '0.875rem',
        }}>
          {erreur}
        </div>
      )}
      {erreurAbonnement && !erreur && (
        <div style={{
          margin: '0 0 1rem', padding: '0.75rem 1rem', borderRadius: '0.5rem',
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
          color: 'var(--warning)', fontSize: '0.875rem',
        }}>
          {erreurAbonnement}
        </div>
      )}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{ margin: 0 }}>Tableau de bord</h1>
          <p className="text-secondary" style={{ marginTop: '0.5rem', fontSize: '0.95rem' }}>Aperçu de l'activité de votre établissement</p>
        </div>

        {/* Actions Rapides */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => navigate('/courses')}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all font-semibold text-sm shadow-sm"
          >
            <Plus size={18} /> Nouvelle Course
          </button>
          <button
            onClick={() => navigate('/children')}
            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 rounded-lg hover:bg-slate-50 transition-all font-semibold text-sm border border-slate-200"
          >
            <Plus size={18} /> Ajouter Élève
          </button>
          <button
            onClick={() => navigate('/live')}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all font-semibold text-sm shadow-sm"
          >
            <Zap size={18} /> Live Tracking
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
          <div className="text-secondary">Chargement...</div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
            {/* Card 1: Élèves - Cliquable */}
            <Link to="/children" className="glass-panel p-4 hover:shadow-lg transition-all cursor-pointer group" style={{ textDecoration: 'none', border: '2px solid transparent' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <GraduationCap size={28} className="text-blue-600" />
                </div>
                <span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-50 text-blue-600">+{stats.children > 0 ? '12%' : '0%'}</span>
              </div>
              <p className="text-sm text-slate-500 mb-1 font-medium">Élèves Inscrits</p>
              <h3 className="text-3xl font-bold text-slate-900">{stats.children}</h3>
            </Link>

            {/* Card 2: Parents - Cliquable */}
            <Link to="/parents" className="glass-panel p-4 hover:shadow-lg transition-all cursor-pointer group" style={{ textDecoration: 'none', border: '2px solid transparent' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="w-14 h-14 rounded-xl bg-indigo-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users size={28} className="text-indigo-600" />
                </div>
                <span className="text-xs font-bold px-2 py-1 rounded-full bg-indigo-50 text-indigo-600">+{stats.parents > 0 ? '8%' : '0%'}</span>
              </div>
              <p className="text-sm text-slate-500 mb-1 font-medium">Parents Associés</p>
              <h3 className="text-3xl font-bold text-slate-900">{stats.parents}</h3>
            </Link>

            {/* Card 3: Chauffeurs - Cliquable */}
            <Link to="/drivers" className="glass-panel p-4 hover:shadow-lg transition-all cursor-pointer group" style={{ textDecoration: 'none', border: '2px solid transparent' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="w-14 h-14 rounded-xl bg-emerald-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ShieldCheck size={28} className="text-emerald-600" />
                </div>
                <span className="text-xs font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-600">{stats.drivers > 0 ? 'Actifs' : '0'}</span>
              </div>
              <p className="text-sm text-slate-500 mb-1 font-medium">Chauffeurs</p>
              <h3 className="text-3xl font-bold text-slate-900">{stats.drivers}</h3>
            </Link>

            {/* Card 4: Véhicules - Cliquable */}
            <Link to="/cars" className="glass-panel p-4 hover:shadow-lg transition-all cursor-pointer group" style={{ textDecoration: 'none', border: '2px solid transparent' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="w-14 h-14 rounded-xl bg-amber-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Bus size={28} className="text-amber-600" />
                </div>
                <span className="text-xs font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-600">{stats.cars > 0 ? 'OK' : '0'}</span>
              </div>
              <p className="text-sm text-slate-500 mb-1 font-medium">Flotte de Bus</p>
              <h3 className="text-3xl font-bold text-slate-900">{stats.cars}</h3>
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
            {/* Activité Récente - Plus large */}
            <div className="glass-panel p-4">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <Activity size={22} style={{ color: 'var(--accent-primary)' }} />
                <h3 className="text-lg font-bold" style={{ margin: 0 }}>Activité Récente</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
                {recentActivities.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Aucune activité récente enregistrée.
                  </div>
                ) : (
                  recentActivities.map((activity) => {
                    const date = new Date(activity.createdAt);
                    const isApproaching = activity.metadata?.event === 'APPROACHING';
                    const isWarning = activity.type === 'WARNING';
                    
                    let badgeColor = 'var(--success)';
                    let badgeBg = 'rgba(16, 185, 129, 0.1)';
                    let statusLabel = 'Embarqué';

                    if (isApproaching) {
                      badgeColor = 'var(--warning-color, #f59e0b)';
                      badgeBg = 'rgba(245, 158, 11, 0.1)';
                      statusLabel = 'En approche';
                    } else if (isWarning) {
                      badgeColor = 'var(--danger)';
                      badgeBg = 'rgba(239, 68, 68, 0.1)';
                      statusLabel = 'Alerte';
                    } else if (activity.message.includes('descendu')) {
                      badgeColor = 'var(--accent-primary)';
                      badgeBg = 'rgba(79, 70, 229, 0.1)';
                      statusLabel = 'Descendu';
                    }

                    return (
                      <div className="activity-item" key={activity.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: badgeColor }}></div>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>{activity.title}</p>
                          <p className="text-secondary" style={{ margin: 0, fontSize: '0.75rem' }}>{activity.message}</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: badgeColor, background: badgeBg, padding: '0.2rem 0.5rem', borderRadius: '1rem', textTransform: 'uppercase' }}>
                            {statusLabel}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                            {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>


            {/* Raccourcis Utiles - Remplace welcome card */}
            <div className="glass-panel p-4">
              <h3 className="text-lg font-bold mb-4">Accès Rapides</h3>
              <div className="flex flex-col gap-3">
                <Link to="/courses" className="flex items-center gap-3 p-3 rounded-lg bg-white hover:bg-indigo-50 transition-colors border border-slate-100 hover:border-indigo-200 group" style={{ textDecoration: 'none' }}>
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                    <RouteIcon size={20} className="text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 text-sm">Gérer les Courses</p>
                    <p className="text-xs text-slate-500">Planifier et éditer</p>
                  </div>
                </Link>

                <Link to="/trajets" className="flex items-center gap-3 p-3 rounded-lg bg-white hover:bg-blue-50 transition-colors border border-slate-100 hover:border-blue-200 group" style={{ textDecoration: 'none' }}>
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    <MapPin size={20} className="text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 text-sm">Éditer les Trajets</p>
                    <p className="text-xs text-slate-500">Points et itinéraires</p>
                  </div>
                </Link>

                <Link to="/affectation" className="flex items-center gap-3 p-3 rounded-lg bg-white hover:bg-emerald-50 transition-colors border border-slate-100 hover:border-emerald-200 group" style={{ textDecoration: 'none' }}>
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                    <Users size={20} className="text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 text-sm">Affecter Élèves</p>
                    <p className="text-xs text-slate-500">Associer aux arrêts</p>
                  </div>
                </Link>

                <Link to="/suivi" className="flex items-center gap-3 p-3 rounded-lg bg-white hover:bg-purple-50 transition-colors border border-slate-100 hover:border-purple-200 group" style={{ textDecoration: 'none' }}>
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                    <Activity size={20} className="text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 text-sm">Suivi des Montées</p>
                    <p className="text-xs text-slate-500">Pointages élèves</p>
                  </div>
                </Link>

                {subscription && (
                  <button
                    onClick={() => setIsCheckoutOpen(true)}
                    className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all text-white mt-2"
                  >
                    <CreditCard size={20} />
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-sm">Abonnement</p>
                      <p className="text-xs opacity-90">{subscription.plan?.toUpperCase()}</p>
                    </div>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de checkout */}
      <CheckoutModal isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)} />
    </div>
  );
}
