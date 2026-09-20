import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Edit, Trash2, User, Key, Download, Search, CheckSquare, Square, ChevronRight } from 'lucide-react';
import './Children.css';
import { GATEWAY_URL } from '../config';

export default function Children() {
  const navigate = useNavigate();
  const [children, setChildren] = useState<any[]>([]);
  const [parents, setParents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ 
    firstName: '', lastName: '', className: '', empCode: '', parentId: '' 
  });

  // Import Modal states
  const [showImportModal, setShowImportModal] = useState(false);
  const [biotimeDirectory, setBiotimeDirectory] = useState<any[]>([]);
  const [importSearch, setImportSearch] = useState('');
  const [selectedEmpCodes, setSelectedEmpCodes] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [childRes, parentRes] = await Promise.all([
        fetch(`${GATEWAY_URL}/api/v1/children`, { headers }),
        fetch(`${GATEWAY_URL}/api/v1/parents`, { headers })
      ]);
      
      if (childRes.ok) setChildren(await childRes.json());
      if (parentRes.ok) setParents(await parentRes.json());
      
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchBiotimeDirectory = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${GATEWAY_URL}/api/v1/children/biotime-directory`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setBiotimeDirectory(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenImportModal = () => {
    setShowImportModal(true);
    fetchBiotimeDirectory();
  };

  const handleBulkImport = async () => {
    if (selectedEmpCodes.length === 0) return;
    setImporting(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${GATEWAY_URL}/api/v1/children/bulk-import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ empCodes: selectedEmpCodes })
      });
      
      if (res.ok) {
        setShowImportModal(false);
        setSelectedEmpCodes([]);
        fetchData();
      } else {
        const err = await res.json();
        alert(`Erreur d'importation: ${err.message}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setImporting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('accessToken');
      // If empCode is empty string, we want it to be null or omitted so it doesn't trigger unique constraints
      const payload = { ...formData };
      if (!payload.empCode) delete (payload as any).empCode;
      if (!payload.parentId) delete (payload as any).parentId;
      
      const res = await fetch(`${GATEWAY_URL}/api/v1/children`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setShowModal(false);
        setFormData({ firstName: '', lastName: '', className: '', empCode: '', parentId: '' });
        fetchData();
      } else {
        const err = await res.json();
        alert(`Erreur: ${err.message}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Voulez-vous vraiment supprimer cet élève ?')) return;
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${GATEWAY_URL}/api/v1/children/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6" style={{ gap: '5px', flexWrap: 'wrap' }}>
        <div style={{ marginRight: 'auto' }}>
          <h1 className="text-2xl font-bold text-slate-800">Gestion des Élèves</h1>
          <p className="text-slate-500 mt-1">Gérez les enfants, liez-les aux parents et aux cartes BioTime.</p>
        </div>
        <div className="flex" style={{ gap: '5px', flexWrap: 'wrap' }}>
          <button onClick={handleOpenImportModal} className="btn btn-secondary flex items-center gap-2">
            <Download size={18} /> Importer depuis BioTime
          </button>
          <button onClick={() => setShowModal(true)} className="btn btn-primary flex items-center gap-2">
            <Plus size={18} /> Inscrire un Élève
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : children.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <Users size={40} />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Aucun Élève</h3>
          <p className="empty-text">Commencez par ajouter des élèves manuellement ou importez-les directement depuis votre base de données BioTime.</p>
          <div className="flex mt-4 justify-center" style={{ gap: '5px' }}>
            <button onClick={handleOpenImportModal} className="btn btn-secondary flex items-center gap-2">
              <Download size={18} /> Importer
            </button>
            <button onClick={() => setShowModal(true)} className="btn btn-primary flex items-center gap-2">
              <Plus size={18} /> Inscrire
            </button>
          </div>
        </div>
      ) : (
        <div className="children-grid">
          {children.map(child => (
            <div key={child.id} className="child-card">
              <div className="child-card-header">
                <div className="child-avatar">
                  {child.photoUrl ? (
                    <img src={child.photoUrl} alt="avatar" />
                  ) : (
                    <User size={30} className="text-slate-300" />
                  )}
                </div>
                <div className="child-info">
                  <h3 className="child-name">{child.firstName} {child.lastName}</h3>
                  <span className="child-class-badge">{child.className || 'Sans Classe'}</span>
                </div>
              </div>
              
              <div className="child-card-body">
                <div className="child-detail-row">
                  <Key size={16} className="child-detail-icon" />
                  {child.empCode ? (
                    <span className="text-emerald-600 font-mono font-medium bg-emerald-50 px-2 py-0.5 rounded">Badge #{child.empCode}</span>
                  ) : (
                    <span className="italic">Aucun badge assigné</span>
                  )}
                </div>
                <div className="child-detail-row">
                  <Users size={16} className="child-detail-icon" />
                  {child.parent ? (
                    <span>Parent : {child.parent.firstName} {child.parent.lastName}</span>
                  ) : (
                    <span className="italic">Aucun parent assigné</span>
                  )}
                </div>
              </div>

              <div className="child-card-footer">
                <button onClick={() => navigate(`/children/${child.id}`)} className="btn-profile">
                  Voir Profil <ChevronRight size={16} />
                </button>
                <button onClick={() => handleDelete(child.id)} className="btn-icon-danger" title="Supprimer l'élève">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal d'ajout */}
      {/* Rendu dans un portail vers `document.body` : hors de l'arbre de la page,
          aucun ancêtre transformé ne peut servir de référentiel à `position: fixed`.
          La surcouche couvre donc réellement la fenêtre. */}
      {showModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="premium-modal w-full max-w-md animate-fade-in">
            <div className="premium-modal-header">
              <div className="premium-modal-icon">
                <Users size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Inscrire un Élève</h2>
                <p className="text-xs text-slate-500 mt-1">Saisissez les informations de l'élève.</p>
              </div>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="premium-modal-body">
                <div className="premium-input-group">
                  <label className="premium-input-label">Prénom</label>
                  <div className="premium-input-wrapper">
                    <User size={16} className="premium-input-icon" />
                    <input required type="text" className="premium-input" placeholder="Ex: Lucas" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                  </div>
                </div>
                
                <div className="premium-input-group">
                  <label className="premium-input-label">Nom</label>
                  <div className="premium-input-wrapper">
                    <User size={16} className="premium-input-icon" />
                    <input required type="text" className="premium-input" placeholder="Ex: Martin" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                  </div>
                </div>
                
                <div className="premium-input-group">
                  <label className="premium-input-label">Classe (Optionnel)</label>
                  <div className="premium-input-wrapper">
                    <ChevronRight size={16} className="premium-input-icon" />
                    <input type="text" className="premium-input" placeholder="Ex: CP2" value={formData.className} onChange={e => setFormData({...formData, className: e.target.value})} />
                  </div>
                </div>
                
                <div className="premium-input-group">
                  <label className="premium-input-label">Matricule BioTime (empCode)</label>
                  <div className="premium-input-wrapper">
                    <Key size={16} className="premium-input-icon" />
                    <input type="text" className="premium-input" placeholder="Ex: 10025" value={formData.empCode} onChange={e => setFormData({...formData, empCode: e.target.value})} />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Laissez vide si l'enfant n'a pas encore de badge.</p>
                </div>

                <div className="premium-input-group mb-0">
                  <label className="premium-input-label">Parent Associé</label>
                  <div className="premium-input-wrapper">
                    <Users size={16} className="premium-input-icon" />
                    <select className="premium-input appearance-none" value={formData.parentId} onChange={e => setFormData({...formData, parentId: e.target.value})}>
                      <option value="">Sélectionnez un parent (Optionnel)</option>
                      {parents.map(p => (
                        <option key={p.id} value={p.id}>{p.firstName} {p.lastName} - {p.phone}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="premium-modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1 font-semibold py-1.5 text-sm">Annuler</button>
                <button type="submit" className="btn btn-primary flex-1 font-semibold py-1.5 text-sm">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}

      {/* Modal d'importation BioTime */}
      {/* Rendu dans un portail vers `document.body` : hors de l'arbre de la page,
          aucun ancêtre transformé ne peut servir de référentiel à `position: fixed`.
          La surcouche couvre donc réellement la fenêtre. */}
      {showImportModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="import-modal-container mt-8 p-6 pt-10 w-full max-w-4xl animate-fade-in max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Download size={24} className="text-indigo-600" /> Importer des Élèves depuis BioTime
              </h2>
              <button type="button" onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors">
                Fermer
              </button>
            </div>

            <div className="mb-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Rechercher par nom, prénom ou classe..." 
                className="form-input pl-10 bg-slate-50 border-slate-200"
                value={importSearch}
                onChange={e => setImportSearch(e.target.value)}
              />
            </div>

            <div className="flex-1 overflow-auto import-table-wrapper mb-6">
              <table className="import-table">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="w-12 text-center rounded-tl-lg">
                      <div 
                        onClick={() => {
                          const available = biotimeDirectory.filter(b => !children.some(c => c.empCode === b.empCode));
                          if (selectedEmpCodes.length === available.length && available.length > 0) {
                            setSelectedEmpCodes([]);
                          } else {
                            setSelectedEmpCodes(available.map(b => b.empCode));
                          }
                        }}
                        className={`custom-checkbox mx-auto ${selectedEmpCodes.length > 0 && selectedEmpCodes.length === biotimeDirectory.filter(b => !children.some(c => c.empCode === b.empCode)).length ? 'checked' : ''}`}
                      >
                        {selectedEmpCodes.length > 0 && selectedEmpCodes.length === biotimeDirectory.filter(b => !children.some(c => c.empCode === b.empCode)).length && <CheckSquare size={14} strokeWidth={3} />}
                      </div>
                    </th>
                    <th>Photo</th>
                    <th>Élève</th>
                    <th>Département / Classe</th>
                    <th className="rounded-tr-lg">Matricule</th>
                  </tr>
                </thead>
                <tbody>
                  {biotimeDirectory
                    .filter(b => !children.some(c => c.empCode === b.empCode))
                    .filter(b => `${b.firstName} ${b.lastName} ${b.departmentName}`.toLowerCase().includes(importSearch.toLowerCase()))
                    .map(b => (
                    <tr key={b.empCode} className={`import-row ${selectedEmpCodes.includes(b.empCode) ? 'selected' : ''}`}>
                      <td className="text-center">
                        <div 
                          onClick={() => {
                            if (selectedEmpCodes.includes(b.empCode)) {
                              setSelectedEmpCodes(selectedEmpCodes.filter(id => id !== b.empCode));
                            } else {
                              setSelectedEmpCodes([...selectedEmpCodes, b.empCode]);
                            }
                          }}
                          className={`custom-checkbox mx-auto ${selectedEmpCodes.includes(b.empCode) ? 'checked' : ''}`}
                        >
                          {selectedEmpCodes.includes(b.empCode) && <CheckSquare size={14} strokeWidth={3} />}
                        </div>
                      </td>
                      <td>
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                          {b.photo ? (
                            <img src={b.photo.startsWith('/') ? `http://160.120.143.20${b.photo}` : b.photo.startsWith('http') ? b.photo : `data:image/jpeg;base64,${b.photo}`} alt="avatar" className="import-avatar" />
                          ) : (
                            <User size={20} className="text-slate-400" />
                          )}
                        </div>
                      </td>
                      <td className="font-bold text-slate-800">{b.firstName} {b.lastName}</td>
                      <td>
                        {b.departmentName ? (
                           <span className="child-class-badge bg-indigo-50">{b.departmentName}</span>
                        ) : (
                          <span className="text-slate-400 italic">Non défini</span>
                        )}
                      </td>
                      <td>
                        <span className="text-slate-500 font-mono text-sm bg-slate-100 px-2 py-1 rounded border border-slate-200">{b.empCode}</span>
                      </td>
                    </tr>
                  ))}
                  {biotimeDirectory.filter(b => !children.some(c => c.empCode === b.empCode)).length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-12 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-400">
                           <CheckSquare size={48} className="mb-4 text-emerald-400 opacity-50" />
                           <p className="text-lg font-medium text-slate-600">Tout est à jour !</p>
                           <p className="text-sm">Tous les élèves de BioTime sont déjà dans votre école.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center mt-auto pt-4 border-t border-slate-100">
              <span className="text-sm text-slate-500">
                {selectedEmpCodes.length} élève(s) sélectionné(s)
              </span>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowImportModal(false)} className="btn btn-secondary">Annuler</button>
                <button 
                  type="button"
                  onClick={handleBulkImport} 
                  disabled={selectedEmpCodes.length === 0 || importing}
                  className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
                >
                  {importing ? 'Importation...' : 'Importer la sélection'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
