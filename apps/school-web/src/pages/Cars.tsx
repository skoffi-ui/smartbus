import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Plus, Trash2, Bus, Hash, Users, Car, Settings, RefreshCw } from 'lucide-react';

export default function Cars() {
  const [cars, setCars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ plateNumber: '', brand: '', model: '', capacity: 30 });

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
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/cars', { ...formData, capacity: Number(formData.capacity) });
      setShowForm(false);
      setFormData({ plateNumber: '', brand: '', model: '', capacity: 30 });
      fetchCars();
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || "Erreur lors de l'ajout du véhicule";
      alert(Array.isArray(errorMsg) ? errorMsg[0] : errorMsg);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Voulez-vous vraiment supprimer ce véhicule ?")) {
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
          <h1 className="text-2xl font-bold text-slate-800">Flotte de Véhicules</h1>
          <p className="text-slate-500 mt-1">Gérez vos bus et minivans</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleSyncLibellule} disabled={syncing} className="btn btn-secondary flex items-center gap-2">
            <RefreshCw size={18} className={syncing ? "animate-spin" : ""} /> {syncing ? 'Synchronisation...' : 'Sync. Libellule'}
          </button>
          <button onClick={() => setShowForm(true)} className="btn btn-primary flex items-center gap-2">
            <Plus size={18} /> Ajouter un Véhicule
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
          <h3 className="text-xl font-bold text-slate-800 mb-2">Aucun Véhicule</h3>
          <p className="empty-text">Commencez par ajouter des bus ou des minivans à votre flotte.</p>
          <div className="flex gap-3 justify-center mt-4">
            <button onClick={handleSyncLibellule} disabled={syncing} className="btn btn-secondary flex items-center gap-2">
              <RefreshCw size={18} className={syncing ? "animate-spin" : ""} /> {syncing ? 'Synchro...' : 'Sync. Libellule'}
            </button>
            <button onClick={() => setShowForm(true)} className="btn btn-primary flex items-center gap-2">
              <Plus size={18} /> Ajouter un Véhicule
            </button>
          </div>
        </div>
      ) : (
        <div className="premium-table-wrapper mb-8 mt-4">
          <div className="overflow-x-auto">
            <table className="premium-table">
              <thead>
                <tr>
                  <th className="w-1/3">Immatriculation</th>
                  <th className="w-1/4">Véhicule</th>
                  <th>Capacité</th>
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
                        <span className="font-semibold text-slate-700 flex items-center gap-1.5"><Users size={14} className="text-slate-400" /> {car.capacity} places</span>
                      </div>
                    </td>
                    <td className="text-right">
                      <button onClick={() => handleDelete(car.id)} className="btn-icon-danger" title="Supprimer">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal d'ajout */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="premium-modal w-full max-w-md animate-fade-in">
            <div className="premium-modal-header">
              <div className="premium-modal-icon">
                <Bus size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Nouveau Véhicule</h2>
                <p className="text-xs text-slate-500 mt-1">Saisissez les informations du véhicule.</p>
              </div>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="premium-modal-body">
                <div className="flex gap-4">
                  <div className="premium-input-group w-full">
                    <label className="premium-input-label">Immatriculation</label>
                    <div className="premium-input-wrapper">
                      <Hash size={16} className="premium-input-icon" />
                      <input required type="text" className="premium-input" placeholder="DK-1234-AB" value={formData.plateNumber} onChange={e => setFormData({...formData, plateNumber: e.target.value})} />
                    </div>
                  </div>
                  
                  <div className="premium-input-group w-full">
                    <label className="premium-input-label">Capacité (Places)</label>
                    <div className="premium-input-wrapper">
                      <Users size={16} className="premium-input-icon" />
                      <input required type="number" className="premium-input" value={formData.capacity} onChange={e => setFormData({...formData, capacity: e.target.value})} />
                    </div>
                  </div>
                </div>
                
                <div className="premium-input-group">
                  <label className="premium-input-label">Marque</label>
                  <div className="premium-input-wrapper">
                    <Car size={16} className="premium-input-icon" />
                    <input required type="text" className="premium-input" placeholder="Toyota" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} />
                  </div>
                </div>
                
                <div className="premium-input-group mb-0">
                  <label className="premium-input-label">Modèle</label>
                  <div className="premium-input-wrapper">
                    <Settings size={16} className="premium-input-icon" />
                    <input required type="text" className="premium-input" placeholder="Coaster" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} />
                  </div>
                </div>
              </div>
              
              <div className="premium-modal-footer">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary flex-1 font-semibold py-1.5 text-sm">Annuler</button>
                <button type="submit" className="btn btn-primary flex-1 font-semibold py-1.5 text-sm">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
