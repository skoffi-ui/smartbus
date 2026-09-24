import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getCourses, getPointsByCourse, createPointForCourse, deletePoint } from '../services/transport.service';
import { MapPin, Clock, Save, Trash2, ChevronRight, X, Loader2 } from 'lucide-react';

/** Centre de carte par défaut : Abidjan, et non Paris. */
const ABIDJAN: [number, number] = [5.3364, -4.0267];

// Fix icônes Leaflet par défaut
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Icône personnalisée pour les arrêts
const stopIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Icône personnalisée pour le point temporaire (nouveau)
const tempIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Composant pour écouter les clics sur la carte
function MapEvents({ onMapClick }: { onMapClick: (latlng: L.LatLng) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });
  return null;
}

// Composant pour recalculer le centre de la carte selon la route (Polyline)
function MapUpdater({ route }: { route: any }) {
  const map = useMapEvents({});
  useEffect(() => {
    if (route && Array.isArray(route) && route.length > 0) {
      try {
        const polyline = L.polyline(route);
        const bounds = polyline.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      } catch (e) {
        console.error("Erreur ajustement bounds", e);
      }
    }
  }, [route, map]);
  return null;
}

export default function PointsRecuperation() {
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  
  const [points, setPoints] = useState<any[]>([]);
  const [loadingPoints, setLoadingPoints] = useState(false);
  
  // Nouveau point en cours de création
  const [tempPoint, setTempPoint] = useState<{ lat: number, lng: number } | null>(null);
  const [newPointData, setNewPointData] = useState({ nom: '', tempsArret: '07:30' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      fetchPoints(selectedCourse.id);
      setTempPoint(null); // Reset temp point if course changes
    }
  }, [selectedCourse]);

  const fetchCourses = async () => {
    try {
      const data = await getCourses();
      setCourses(data);
      if (data.length > 0) setSelectedCourse(data[0]);
    } catch (error) {
      console.error('Erreur chargement courses:', error);
    }
  };

  const fetchPoints = async (courseId: string) => {
    setLoadingPoints(true);
    try {
      const data = await getPointsByCourse(courseId);
      setPoints(data);
    } catch (error) {
      console.error('Erreur fetch points:', error);
    } finally {
      setLoadingPoints(false);
    }
  };

  const handleMapClick = (latlng: L.LatLng) => {
    if (!selectedCourse) return;
    setTempPoint({ lat: latlng.lat, lng: latlng.lng });
  };

  const handleSavePoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse || !tempPoint) return;
    
    setSaving(true);
    try {
      const payload = {
        nom: newPointData.nom,
        latitude: tempPoint.lat,
        longitude: tempPoint.lng,
        tempsArret: newPointData.tempsArret,
        ordrePassage: points.length + 1
      };
      
      const savedPoint = await createPointForCourse(selectedCourse.id, payload);
      setPoints([...points, savedPoint]);
      setTempPoint(null);
      setNewPointData({ nom: '', tempsArret: '07:30' }); // reset form
    } catch (error) {
      console.error('Erreur sauvegarde point:', error);
      alert('Erreur lors de la sauvegarde du point.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePoint = async (pointId: string) => {
    if (!confirm('Supprimer cet arrêt ?')) return;
    try {
      await deletePoint(pointId);
      setPoints(points.filter(p => p.id !== pointId));
    } catch (error) {
      console.error('Erreur supression point:', error);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[var(--bg-primary)] p-6 font-sans text-[var(--text-primary)]">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* En-tête */}
        <div>
          <h1 className="text-[28px] font-black text-slate-900 tracking-tight flex items-center gap-3">
            <MapPin size={28} className="text-[var(--accent-primary)]" />
            Points de Récupération
          </h1>
          <p className="mt-2 text-base text-gray-600">
            Sélectionnez une course et placez des arrêts sur la carte.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Sidebar Gauche: Sélecteur + Liste des points */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            {/* Sélecteur de Course */}
            <div className="bg-white rounded-[16px] shadow-sm border border-slate-200 p-5">
              <label className="block text-[14px] font-bold text-slate-900 mb-3">Course active</label>
              <select 
                className="w-full h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[14px] font-medium outline-none focus:ring-2 focus:ring-[rgba(138,180,255,0.2)] transition-all"
                value={selectedCourse?.id || ''}
                onChange={(e) => {
                  const course = courses.find(c => c.id === e.target.value);
                  setSelectedCourse(course);
                }}
              >
                {courses.length === 0 && <option value="">Aucune course disponible</option>}
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.nom}</option>
                ))}
              </select>
            </div>

            {/* Formulaire Nouvel Arrêt (Affiché si clique sur la carte) */}
            {tempPoint && (
              <div className="bg-white rounded-[16px] shadow-lg border border-[rgba(138,180,255,0.35)] p-5 ring-1 ring-[rgba(138,180,255,0.15)] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-[var(--accent-container)]"></div>
                
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-[15px] text-[var(--accent-primary)] flex items-center gap-2">
                    <MapPin size={16} /> Nouvel Arrêt
                  </h3>
                  <button onClick={() => setTempPoint(null)} className="text-gray-400 hover:text-gray-700">
                    <X size={16} />
                  </button>
                </div>
                
                <form onSubmit={handleSavePoint} className="space-y-4">
                  <div>
                    <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Nom de l'arrêt</label>
                    <input 
                      required 
                      type="text" 
                      placeholder="Ex: Croisement Pasteur"
                      className="w-full h-10 rounded-lg border border-slate-200 px-3 text-[14px] outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
                      value={newPointData.nom}
                      onChange={e => setNewPointData({...newPointData, nom: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Heure estimée</label>
                    <div className="relative">
                      <Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input 
                        required 
                        type="time" 
                        className="w-full h-10 rounded-lg border border-slate-200 pl-9 pr-3 text-[14px] outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
                        value={newPointData.tempsArret}
                        onChange={e => setNewPointData({...newPointData, tempsArret: e.target.value})}
                      />
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    disabled={saving}
                    className="w-full h-10 bg-[var(--accent-container)] hover:bg-[var(--accent-container-hover)] text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? 'Enregistrement...' : 'Valider ce point'}
                  </button>
                </form>
              </div>
            )}

            {/* Liste des points existants */}
            <div className="bg-white rounded-[16px] shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-bold text-[15px] text-slate-900">Arrêts configurés</h3>
                <span className="bg-[rgba(138,180,255,0.14)] text-[var(--accent-primary)] text-[12px] font-bold px-2.5 py-0.5 rounded-full">
                  {points.length} arrêts
                </span>
              </div>
              
              <div className="p-2 overflow-y-auto max-h-[400px]">
                {loadingPoints ? (
                  <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-[var(--accent-primary)]" /></div>
                ) : points.length === 0 ? (
                  <div className="p-8 text-center text-[13px] text-gray-500">
                    Aucun arrêt configuré pour cette course.<br/>
                    Cliquez sur la carte pour en ajouter.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {points.map((p, index) => (
                      <div key={p.id} className="group flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[13px] font-bold text-slate-500 shrink-0">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-[14px] text-slate-900 truncate">{p.nom}</div>
                          <div className="flex items-center gap-1 text-[12px] text-[var(--text-secondary)] mt-0.5">
                            <Clock size={12} /> {p.tempsArret || '--:--'}
                          </div>
                        </div>
                        <button 
                          onClick={() => handleDeletePoint(p.id)}
                          className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 shrink-0"
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Espace Carte Droite */}
          <div className="lg:col-span-8 bg-white rounded-[16px] shadow-sm border border-slate-200 p-2 relative h-[70vh] min-h-[500px]">
            {selectedCourse ? (
              <MapContainer 
                center={ABIDJAN}
                zoom={13} 
                style={{ height: '100%', width: '100%', borderRadius: '12px', zIndex: 0 }}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                />
                
                <MapEvents onMapClick={handleMapClick} />
                
                {/* Tracer la course */}
                {selectedCourse.route && Array.isArray(selectedCourse.route) && (
                  <>
                    <Polyline 
                      positions={selectedCourse.route} 
                      pathOptions={{ color: selectedCourse.couleurCarte || '#3b82f6', weight: 4, opacity: 0.8 }} 
                    />
                    <MapUpdater route={selectedCourse.route} />
                  </>
                )}

                {/* Marqueurs des points existants */}
                {points.map((p, index) => (
                  <Marker key={p.id} position={[p.latitude, p.longitude]} icon={stopIcon}>
                    <Popup>
                      <div className="font-bold">{index + 1}. {p.nom}</div>
                      <div className="text-gray-600 text-sm">{p.tempsArret}</div>
                    </Popup>
                  </Marker>
                ))}

                {/* Marqueur du nouveau point temporaire */}
                {tempPoint && (
                  <Marker position={[tempPoint.lat, tempPoint.lng]} icon={tempIcon}>
                    <Popup>Nouvel arrêt ici</Popup>
                  </Marker>
                )}
                
              </MapContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-slate-50 rounded-xl">
                <MapPin size={48} className="mb-4 opacity-50" />
                <p>Sélectionnez une course pour afficher la carte</p>
              </div>
            )}
            
            {/* Overlay instruction */}
            {selectedCourse && !tempPoint && (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white px-4 py-2.5 rounded-full text-[13px] font-medium shadow-lg backdrop-blur-sm pointer-events-none z-[1000] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                Cliquez sur la ligne bleue pour ajouter un arrêt
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
