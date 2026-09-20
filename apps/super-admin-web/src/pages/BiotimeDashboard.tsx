import { useEffect, useState, useMemo } from 'react';
import { Bus, CheckCircle, Search, Download, RefreshCw } from 'lucide-react';
import api, { messageFromError } from '../services/api';


export default function BiotimeDashboard() {
  const [punchesMap, setPunchesMap] = useState<Record<string, any[]>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingPunches, setLoadingPunches] = useState(true);
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Nouveaux états de configuration
  const [serverUrl, setServerUrl] = useState('http://160.120.143.20:8080');
  const [savingConfig, setSavingConfig] = useState(false);

  const fetchConfig = async () => {
    try {
      const res = await api.get('/biotime/config');
      if (res.data && res.data.url) {
        setServerUrl(res.data.url);
      }
    } catch (err) {
      console.error("Erreur de chargement de la config BioTime", err);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await api.post('/biotime/config', { url: serverUrl });
      alert("Configuration serveur sauvegardée avec succès.");
    } catch (err: any) {
      alert(messageFromError(err, 'Erreur lors de la sauvegarde de la configuration.'));
    } finally {
      setSavingConfig(false);
    }
  };



  const fetchPunches = async () => {
    setLoadingPunches(true);
    try {
      const res = await api.get('/biotime/punches', { params: { date: filterDate } });
      setPunchesMap(res.data);
    } catch (err) {
      console.error("Erreur de chargement des pointages", err);
    } finally {
      setLoadingPunches(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchPunches();

    // Auto refresh every 3 seconds
    const interval = setInterval(() => {
      fetchPunches();
    }, 3000);

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



  return (
    <div className="animate-fade-in">
      {/* HEADER ACTIONS */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">BioTime - Supervision Matérielle</h1>
          <p className="text-navy-300 mt-1">Affichage en temps réel des flux et de l'état des badgeuses physiques.</p>
        </div>
      </div>

      {/* BioTime Settings & Devices configuration */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* URL configuration */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h3 className="text-lg text-white" style={{ fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            ⚙️ Serveur BioTime
          </h3>
          <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label className="text-navy-300 text-xs font-semibold block mb-1">Adresse IP / Hôte</label>
              <input
                type="text"
                required
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '0.375rem', padding: '0.5rem', color: 'var(--text-primary)', outline: 'none', fontSize: '0.9rem' }}
                placeholder="Ex: http://160.120.143.20:8080"
              />
            </div>
            <button
              type="submit"
              disabled={savingConfig}
              className="btn-primary"
              style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }}
            >
              {savingConfig ? 'Sauvegarde...' : 'Mettre à jour'}
            </button>
          </form>
        </div>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
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

                return Object.entries(groupedByTerminal as Record<string, any[]>).map(([terminalName, punches]) => (
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
