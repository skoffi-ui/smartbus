import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api';
import { Plus, Trash2, Edit, Building, MapPin, Briefcase } from 'lucide-react';

type Onglet = 'departements' | 'zones' | 'postes';

interface Departement { id: number; dept_name: string; parent_dept?: { id: number; dept_name: string } }
interface Zone { id: number; area_name: string; description?: string }
interface Poste { id: number; position_name: string }

export default function BiotimeConfig() {
  const [onglet, setOnglet] = useState<Onglet>('departements');
  const [departements, setDepartements] = useState<Departement[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [postes, setPostes] = useState<Poste[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});

  const charger = async () => {
    setLoading(true);
    try {
      const [d, z, p] = await Promise.all([
        api.get('/biotime/mon-ecole/departments'),
        api.get('/biotime/mon-ecole/areas'),
        api.get('/biotime/mon-ecole/positions'),
      ]);
      setDepartements(Array.isArray(d.data) ? d.data : []);
      setZones(Array.isArray(z.data) ? z.data : []);
      setPostes(Array.isArray(p.data) ? p.data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { charger(); }, []);

  const ouvrir = (item?: any) => {
    setEditingItem(item ?? null);
    if (onglet === 'departements') {
      setFormData({ dept_name: item?.dept_name ?? '', parent_dept: item?.parent_dept?.id?.toString() ?? '' });
    } else if (onglet === 'zones') {
      setFormData({ area_name: item?.area_name ?? '', description: item?.description ?? '' });
    } else {
      setFormData({ position_name: item?.position_name ?? '' });
    }
    setShowForm(true);
  };

  const fermer = () => { setShowForm(false); setEditingItem(null); setFormData({}); };

  const endpoint = () => {
    if (onglet === 'departements') return 'departments';
    if (onglet === 'zones') return 'areas';
    return 'positions';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const base = `/biotime/mon-ecole/${endpoint()}`;
    try {
      const payload: any = { ...formData };
      if (payload.parent_dept) payload.parent_dept = Number(payload.parent_dept);
      else delete payload.parent_dept;

      if (editingItem) {
        await api.patch(`${base}/${editingItem.id}`, payload);
      } else {
        await api.post(base, payload);
      }
      fermer();
      await charger();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.message || "Erreur lors de l'opération.";
      alert(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  const supprimer = async (id: number, label: string) => {
    if (!window.confirm(`Supprimer « ${label} » du serveur BioTime ?`)) return;
    try {
      await api.delete(`/biotime/mon-ecole/${endpoint()}/${id}`);
      await charger();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Suppression impossible.');
    }
  };

  const onglets: { key: Onglet; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'departements', label: 'Départements (classes)', icon: <Building size={16} />, count: departements.length },
    { key: 'zones', label: 'Zones (areas)', icon: <MapPin size={16} />, count: zones.length },
    { key: 'postes', label: 'Postes (positions)', icon: <Briefcase size={16} />, count: postes.length },
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Configuration BioTime</h1>
          <p className="text-slate-500 mt-1">
            Gérez les départements, zones et postes sur votre serveur BioTime
          </p>
        </div>
        <button onClick={() => ouvrir()} className="btn btn-primary flex items-center gap-2">
          <Plus size={18} /> Ajouter
        </button>
      </div>

      {/* Onglets */}
      <div className="flex gap-2 mb-6 border-b border-slate-200 pb-0">
        {onglets.map((o) => (
          <button
            key={o.key}
            onClick={() => setOnglet(o.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
              onglet === o.key
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {o.icon} {o.label}
            <span className="ml-1 text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
              {o.count}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <>
          {/* Départements */}
          {onglet === 'departements' && (
            departements.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><Building size={40} /></div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Aucun département</h3>
                <p className="empty-text">Créez des départements (classes) sur votre serveur BioTime.</p>
              </div>
            ) : (
              <div className="premium-table-wrapper">
                <div className="overflow-x-auto">
                  <table className="premium-table">
                    <thead><tr><th>ID</th><th>Nom</th><th>Parent</th><th className="text-right">Actions</th></tr></thead>
                    <tbody>
                      {departements.map((d) => (
                        <tr key={d.id} className="premium-row">
                          <td className="font-mono text-sm text-slate-500">{d.id}</td>
                          <td className="font-bold text-slate-800">{d.dept_name}</td>
                          <td className="text-sm text-slate-500">{d.parent_dept?.dept_name ?? '—'}</td>
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => ouvrir(d)} className="btn-icon-primary" title="Modifier"><Edit size={14} /></button>
                              <button onClick={() => supprimer(d.id, d.dept_name)} className="btn-icon-danger" title="Supprimer"><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {/* Zones */}
          {onglet === 'zones' && (
            zones.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><MapPin size={40} /></div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Aucune zone</h3>
                <p className="empty-text">Créez des zones (areas) pour mapper vos trajets sur BioTime.</p>
              </div>
            ) : (
              <div className="premium-table-wrapper">
                <div className="overflow-x-auto">
                  <table className="premium-table">
                    <thead><tr><th>ID</th><th>Nom</th><th>Description</th><th className="text-right">Actions</th></tr></thead>
                    <tbody>
                      {zones.map((z) => (
                        <tr key={z.id} className="premium-row">
                          <td className="font-mono text-sm text-slate-500">{z.id}</td>
                          <td className="font-bold text-slate-800">{z.area_name}</td>
                          <td className="text-sm text-slate-500">{z.description ?? '—'}</td>
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => ouvrir(z)} className="btn-icon-primary" title="Modifier"><Edit size={14} /></button>
                              <button onClick={() => supprimer(z.id, z.area_name)} className="btn-icon-danger" title="Supprimer"><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {/* Postes */}
          {onglet === 'postes' && (
            postes.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><Briefcase size={40} /></div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Aucun poste</h3>
                <p className="empty-text">Créez des postes (positions) pour catégoriser vos élèves.</p>
              </div>
            ) : (
              <div className="premium-table-wrapper">
                <div className="overflow-x-auto">
                  <table className="premium-table">
                    <thead><tr><th>ID</th><th>Nom</th><th className="text-right">Actions</th></tr></thead>
                    <tbody>
                      {postes.map((p) => (
                        <tr key={p.id} className="premium-row">
                          <td className="font-mono text-sm text-slate-500">{p.id}</td>
                          <td className="font-bold text-slate-800">{p.position_name}</td>
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => ouvrir(p)} className="btn-icon-primary" title="Modifier"><Edit size={14} /></button>
                              <button onClick={() => supprimer(p.id, p.position_name)} className="btn-icon-danger" title="Supprimer"><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </>
      )}

      {/* Modal dynamique */}
      {showForm && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="premium-modal w-full max-w-md animate-fade-in">
            <div className="premium-modal-header">
              <div className="premium-modal-icon">
                {onglet === 'departements' ? <Building size={20} /> : onglet === 'zones' ? <MapPin size={20} /> : <Briefcase size={20} />}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  {editingItem ? 'Modifier' : 'Créer'}{' '}
                  {onglet === 'departements' ? 'un département' : onglet === 'zones' ? 'une zone' : 'un poste'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Les changements seront appliqués sur votre serveur BioTime.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="premium-modal-body">
                {onglet === 'departements' && (
                  <>
                    <div className="premium-input-group">
                      <label className="premium-input-label">Nom du département</label>
                      <div className="premium-input-wrapper">
                        <Building size={16} className="premium-input-icon" />
                        <input
                          required type="text" className="premium-input" placeholder="Ex: 6ème A"
                          value={formData.dept_name ?? ''}
                          onChange={(e) => setFormData({ ...formData, dept_name: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="premium-input-group mb-0">
                      <label className="premium-input-label">ID parent (optionnel)</label>
                      <div className="premium-input-wrapper">
                        <Building size={16} className="premium-input-icon" />
                        <input
                          type="number" className="premium-input" placeholder="Ex: 1"
                          value={formData.parent_dept ?? ''}
                          onChange={(e) => setFormData({ ...formData, parent_dept: e.target.value })}
                        />
                      </div>
                    </div>
                  </>
                )}

                {onglet === 'zones' && (
                  <>
                    <div className="premium-input-group">
                      <label className="premium-input-label">Nom de la zone</label>
                      <div className="premium-input-wrapper">
                        <MapPin size={16} className="premium-input-icon" />
                        <input
                          required type="text" className="premium-input" placeholder="Ex: Cocody_Matin"
                          value={formData.area_name ?? ''}
                          onChange={(e) => setFormData({ ...formData, area_name: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="premium-input-group mb-0">
                      <label className="premium-input-label">Description (optionnel)</label>
                      <div className="premium-input-wrapper">
                        <MapPin size={16} className="premium-input-icon" />
                        <input
                          type="text" className="premium-input" placeholder="Ex: Trajet Cocody vers École"
                          value={formData.description ?? ''}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                      </div>
                    </div>
                  </>
                )}

                {onglet === 'postes' && (
                  <div className="premium-input-group mb-0">
                    <label className="premium-input-label">Nom du poste</label>
                    <div className="premium-input-wrapper">
                      <Briefcase size={16} className="premium-input-icon" />
                      <input
                        required type="text" className="premium-input" placeholder="Ex: Élève Standard"
                        value={formData.position_name ?? ''}
                        onChange={(e) => setFormData({ ...formData, position_name: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="premium-modal-footer">
                <button type="button" onClick={fermer} className="btn btn-secondary flex-1 font-semibold py-1.5 text-sm">Annuler</button>
                <button type="submit" className="btn btn-primary flex-1 font-semibold py-1.5 text-sm">{editingItem ? 'Modifier' : 'Créer'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
