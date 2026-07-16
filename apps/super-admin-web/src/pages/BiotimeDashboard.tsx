import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import TopNav from '../components/TopNav';
import { Users, Clock, Bus, CheckCircle, Search, Download, RefreshCw, User } from 'lucide-react';

const API_BASE = 'http://localhost:3000/api/v1/biotime';
const BIOTIME_IP = 'http://160.120.143.20';

export default function BiotimeDashboard() {
  const [children, setChildren] = useState<any[]>([]);
  const [punchesMap, setPunchesMap] = useState<Record<string, any[]>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [loadingPunches, setLoadingPunches] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const syncEmployees = async () => {
    setSyncing(true);
    try {
      await axios.post(`${API_BASE}/sync-children`);
      await fetchChildren();
      alert('Synchronisation terminée avec succès.');
    } catch (err) {
      console.error("Erreur de synchronisation", err);
      alert('Erreur lors de la synchronisation avec BioTime.');
    } finally {
      setSyncing(false);
    }
  };

  const fetchChildren = async () => {
    setLoadingChildren(true);
    try {
      const res = await axios.get(`${API_BASE}/children?date=${filterDate}`);
      setChildren(res.data);
    } catch (err) {
      console.error("Erreur de chargement des enfants", err);
    } finally {
      setLoadingChildren(false);
    }
  };

  const fetchPunches = async () => {
    setLoadingPunches(true);
    try {
      const res = await axios.get(`${API_BASE}/punches?date=${filterDate}`);
      setPunchesMap(res.data);
    } catch (err) {
      console.error("Erreur de chargement des pointages", err);
    } finally {
      setLoadingPunches(false);
    }
  };

  useEffect(() => {
    fetchChildren();
    fetchPunches();

    // Auto refresh every 30 seconds
    const interval = setInterval(() => {
      fetchChildren();
      fetchPunches();
    }, 30000);

    return () => clearInterval(interval);
  }, [filterDate]);

  const totalPunches = useMemo(() => {
    let count = 0;
    Object.values(punchesMap).forEach(arr => { count += arr.length; });
    return count;
  }, [punchesMap]);

  const exportCSV = () => {
    let csvContent = "Date,Heure,Statut,Matricule,Nom,Prenom,Classe,Terminal\n";

    for (const [dateStr, punches] of Object.entries(punchesMap)) {
      punches.forEach((p: any) => {
        const child = p.child || {};
        const row = [
          `"${dateStr}"`,
          `"${p.time}"`,
          `"${p.stateLabel}"`,
          `"${child.empCode || ''}"`,
          `"${child.lastName || ''}"`,
          `"${child.firstName || ''}"`,
          `"${child.className || ''}"`,
          `"${p.terminal || ''}"`
        ];
        csvContent += row.join(",") + "\n";
      });
    }

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `rapport_pointages_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredChildren = children.filter(child => {
    const term = searchTerm.toLowerCase();
    const name = `${child.firstName} ${child.lastName}`.toLowerCase();
    const dept = (child.departmentName || '').toLowerCase();
    return name.includes(term) || dept.includes(term);
  });

  return (
    <div className="animate-fade-in">
      {/* HEADER ACTIONS */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">BioTime - Suivi des Enfants</h1>
          <p className="text-navy-300 mt-1">Affichage en temps réel des pointages des enfants dans les bus.</p>
        </div>
        <button
          onClick={syncEmployees}
          disabled={syncing}
          className="btn-primary flex items-center gap-2"
        >
          {syncing ? 'Synchronisation...' : ' Synchroniser avec BioTime'}
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex justify-between items-center mb-6">
        <div style={{ display: 'flex', gap: '1rem', width: '50%' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '0.5rem', padding: '0.5rem 1rem', flex: 1 }}>
            <Search size={18} className="text-secondary" style={{ marginRight: '0.75rem' }} />
            <input
              type="text"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '100%', fontFamily: 'var(--font-sans)' }}
              placeholder="Rechercher un enfant, un terminal..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '0.5rem', padding: '0.5rem 1rem' }}>
            <input
              type="date"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font-sans)' }}
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="glass-panel flex items-center" style={{ padding: '1rem' }}>
          <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '1rem', background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' }}>
            <Users size={24} />
          </div>
          <div>
            <h3 className="text-secondary text-sm" style={{ fontWeight: 500 }}>Enfants Inscrits</h3>
            <p className="text-2xl" style={{ fontWeight: 700 }}>{children.length}</p>
          </div>
        </div>

        <div className="glass-panel flex items-center" style={{ padding: '1rem' }}>
          <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '1rem', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>
            <CheckCircle size={24} />
          </div>
          <div>
            <h3 className="text-secondary text-sm" style={{ fontWeight: 500 }}>
              Pointages le {new Date(filterDate).toLocaleDateString('fr-FR')}
            </h3>
            <p className="text-2xl" style={{ fontWeight: 700 }}>{totalPunches}</p>
          </div>
        </div>

        <div className="glass-panel flex items-center" style={{ padding: '1rem' }}>
          <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '1rem', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}>
            <Bus size={24} />
          </div>
          <div>
            <h3 className="text-secondary text-sm" style={{ fontWeight: 500 }}>Bus Actifs</h3>
            <p className="text-2xl" style={{ fontWeight: 700 }}>
              {(() => {
                const terms = new Set();
                Object.values(punchesMap).forEach(arr => arr.forEach(p => terms.add(p.terminal)));
                return terms.size;
              })()}
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        {/* Children Section */}
        <section className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '600px' }}>
          <div className="flex justify-between items-center" style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--glass-border)' }}>
            <h2 className="text-xl">Derniers Enfants Synchronisés</h2>
            <button onClick={fetchChildren} className="btn btn-secondary" style={{ padding: '0.4rem', border: 'none', background: 'transparent' }}>
              <RefreshCw size={18} />
            </button>
          </div>

          <div className="custom-scrollbar" style={{ 
            overflowY: 'auto', padding: '1rem', flex: 1, display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem', gridAutoRows: 'min-content' 
          }}>
            <style>{`
              .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
              .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); border-radius: 10px; }
              .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
              .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.25); }
              .child-card { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
              .child-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px -10px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.06) !important; border-color: rgba(255,255,255,0.15) !important; }
            `}</style>
            
            {loadingChildren ? (
              <p className="text-center text-secondary w-full" style={{ gridColumn: '1 / -1' }}>Chargement des données...</p>
            ) : filteredChildren.length === 0 ? (
              <p className="text-center text-secondary w-full" style={{ gridColumn: '1 / -1' }}>Aucun enfant trouvé.</p>
            ) : (
              filteredChildren.map(child => {
                const targetDate = new Date(filterDate).toDateString();
                const todayPunches = child.punches ? child.punches.filter((p: any) => new Date(p.punchTime).toDateString() === targetDate) : [];
                const photoUrl = child.photo && child.photo.trim() !== '' ? `${BIOTIME_IP}${child.photo}` : null;

                return (
                  <div key={child.id} className="child-card" style={{ 
                    background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', 
                    borderRadius: '1rem', padding: '0px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem',
                    position: 'relative', minHeight: '120px'
                  }}>
                    {/* Glowing Accent */}
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: todayPunches.length > 0 ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)', borderTopLeftRadius: '1rem', borderBottomLeftRadius: '1rem' }}></div>

                    {/* Photo with Ring */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      {photoUrl ? (
                        <img src={photoUrl} alt="Photo" style={{ width: '3.5rem', height: '3.5rem', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}
                          onError={(e) => { e.currentTarget.style.display = 'none'; const fb = e.currentTarget.parentElement?.querySelector('.fallback-icon') as HTMLElement; if (fb) fb.style.display = 'flex'; }} />
                      ) : null}
                      <div className="fallback-icon" style={{ width: '3.5rem', height: '3.5rem', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)', display: photoUrl ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <User size={24} className="text-secondary" />
                      </div>
                      
                      {/* Status Dot */}
                      <div style={{ 
                        position: 'absolute', bottom: 0, right: '-2px', width: '12px', height: '12px', borderRadius: '50%', 
                        background: todayPunches.length > 0 ? '#10b981' : '#64748b', border: '2px solid #0f172a',
                        boxShadow: todayPunches.length > 0 ? '0 0 8px rgba(16, 185, 129, 0.6)' : 'none'
                      }}></div>
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
                      <h4 className="text-white" style={{ fontWeight: 700, fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.02em', margin: 0 }}>
                        {child.firstName} {child.lastName}
                      </h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', marginTop: '0.2rem' }}>
                        <span className="text-navy-300" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                          {child.departmentName || 'Non assigné'}
                        </span>
                        <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px', color: '#94a3b8', fontFamily: 'monospace' }}>
                          ID: {child.empCode}
                        </span>
                      </div>

                      {todayPunches.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                          {todayPunches.sort((a: any, b: any) => new Date(a.punchTime).getTime() - new Date(b.punchTime).getTime()).map((p: any, idx: number) => {
                            const d = new Date(p.punchTime);
                            const hour = d.getHours();
                            const isSaturday = d.getDay() === 6; // 0=Dimanche, 6=Samedi

                            let label = 'Pointage';
                            if (isSaturday) {
                              // Samedi : Montée le matin (4h-10h), Descente à partir de 11h (10h-15h)
                              label = (hour >= 4 && hour < 10) ? 'Montée' : ((hour >= 10 && hour < 15) ? 'Descente' : 'Pointage');
                            } else {
                              // Jours normaux
                              label = (hour >= 4 && hour < 12) ? 'Montée' : ((hour >= 14 && hour < 23) ? 'Descente' : 'Pointage');
                            }
                            const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

                            let color = label === 'Montée' ? '#60a5fa' : (label === 'Descente' ? '#fbbf24' : '#34d399');
                            let bg = label === 'Montée' ? 'rgba(59, 130, 246, 0.15)' : (label === 'Descente' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)');
                            let border = label === 'Montée' ? 'rgba(59, 130, 246, 0.3)' : (label === 'Descente' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)');

                            return (
                              <span key={idx} style={{ 
                                fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '2rem', 
                                display: 'inline-flex', alignItems: 'center', color: color, background: bg, 
                                fontWeight: 600, border: `1px solid ${border}`, backdropFilter: 'blur(4px)'
                              }}>
                                <Clock size={10} style={{ marginRight: '0.25rem' }} /> {label} {timeStr}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-navy-300" style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', fontWeight: 500, opacity: 0.7 }}>
                          <Clock size={12} style={{ marginRight: '0.3rem' }} /> En attente
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Activity Section */}
        <section className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '600px' }}>
          <div className="flex justify-between items-center" style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--glass-border)' }}>
            <h2 className="text-xl">Activité en Direct</h2>
            <div className="flex gap-2">
              <button onClick={exportCSV} className="btn btn-secondary" style={{ padding: '0.4rem', border: 'none', background: 'transparent' }} title="Exporter CSV">
                <Download size={18} />
              </button>
              <button onClick={fetchPunches} className="btn btn-secondary" style={{ padding: '0.4rem', border: 'none', background: 'transparent' }} title="Rafraîchir">
                <RefreshCw size={18} />
              </button>
            </div>
          </div>

          <div style={{ overflowY: 'auto', padding: '1rem', flex: 1 }}>
            {loadingPunches ? (
              <p className="text-center text-secondary">Chargement de l'historique...</p>
            ) : totalPunches === 0 ? (
              <p className="text-center text-secondary">Aucun pointage aujourd'hui</p>
            ) : (
              (() => {
                const allPunches: any[] = [];
                Object.values(punchesMap).forEach(arr => allPunches.push(...arr));
                
                const filteredPunches = allPunches.filter(p => {
                  const term = searchTerm.toLowerCase();
                  const childName = p.child ? `${p.child.firstName} ${p.child.lastName}`.toLowerCase() : '';
                  const terminal = (p.terminal || '').toLowerCase();
                  return childName.includes(term) || terminal.includes(term);
                });

                if (filteredPunches.length === 0) return <p className="text-center text-secondary">Aucun résultat trouvé.</p>;

                // Regroupement par badgeuse
                const groupedByTerminal = filteredPunches.reduce((acc, punch) => {
                  const term = punch.terminal || 'Terminal Inconnu';
                  if (!acc[term]) acc[term] = [];
                  acc[term].push(punch);
                  return acc;
                }, {} as Record<string, any[]>);

                return Object.entries(groupedByTerminal).map(([terminalName, punches]) => (
                  <div key={terminalName} className="mb-6">
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.05em', display: 'flex', alignItems: 'center' }}>
                      <Bus size={14} style={{ marginRight: '0.5rem' }} /> {terminalName} 
                      <span className="text-secondary ml-2 text-xs" style={{ background: 'rgba(255,255,255,0.1)', padding: '0.1rem 0.4rem', borderRadius: '1rem' }}>
                        {punches.length} pointages
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {punches.map((punch: any, idx: number) => {
                        const isOut = punch.stateLabel === 'DESCENTE';
                        const childName = punch.child ? `${punch.child.firstName} ${punch.child.lastName}` : 'Enfant Inconnu';
                        
                        return (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '0.5rem', padding: '0.75rem' }}>
                            <div className="text-secondary" style={{ fontSize: '0.875rem', fontFamily: 'monospace', flexShrink: 0 }}>{punch.time}</div>
                            <div style={{ width: '4px', height: '2rem', borderRadius: '2px', flexShrink: 0, background: isOut ? 'var(--warning)' : 'var(--accent-primary)' }}></div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <h4 style={{ fontWeight: 500, fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>{childName}</h4>
                                <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', borderRadius: '0.25rem', flexShrink: 0, background: isOut ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)', color: isOut ? 'var(--warning)' : 'var(--accent-primary)' }}>
                                  {punch.stateLabel}
                                </span>
                              </div>
                              <div className="text-navy-300" style={{ fontSize: '0.7rem', marginTop: '0.2rem' }}>
                                ID: {punch.child ? punch.child.empCode : 'N/A'}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
