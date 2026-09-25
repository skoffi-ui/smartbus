import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api';
import { Plus, Trash2, User, Phone, Calendar, Hash, Truck, Edit } from 'lucide-react';
import { useI18n } from '../i18n';

export default function Drivers() {
  const { t } = useI18n();
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDriver, setEditingDriver] = useState<any>(null);
  const [formData, setFormData] = useState({ firstName: '', lastName: '', licenseNumber: '', phone: '', licenseExpiry: '' });

  const fetchDrivers = async () => {
    try {
      const res = await api.get('/drivers');
      setDrivers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDriver) {
        // Mode édition - PATCH
        await api.patch(`/drivers/${editingDriver.id}`, formData);
      } else {
        // Mode création - POST
        await api.post('/drivers', formData);
      }
      setShowForm(false);
      setEditingDriver(null);
      setFormData({ firstName: '', lastName: '', licenseNumber: '', phone: '', licenseExpiry: '' });
      fetchDrivers();
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || (editingDriver ? "Erreur lors de la modification du chauffeur" : "Erreur lors de l'ajout du chauffeur");
      alert(Array.isArray(errorMsg) ? errorMsg[0] : errorMsg);
    }
  };

  const handleEdit = (driver: any) => {
    setEditingDriver(driver);
    setFormData({
      firstName: driver.firstName,
      lastName: driver.lastName,
      licenseNumber: driver.licenseNumber,
      phone: driver.phone,
      licenseExpiry: driver.licenseExpiry.split('T')[0] // Format YYYY-MM-DD pour input date
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t('drivers.confirmer_suppression'))) {
      await api.delete(`/drivers/${id}`);
      fetchDrivers();
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('drivers.titre')}</h1>
          <p className="text-slate-500 mt-1">{t('drivers.sous_titre')}</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-primary flex items-center gap-2">
          <Plus size={18} /> {t('drivers.ajouter')}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : drivers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <Truck size={40} />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">{t('drivers.aucun')}</h3>
          <p className="empty-text">{t('drivers.aucun_desc')}</p>
          <button onClick={() => setShowForm(true)} className="btn btn-primary flex items-center gap-2">
            <Plus size={18} /> {t('drivers.ajouter')}
          </button>
        </div>
      ) : (
        <div className="premium-table-wrapper mb-8 mt-4">
          <div className="overflow-x-auto">
            <table className="premium-table">
              <thead>
                <tr>
                  <th className="w-1/3">{t('drivers.chauffeur')}</th>
                  <th className="w-1/4">{t('drivers.contact')}</th>
                  <th>{t('drivers.permis')}</th>
                  <th className="text-right">{t('drivers.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map(driver => (
                  <tr key={driver.id} className="premium-row">
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0">
                          <User size={14} />
                        </div>
                        <div className="font-bold text-slate-800">{driver.firstName} {driver.lastName}</div>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col gap-1 text-sm text-slate-600">
                        <span className="flex items-center gap-2">
                          <Phone size={14} className="text-slate-400"/> 
                          <span className="font-medium text-slate-700">{driver.phone}</span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col gap-1 text-sm">
                        <span className="font-semibold text-slate-700 flex items-center gap-1.5"><Hash size={14} className="text-slate-400" /> {driver.licenseNumber}</span>
                        <span className="text-xs text-slate-500 flex items-center gap-1.5"><Calendar size={12} /> {t('drivers.expiration')}: {new Date(driver.licenseExpiry).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEdit(driver)} className="btn-icon-primary" title={t('drivers.modifier')}>
                          <Edit size={14} />
                        </button>
                        <button onClick={() => handleDelete(driver.id)} className="btn-icon-danger" title={t('drivers.supprimer')}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal d'ajout */}
      {/* Rendu dans un portail vers `document.body` : hors de l'arbre de la page,
          aucun ancêtre transformé ne peut servir de référentiel à `position: fixed`.
          La surcouche couvre donc réellement la fenêtre. */}
      {showForm && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="premium-modal w-full max-w-md animate-fade-in">
            <div className="premium-modal-header">
              <div className="premium-modal-icon">
                <Truck size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">{editingDriver ? 'Modifier le Chauffeur' : 'Nouveau Chauffeur'}</h2>
                <p className="text-xs text-slate-500 mt-1">{editingDriver ? 'Modifiez les informations du conducteur.' : 'Saisissez les informations du conducteur.'}</p>
              </div>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="premium-modal-body">
                <div className="flex gap-4">
                  <div className="premium-input-group w-full">
                    <label className="premium-input-label">Prénom</label>
                    <div className="premium-input-wrapper">
                      <User size={16} className="premium-input-icon" />
                      <input required type="text" className="premium-input" placeholder="Ex: Aliou" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                    </div>
                  </div>
                  
                  <div className="premium-input-group w-full">
                    <label className="premium-input-label">Nom</label>
                    <div className="premium-input-wrapper">
                      <User size={16} className="premium-input-icon" />
                      <input required type="text" className="premium-input" placeholder="Ex: Diop" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                    </div>
                  </div>
                </div>
                
                <div className="premium-input-group">
                  <label className="premium-input-label">Téléphone</label>
                  <div className="premium-input-wrapper">
                    <Phone size={16} className="premium-input-icon" />
                    <input required type="text" className="premium-input" placeholder="+221..." value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                  </div>
                </div>
                
                <div className="premium-input-group">
                  <label className="premium-input-label">Numéro de Permis</label>
                  <div className="premium-input-wrapper">
                    <Hash size={16} className="premium-input-icon" />
                    <input required type="text" className="premium-input" placeholder="Numéro du permis" value={formData.licenseNumber} onChange={e => setFormData({...formData, licenseNumber: e.target.value})} />
                  </div>
                </div>
                
                <div className="premium-input-group mb-0">
                  <label className="premium-input-label">Expiration du permis</label>
                  <div className="premium-input-wrapper">
                    <Calendar size={16} className="premium-input-icon" />
                    <input required type="date" className="premium-input" value={formData.licenseExpiry} onChange={e => setFormData({...formData, licenseExpiry: e.target.value})} />
                  </div>
                </div>
              </div>
              
              <div className="premium-modal-footer">
                <button type="button" onClick={() => { setShowForm(false); setEditingDriver(null); }} className="btn btn-secondary flex-1 font-semibold py-1.5 text-sm">Annuler</button>
                <button type="submit" className="btn btn-primary flex-1 font-semibold py-1.5 text-sm">{editingDriver ? 'Modifier' : 'Enregistrer'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
