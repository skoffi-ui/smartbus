import React, { useEffect, useState } from 'react';
import { Server, Cpu, Plus, Trash2, Link, Shield, AlertTriangle } from 'lucide-react';
import axios from 'axios';

const API_BASE = 'http://localhost:3000/api/v1';

export default function Devices() {
  const [devices, setDevices] = useState<any[]>([]);
  const [organisations, setOrganisations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({ serial_number: '', type_device: 'BADGEUSE', imei: '' });

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState('');

  const fetchDevices = async () => {
    try {
      const res = await axios.get(`${API_BASE}/devices`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      setDevices(res.data);
    } catch (err) {
      console.error("Erreur de chargement des équipements", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganisations = async () => {
    try {
      const res = await axios.get(`${API_BASE}/organisations?limit=100`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      setOrganisations(res.data.data || res.data.items || res.data || []);
    } catch (err) {
      console.error("Erreur de chargement des organisations", err);
    }
  };

  useEffect(() => {
    fetchDevices();
    fetchOrganisations();
  }, []);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/devices`, formData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      setShowAddModal(false);
      setFormData({ serial_number: '', type_device: 'BADGEUSE', imei: '' });
      fetchDevices();
    } catch (err: any) {
      alert("Erreur: " + (err.response?.data?.message || err.message));
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/devices/${selectedDeviceId}/assign`, { organisationId: selectedOrgId }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      setShowAssignModal(false);
      fetchDevices();
    } catch (err: any) {
      alert("Erreur: " + (err.response?.data?.message || err.message));
    }
  };

  const handleRelease = async (id: string) => {
    if (window.confirm("Voulez-vous vraiment désallouer cet équipement de l'école ? L'école perdra l'accès.")) {
      try {
        await axios.post(`${API_BASE}/devices/${id}/release`, {}, {
          headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
        });
        fetchDevices();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Voulez-vous vraiment supprimer définitivement cet équipement du parc SaaS ?")) {
      try {
        await axios.delete(`${API_BASE}/devices/${id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
        });
        fetchDevices();
      } catch (err) {
        console.error(err);
      }
    }
  };

  if (loading) return <div className="text-center text-navy-300 py-10">Chargement du parc matériel...</div>;

  return (
    <div className="animate-fade-in">
      <div className="glass-panel p-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Gestion du Matériel</h1>
            <p className="text-navy-300 mt-1">Gérez le stock de badgeuses et de balises GPS et allouez-les aux écoles.</p>
          </div>
          <button 
            onClick={() => setShowAddModal(!showAddModal)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={18} /> {showAddModal ? 'Annuler' : 'Nouvel Équipement'}
          </button>
        </div>

        {showAddModal && (
          <form onSubmit={handleAddSubmit} className="bg-white/5 p-6 rounded-2xl border border-white/10 mb-8 grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="form-label">Numéro de Série (S/N ou IMEI)</label>
              <input required type="text" value={formData.serial_number} onChange={e => setFormData({...formData, serial_number: e.target.value})} className="form-input" placeholder="ex: CKPM223460449" />
            </div>
            <div>
              <label className="form-label">Type d'Appareil</label>
              <select 
                value={formData.type_device} 
                onChange={e => setFormData({...formData, type_device: e.target.value})}
                className="form-input"
                style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)' }}
              >
                <option value="BADGEUSE" style={{ background: '#1e293b' }}>Badgeuse BioTime</option>
                <option value="GPS" style={{ background: '#1e293b' }}>Balise GPS Libellule</option>
              </select>
            </div>
            <div>
              <label className="form-label">IMEI (requis pour les balises GPS)</label>
              <input type="text" value={formData.imei} onChange={e => setFormData({...formData, imei: e.target.value})} className="form-input" placeholder="ex: 86420104..." />
            </div>
            <div className="col-span-2 pt-2">
              <button type="submit" className="btn-primary w-full">
                Enregistrer dans le stock
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-navy-300">
                <th className="p-4 font-semibold">Équipement</th>
                <th className="p-4 font-semibold">Type</th>
                <th className="p-4 font-semibold">Statut</th>
                <th className="p-4 font-semibold">Allocation (École)</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {devices.map(device => (
                <tr key={device.id} className="text-white hover:bg-white/5 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
                        device.type_device === 'BADGEUSE' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      }`}>
                        {device.type_device === 'BADGEUSE' ? <Shield size={18} /> : <Server size={18} />}
                      </div>
                      <div>
                        <div className="font-bold">{device.serial_number}</div>
                        <div className="text-xs text-navy-300">
                          {device.type_device === 'GPS' 
                            ? `IMEI: ${device.imei || 'Non renseigné'}` 
                            : 'Modèle standard'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                      device.type_device === 'BADGEUSE' 
                        ? 'bg-emerald-500/20 text-emerald-300' 
                        : 'bg-blue-500/20 text-blue-300'
                    }`}>
                      {device.type_device}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${device.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                      <span className="text-sm font-medium">{device.status}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    {device.assigned_organisation_id ? (
                      <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {device.assigned_organisation_name}
                      </span>
                    ) : (
                      <span className="text-sm text-navy-400 italic">En stock (non alloué)</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      {device.assigned_organisation_id ? (
                        <button onClick={() => handleRelease(device.id)} className="p-2 hover:bg-amber-500/10 text-amber-500 rounded-lg transition-colors" title="Désallouer l'école">
                          <AlertTriangle size={18} />
                        </button>
                      ) : (
                        <button onClick={() => { setSelectedDeviceId(device.id); setShowAssignModal(true); }} className="p-2 hover:bg-indigo-500/10 text-indigo-400 rounded-lg transition-colors" title="Allouer à une école">
                          <Link size={18} />
                        </button>
                      )}
                      <button onClick={() => handleDelete(device.id)} className="p-2 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors" title="Supprimer du parc">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {devices.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-navy-300">Aucun équipement enregistré dans le parc SaaS.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Allocation */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-panel w-full max-w-md animate-fade-in p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Link size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Allouer à une école</h2>
                <p className="text-xs text-navy-300">Mettre cet équipement à la disposition d'une école.</p>
              </div>
            </div>
            
            <form onSubmit={handleAssignSubmit}>
              <div className="mb-6">
                <label className="form-label">Choisir l'école bénéficiaire</label>
                <select 
                  required 
                  className="form-input" 
                  value={selectedOrgId} 
                  onChange={e => setSelectedOrgId(e.target.value)}
                  style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)' }}
                >
                  <option value="" style={{ background: '#1e293b' }}>Sélectionnez une école...</option>
                  {organisations.map(org => (
                    <option key={org.id} value={org.id} style={{ background: '#1e293b' }}>{org.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowAssignModal(false)} className="btn-secondary flex-1">Annuler</button>
                <button type="submit" className="btn-primary flex-1">Confirmer l'allocation</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
