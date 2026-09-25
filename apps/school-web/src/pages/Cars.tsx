import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api';
import { Plus, Trash2, Bus, Hash, Users, Car, Settings, RefreshCw, Edit } from 'lucide-react';
import { useI18n } from '../i18n';

export default function Cars() {
  const { t } = useI18n();
  const [cars, setCars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingCar, setEditingCar] = useState<any>(null);
  const [formData, setFormData] = useState({ plateNumber: '', brand: '', model: '', capacity: 30, gpsDeviceId: '', biotimeTerminalSn: '' });
  const [devices, setDevices] = useState<any[]>([]);

  const fetchCars = async () => {
    try {
      const res = await api.get('/cars');
      setCars(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCars();
    api.get('/cars/allocated-devices').then(res => setDevices(res.data)).catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCar) {
        // Mode édition - PATCH
        await api.patch(`/cars/${editingCar.id}`, { ...formData, capacity: Number(formData.capacity) });
      } else {
        // Mode création - POST
        await api.post('/cars', { ...formData, capacity: Number(formData.capacity) });
      }
      setShowForm(false);
      setEditingCar(null);
      setFormData({ plateNumber: '', brand: '', model: '', capacity: 30, gpsDeviceId: '', biotimeTerminalSn: '' });
      fetchCars();
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || (editingCar ? "Erreur lors de la modification du véhicule" : "Erreur lors de l'ajout du véhicule");
      alert(Array.isArray(errorMsg) ? errorMsg[0] : errorMsg);
    }
  };

  const handleEdit = (car: any) => {
    setEditingCar(car);
    setFormData({
      plateNumber: car.plateNumber,
      brand: car.brand,
      model: car.model,
      capacity: car.capacity,
      gpsDeviceId: car.gpsDeviceId || '',
      biotimeTerminalSn: car.biotimeTerminalSn || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t('cars.confirmer_suppression'))) {
      await api.delete(`/cars/${id}`);
      fetchCars();
    }
  };

  const handleSyncLibellule = async () => {
    try {
      setSyncing(true);
      const res = await api.post('/cars/sync-libellule');
      alert(`${res.data.synced} véhicule(s) synchronisé(s) avec succès !`);
      fetchCars();
    } catch (err: any) {
      alert("Erreur lors de la synchronisation avec Libellule.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('cars.titre')}</h1>
          <p className="text-slate-500 mt-1">Gérez vos bus et minivans</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleSyncLibellule} disabled={syncing} className="btn btn-secondary flex items-center gap-2">
            <RefreshCw size={18} className={syncing ? "animate-spin" : ""} /> {syncing ? t('cars.synchronisation') : t('cars.sync_libellule')}
          </button>
          <button onClick={() => setShowForm(true)} className="btn btn-primary flex items-center gap-2">
            <Plus size={18} /> {t('cars.ajouter')}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : cars.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <Bus size={40} />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">{t('cars.aucun')}</h3>
          <p className="empty-text">{t('cars.aucun_desc')}</p>
          <div className="flex gap-3 justify-center mt-4">
            <button onClick={handleSyncLibellule} disabled={syncing} className="btn btn-secondary flex items-center gap-2">
              <RefreshCw size={18} className={syncing ? "animate-spin" : ""} /> {syncing ? t('cars.synchronisation') : t('cars.sync_libellule')}
            </button>
            <button onClick={() => setShowForm(true)} className="btn btn-primary flex items-center gap-2">
              <Plus size={18} /> {t('cars.ajouter')}
            </button>
          </div>
        </div>
      ) : (
        <div className="premium-table-wrapper mb-8 mt-4">
          <div className="overflow-x-auto">
            <table className="premium-table">
              <thead>
                <tr>
                  <th className="w-1/3">{t('cars.immatriculation')}</th>
                  <th className="w-1/4">{t('cars.marque')}</th>
                  <th>{t('cars.capacite')}</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cars.map(car => (
                  <tr key={car.id} className="premium-row">
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0">
                          <Bus size={14} />
                        </div>
                        <div className="font-bold text-slate-800">{car.plateNumber}</div>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col gap-1 text-sm text-slate-600">
                        <span className="flex items-center gap-2">
                          <Car size={14} className="text-slate-400"/> 
                          <span className="font-medium text-slate-700">{car.brand} {car.model}</span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col gap-1 text-sm">
                        <span className="font-semibold text-slate-700 flex items-center gap-1.5"><Users size={14} className="text-slate-400" /> {car.capacity} {t('cars.places')}</span>
                      </div>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEdit(car)} className="btn-icon-primary" title={t('action.modifier')}>
                          <Edit size={14} />
                        </button>
                        <button onClick={() => handleDelete(car.id)} className="btn-icon-danger" title={t('action.supprimer')}>
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
                <Bus size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">{editingCar ? t('cars.modifier') : t('cars.nouveau')}</h2>
                <p className="text-xs text-slate-500 mt-1">{editingCar ? t('cars.modifier_info') : t('cars.saisir_info')}</p>
              </div>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="premium-modal-body">
                <div className="flex gap-4">
                  <div className="premium-input-group w-full">
                    <label className="premium-input-label">{t('cars.immatriculation')}</label>
                    <div className="premium-input-wrapper">
                      <Hash size={16} className="premium-input-icon" />
                      <input required type="text" className="premium-input" placeholder="DK-1234-AB" value={formData.plateNumber} onChange={e => setFormData({...formData, plateNumber: e.target.value})} />
                    </div>
                  </div>

                  <div className="premium-input-group w-full">
                    <label className="premium-input-label">{t('cars.capacite_places')}</label>
                    <div className="premium-input-wrapper">
                      <Users size={16} className="premium-input-icon" />
                      <input required type="number" className="premium-input" value={formData.capacity} onChange={e => setFormData({...formData, capacity: parseInt(e.target.value, 10) as any})} />
                    </div>
                  </div>
                </div>

                <div className="premium-input-group">
                  <label className="premium-input-label">{t('cars.marque')}</label>
                  <div className="premium-input-wrapper">
                    <Car size={16} className="premium-input-icon" />
                    <input required type="text" className="premium-input" placeholder="Toyota" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} />
                  </div>
                </div>

                <div className="premium-input-group mb-0">
                  <label className="premium-input-label">{t('cars.modele')}</label>
                  <div className="premium-input-wrapper">
                    <Settings size={16} className="premium-input-icon" />
                    <input required type="text" className="premium-input" placeholder="Coaster" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} />
                  </div>
                </div>

                <div className="flex gap-4 mt-4">
                  <div className="premium-input-group w-full mb-0">
                    <label className="premium-input-label">{t('cars.gps_balise')}</label>
                    <select className="premium-input w-full" value={formData.gpsDeviceId} onChange={e => setFormData({...formData, gpsDeviceId: e.target.value})}>
                      <option value="">{t('cars.aucune_balise')}</option>
                      {devices.filter(d => d.typeDevice === 'GPS').map(d => (
                        <option key={d.id} value={d.id}>{d.serialNumber}</option>
                      ))}
                    </select>
                  </div>

                  <div className="premium-input-group w-full mb-0">
                    <label className="premium-input-label">{t('cars.badgeuse')}</label>
                    <select className="premium-input w-full" value={formData.biotimeTerminalSn} onChange={e => setFormData({...formData, biotimeTerminalSn: e.target.value})}>
                      <option value="">{t('cars.aucune_badgeuse')}</option>
                      {devices.filter(d => d.typeDevice === 'BADGEUSE').map(d => (
                        <option key={d.id} value={d.serialNumber}>{d.serialNumber}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="premium-modal-footer">
                <button type="button" onClick={() => { setShowForm(false); setEditingCar(null); }} className="btn btn-secondary flex-1 font-semibold py-1.5 text-sm">{t('annuler')}</button>
                <button type="submit" className="btn btn-primary flex-1 font-semibold py-1.5 text-sm">{editingCar ? t('action.modifier') : t('enregistrer')}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
