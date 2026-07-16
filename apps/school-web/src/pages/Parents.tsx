import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit, Trash2, Phone, Mail, User } from 'lucide-react';
import './Parents.css';

export default function Parents() {
  const [parents, setParents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ firstName: '', lastName: '', phone: '', email: '' });

  const fetchParents = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('http://localhost:3001/api/v1/parents', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setParents(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParents();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('http://localhost:3001/api/v1/parents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setShowModal(false);
        setFormData({ firstName: '', lastName: '', phone: '', email: '' });
        fetchParents();
      } else {
        const err = await res.json();
        alert(`Erreur: ${err.message}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Voulez-vous vraiment supprimer ce parent ?')) return;
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`http://localhost:3001/api/v1/parents/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchParents();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestion des Parents</h1>
          <p className="text-slate-500 mt-1">Gérez les comptes des parents pour l'envoi des notifications.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary flex items-center gap-2">
          <Plus size={18} /> Ajouter un Parent
        </button>
      </div>

      <div className="premium-table-wrapper mb-8 mt-4">
        <div className="overflow-x-auto">
          <table className="premium-table">
            <thead>
              <tr>
                <th className="w-1/4">Nom</th>
                <th className="w-1/4">Contact</th>
                <th>Statut</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="py-8 text-center text-slate-500">Chargement...</td></tr>
              ) : parents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <Users size={40} className="opacity-20" />
                      <p>Aucun parent enregistré.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                parents.map(parent => (
                  <tr key={parent.id} className="premium-row">
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0">
                          <User size={14} />
                        </div>
                        <div className="font-bold text-slate-800">{parent.firstName} {parent.lastName}</div>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col gap-1 text-sm text-slate-600">
                        <span className="flex items-center gap-2">
                          <Phone size={14} className="text-slate-400"/> 
                          <span className="font-medium text-slate-700">{parent.phone}</span>
                        </span>
                        {parent.email ? (
                          <span className="flex items-center gap-2">
                            <Mail size={14} className="text-slate-400"/> 
                            {parent.email}
                          </span>
                        ) : (
                          <span className="flex items-center gap-2 text-slate-400 italic">
                            <Mail size={14} className="opacity-50"/> 
                            Aucun email
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${parent.active ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${parent.active ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                        {parent.active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="text-right">
                      <button onClick={() => handleDelete(parent.id)} className="btn-icon-danger" title="Supprimer">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal d'ajout */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="premium-modal w-full max-w-md animate-fade-in">
            <div className="premium-modal-header">
              <div className="premium-modal-icon">
                <Users size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Nouveau Parent</h2>
                <p className="text-xs text-slate-500 mt-1">Saisissez les informations du contact.</p>
              </div>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="premium-modal-body">
                <div className="premium-input-group">
                  <label className="premium-input-label">Prénom</label>
                  <div className="premium-input-wrapper">
                    <User size={18} className="premium-input-icon" />
                    <input required type="text" className="premium-input" placeholder="Ex: Jean" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                  </div>
                </div>
                
                <div className="premium-input-group">
                  <label className="premium-input-label">Nom</label>
                  <div className="premium-input-wrapper">
                    <User size={18} className="premium-input-icon" />
                    <input required type="text" className="premium-input" placeholder="Ex: Dupont" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                  </div>
                </div>
                
                <div className="premium-input-group">
                  <label className="premium-input-label">Téléphone (WhatsApp)</label>
                  <div className="premium-input-wrapper">
                    <Phone size={18} className="premium-input-icon" />
                    <input required type="text" className="premium-input" placeholder="+225..." value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                  </div>
                </div>
                
                <div className="premium-input-group mb-0">
                  <label className="premium-input-label">Email (Optionnel)</label>
                  <div className="premium-input-wrapper">
                    <Mail size={18} className="premium-input-icon" />
                    <input type="email" className="premium-input" placeholder="jean.dupont@email.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                  </div>
                </div>
              </div>
              
              <div className="premium-modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1 font-semibold py-1.5 text-sm">Annuler</button>
                <button type="submit" className="btn btn-primary flex-1 font-semibold py-1.5 text-sm">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
