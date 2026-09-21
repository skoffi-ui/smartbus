import React, { useEffect, useState } from 'react';
import api, { messageFromError } from '../services/api';
import { Bus, Users, GraduationCap, ShieldCheck, Activity, CreditCard, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import CheckoutModal from '../components/CheckoutModal';
import './Dashboard.css';

export default function Dashboard() {
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
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl" style={{ margin: 0 }}>Tableau de bord</h1>
          <p className="text-secondary" style={{ marginTop: '0.25rem' }}>Aperçu de l'activité de votre établissement</p>
        </div>
        <button 
          onClick={() => setIsCheckoutOpen(true)}
          className="btn-primary flex items-center gap-2"
          style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem', fontWeight: 600 }}
        >
          <CreditCard size={18} /> Gérer l'abonnement
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
          <div className="text-secondary">Chargement...</div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Section Abonnement si existant */}
          {subscription && (
            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid var(--accent-primary)', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(79, 70, 229, 0.1)', color: 'var(--accent-primary)' }}>
                  <CreditCard size={24} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
                    Forfait Actuel : <span className="text-accent" style={{ fontWeight: 800 }}>{subscription.plan?.toUpperCase()}</span>
                  </h4>
                  <p className="text-secondary text-xs" style={{ margin: '0.2rem 0 0 0', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Clock size={12} /> Expire le : {new Date(subscription.endDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{
                  fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.75rem', borderRadius: '999px',
                  background: subscription.status === 'active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: subscription.status === 'active' ? 'var(--success)' : 'var(--danger)',
                  textTransform: 'uppercase'
                }}>
                  {subscription.status}
                </span>
                <button onClick={() => setIsCheckoutOpen(true)} className="btn btn-secondary text-xs" style={{ padding: '0.4rem 0.8rem' }}>
                  Renouveler / Changer
                </button>
              </div>
            </div>
          )}

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

          <div className="dashboard-bottom-grid">
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <Activity size={24} style={{ color: 'var(--accent-primary)' }} />
                <h3 className="text-xl" style={{ margin: 0 }}>Activité Récente</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '350px', overflowY: 'auto' }}>
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
        </div>
      )}

      {/* Modal de checkout */}
      <CheckoutModal isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)} />
    </div>
  );
}
