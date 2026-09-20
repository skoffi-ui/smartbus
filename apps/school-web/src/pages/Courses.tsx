import React, { useEffect, useState, useRef } from 'react';
import {
  Plus, Trash2, Bus, Clock, User, Search, Navigation, AlertCircle, Route
} from 'lucide-react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// Use dynamic CDN loading for LRM to bypass NPM network issues

import './UiverseButton.css';
import './UiverseInput.css';
import './UiverseRadioList.css';
import './UiverseDeleteButton.css';
import './UiverseNewButton.css';

import { getCourses, createCourse, deleteCourse, updateCourse, getTrajets } from '../services/transport.service';
import api from '../services/api';

/** Centre de carte par défaut : Abidjan, et non Paris. */
const ABIDJAN: [number, number] = [5.3364, -4.0267];

// Fix Leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const JOURS_SEMAINE = [
  { id: 'L', label: 'Lundi' }, { id: 'M', label: 'Mardi' }, { id: 'Me', label: 'Mercredi' },
  { id: 'J', label: 'Jeudi' }, { id: 'V', label: 'Vendredi' }, { id: 'S', label: 'Samedi' }, { id: 'D', label: 'Dimanche' }
];

const PRESET_COLORS = [
  { hex: '#2563EB', name: 'Bleu' }, { hex: '#8B5CF6', name: 'Violet' },
  { hex: '#EC4899', name: 'Rose' }, { hex: '#EF4444', name: 'Rouge' },
  { hex: '#F59E0B', name: 'Ambre' }, { hex: '#10B981', name: 'Émeraude' },
  { hex: '#64748B', name: 'Gris' },
];

function RoutingMachineReadOnly({ waypoints, color }: { waypoints: any[], color: string }) {
  const map = useMap();
  const routingControlRef = useRef<any>(null);

  useEffect(() => {
    if (!map || !waypoints || waypoints.length === 0) return;
    
    if (!(L as any).Routing) {
      const loadLRM = async () => {
        if (!document.getElementById('lrm-css')) {
          const link = document.createElement('link');
          link.id = 'lrm-css';
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css';
          document.head.appendChild(link);
        }
        if (!document.getElementById('lrm-js')) {
          const script = document.createElement('script');
          script.id = 'lrm-js';
          script.src = 'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js';
          script.onload = initRouting;
          document.head.appendChild(script);
        } else {
          setTimeout(initRouting, 500);
        }
      };
      loadLRM();
      return;
    } else {
      initRouting();
    }

    function initRouting() {
      if (!map || !(L as any).Routing) return;
      try {
        const control = (L as any).Routing.control({
        waypoints: waypoints,
        routeWhileDragging: false,
        show: false,
        addWaypoints: false,
        fitSelectedRoutes: true,
        lineOptions: {
          styles: [{ color: color || '#2563EB', weight: 5, opacity: 0.8 }],
          addWaypoints: false
        },
        createMarker: (i: number, wp: any, n: number) => {
          const isStart = i === 0;
          const isEnd = i === n - 1;
          const markerColor = isStart ? 'green' : (isEnd ? 'red' : 'blue');
          return L.marker(wp.latLng, {
            draggable: false,
            icon: new L.Icon({
              iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${markerColor}.png`,
              shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
              iconSize: [25, 41], iconAnchor: [12, 41]
            })
          });
        }
      }).addTo(map);

      routingControlRef.current = control;
      } catch (e) {}
    }
  }, [map, waypoints, color]);

  return null;
}

export default function Courses() {
  const [courses, setCourses] = useState<any[]>([]);
  const [trajets, setTrajets] = useState<any[]>([]);
  const [carsList, setCarsList] = useState<any[]>([]);
  const [driversList, setDriversList] = useState<any[]>([]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const defaultForm = { 
    nom: '', description: '', statut: 'active', couleurCarte: '#2563EB', 
    heureDepart: '07:00', heureArrivee: '08:30', jours: ['L', 'M', 'Me', 'J', 'V'], 
    chauffeur: '', vehicule: '', trajetId: '' 
  };
  const [formData, setFormData] = useState<any>(defaultForm);

  useEffect(() => { 
    fetchCourses(); 
    fetchTrajetsList();
    fetchCarsList(); 
    fetchDriversList(); 
  }, []);

  const fetchCarsList = async () => { try { const r = await api.get('/cars'); setCarsList(r.data); } catch {} };
  const fetchDriversList = async () => { try { const r = await api.get('/drivers'); setDriversList(r.data); } catch {} };
  const fetchTrajetsList = async () => { try { const data = await getTrajets(); setTrajets(Array.isArray(data) ? data : []); } catch {} };
  
  const fetchCourses = async () => {
    try { 
      const d = await getCourses(); 
      if (Array.isArray(d)) setCourses(d);
      else if (d && Array.isArray(d.data)) setCourses(d.data);
      else setCourses([]);
    } catch {}
  };

  const handleSelectCourse = (course: any) => {
    setSelectedCourseId(course.id);
    setFormData({ 
      nom: course.nom || '', 
      description: course.description || '', 
      statut: course.statut || 'active', 
      couleurCarte: course.couleurCarte || '#2563EB', 
      heureDepart: course.heureDepart || '07:00', 
      heureArrivee: course.heureArrivee || '08:30', 
      jours: course.joursExecution || [], 
      chauffeur: course.driverId || '', 
      vehicule: course.carId || '', 
      trajetId: course.trajetId || '' 
    });
  };

  const handleNewCourse = () => {
    setSelectedCourseId(null);
    setFormData(defaultForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.trajetId) {
      alert("Veuillez sélectionner un trajet géographique pour cette course.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        nom: formData.nom,
        description: formData.description,
        statut: formData.statut,
        couleurCarte: formData.couleurCarte,
        heureDepart: formData.heureDepart,
        heureArrivee: formData.heureArrivee,
        joursExecution: formData.jours,
        carId: formData.vehicule || null,
        driverId: formData.chauffeur || null,
        trajetId: formData.trajetId || null,
      };

      if (selectedCourseId) { 
        const updated = await updateCourse(selectedCourseId, payload);
        setCourses(c => c.map(x => x.id === selectedCourseId ? updated : x));
        alert('Course mise à jour !');
      } else { 
        const created = await createCourse(payload); 
        setCourses(c => [created, ...c]); 
        setSelectedCourseId(created.id); 
        alert('Course planifiée avec succès !');
      }
    } catch (e: any) { 
      alert('Erreur: ' + (e.response?.data?.message || e.message));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCourseId) return;
    if (!confirm('Supprimer cette course ?')) return;
    setIsDeleting(true);
    try { 
      await deleteCourse(selectedCourseId);
      setCourses(c => c.filter(x => x.id !== selectedCourseId));
      handleNewCourse();
    } catch (e: any) { alert('Erreur suppression'); } 
    finally { setIsDeleting(false); }
  };

  const handleJourToggle = (id: string) => setFormData((p: any) => ({ ...p, jours: p.jours.includes(id) ? p.jours.filter((j: any) => j !== id) : [...p.jours, id] }));

  const filteredCourses = courses.filter(c =>
    (c.nom?.toLowerCase() || '').includes(search.toLowerCase())
  );

  const selectedCar = carsList.find(c => c.id === formData.vehicule);
  const capacity = selectedCar?.capacity ?? 0;
  
  // Find selected trajet to show distance/duration and waypoints
  const selectedTrajet = trajets.find(t => t.id === formData.trajetId);
  const distanceText = selectedTrajet?.distanceKm ? `${selectedTrajet.distanceKm.toFixed(1)} km` : '0 km';
  const durationText = selectedTrajet?.dureeEstimative ? `${selectedTrajet.dureeEstimative} min` : '—';
  const waypoints = selectedTrajet?.waypoints || [];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#F8FAFC] p-6 font-sans text-[#1E293B]">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-[30px] lg:h-[calc(100vh-8rem)]">
        
        {/* Colonne Gauche : Liste des courses */}
        <div className="lg:col-span-3 flex flex-col gap-4 overflow-hidden">
          <div className="bg-white rounded-[10px] p-5 shadow-sm border border-slate-100 shrink-0">
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <h2 className="text-[28px] font-bold text-slate-900 leading-tight">Courses</h2>
              {courses.length > 0 && (
                <span className="text-[13px] font-semibold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100 shrink-0">
                  {courses.length}
                </span>
              )}
            </div>
            <p className="text-[#64748B] text-[14px] mb-4">Planification des horaires</p>

            <div className="uiverse-search-group">
              <Search className="uiverse-search-icon" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="uiverse-search-input" />
            </div>
          </div>

          <div className="cir-radio flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {/* Sans état vide, la colonne restait muette et donnait l'impression
                qu'aucune liste n'existait. */}
            {courses.length === 0 && (
              <div className="bg-white rounded-[10px] p-5 border border-dashed border-slate-300 text-center">
                <Route className="mx-auto mb-2 text-slate-400" size={28} />
                <p className="text-[14px] font-semibold text-slate-700 mb-1">
                  Aucune course planifiée
                </p>
                <p className="text-[13px] text-slate-500">
                  Renseignez le formulaire à droite pour créer la première. Un trajet est requis :
                  créez-le d'abord dans « Trajets ».
                </p>
              </div>
            )}

            {courses.length > 0 && filteredCourses.length === 0 && (
              <p className="text-[13px] text-slate-500 px-2 py-4">
                Aucune course ne correspond à « {search} ».
              </p>
            )}

            {filteredCourses.map(course => (
              <label key={course.id} className="cir-radio__opt relative">
                <input type="radio" checked={selectedCourseId === course.id} onChange={() => handleSelectCourse(course)} />
                <div className="cir-radio__dot"></div>

                <div className="cir-radio__body pl-1">
                  <div className="cir-radio__t flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: course.couleurCarte || '#2563EB' }} />
                    <span className="truncate">{course.nom}</span>
                    <span
                      className={`ml-auto text-[11px] px-2 py-0.5 rounded-full shrink-0 ${
                        course.statut === 'active'
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {course.statut === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="cir-radio__d text-xs mt-1 text-slate-500">
                    Départ: {course.heureDepart || '--:--'}
                    {Array.isArray(course.joursExecution) && course.joursExecution.length > 0
                      ? ` · ${course.joursExecution.join(' ')}`
                      : ''}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Contenu Principal */}
        <div className="lg:col-span-9 flex flex-col gap-6 overflow-y-auto custom-scrollbar pb-6 pr-2">
          
          {/* Carte Passive OSRM */}
          <div className="bg-white rounded-[10px] shadow-sm border border-slate-200 flex flex-col overflow-hidden h-[50vh] min-h-[350px] shrink-0">
            <div className="p-4 border-b border-slate-100 bg-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Navigation size={18} className="text-[#2563EB]" />
                <h3 className="text-[16px] font-bold text-slate-900">Aperçu du trajet</h3>
              </div>
              {selectedTrajet && (
                <div className="text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                  {selectedTrajet.nom} ({distanceText})
                </div>
              )}
            </div>
            <div className="flex-1 relative z-0">
              <MapContainer 
                key={formData.trajetId || 'empty'}
                center={ABIDJAN} 
                zoom={12} 
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {waypoints.length > 0 && (
                  <RoutingMachineReadOnly waypoints={waypoints} color={formData.couleurCarte} />
                )}
              </MapContainer>
            </div>
          </div>

          {/* Formulaire */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white rounded-md shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">{selectedCourseId ? formData.nom : 'Nouvelle Planification'}</h2>
                <div className="flex gap-2">
                  {selectedCourseId && <button onClick={handleDelete} className="uiverse-delete-btn" type="button"><span className="button_top"><Trash2 size={16}/></span></button>}
                  <button onClick={handleNewCourse} className="uiverse-new-btn"><span className="button_top"><Plus size={16}/> Nouveau</span></button>
                </div>
              </div>
              
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-2">
                  <label className="font-bold text-slate-700 block mb-2">Trajet Géographique (Ligne)</label>
                  <select required value={formData.trajetId} onChange={e => setFormData({...formData, trajetId: e.target.value})}
                    className="w-full p-2 border border-slate-300 rounded-md bg-white">
                    <option value="">-- Sélectionnez la ligne à desservir --</option>
                    {trajets.map(t => <option key={t.id} value={t.id}>{t.nom} ({t.sens})</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="uiverse-flex-column">
                    <label>Nom de la course</label>
                    <input required value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})} className="uiverse-input mt-1" />
                  </div>
                  <div className="uiverse-flex-column">
                    <label>Couleur</label>
                    <div className="uiverse-color-container mt-1">
                      {PRESET_COLORS.map(({ hex }) => (
                        <button key={hex} type="button" onClick={() => setFormData({...formData, couleurCarte: hex})}
                          className={`uiverse-color-item ${formData.couleurCarte === hex ? 'selected' : ''}`}
                          style={{ '--color': hex } as any} />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="uiverse-flex-column">
                    <label>Heure de départ</label>
                    <input type="time" required value={formData.heureDepart} onChange={e => setFormData({...formData, heureDepart: e.target.value})} className="uiverse-input mt-1" />
                  </div>
                  <div className="uiverse-flex-column">
                    <label>Heure d'arrivée</label>
                    <input type="time" required value={formData.heureArrivee} onChange={e => setFormData({...formData, heureArrivee: e.target.value})} className="uiverse-input mt-1" />
                  </div>
                </div>

                <div>
                  <label className="font-semibold block mb-2">Jours d'exécution</label>
                  <div className="flex gap-2 flex-wrap">
                    {JOURS_SEMAINE.map(jour => (
                      <button key={jour.id} type="button" onClick={() => handleJourToggle(jour.id)}
                        className={formData.jours.includes(jour.id) ? 'uiverse-3d-btn' : 'uiverse-3d-btn-outline'}>
                        {jour.label.substring(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="font-semibold block mb-1">Véhicule (Optionnel)</label>
                    <select value={formData.vehicule} onChange={e => setFormData({...formData, vehicule: e.target.value})} className="w-full p-2 border rounded-md">
                      <option value="">Non assigné</option>
                      {carsList.map((c: any) => <option key={c.id} value={c.id}>{c.plateNumber}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Chauffeur (Optionnel)</label>
                    <select value={formData.chauffeur} onChange={e => setFormData({...formData, chauffeur: e.target.value})} className="w-full p-2 border rounded-md">
                      <option value="">Non assigné</option>
                      {driversList.map((d: any) => <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>)}
                    </select>
                  </div>
                </div>

                <div className="mt-4 flex gap-3">
                  <button type="submit" disabled={isSaving} className="uiverse-btn-submit flex-1">
                    {isSaving ? '...' : (selectedCourseId ? 'Enregistrer les modifications' : 'Planifier la course')}
                  </button>
                </div>
              </form>
            </div>

            {/* Stats */}
            <div className="lg:col-span-4 bg-white rounded-[10px] shadow-sm border border-slate-200 p-6 flex flex-col gap-6">
              <h3 className="font-bold text-slate-900 border-b pb-2">Informations OSRM</h3>
              <div>
                <span className="block text-[13px] text-slate-500 mb-1">Durée Théorique (sans trafic)</span>
                <span className="text-[24px] font-bold text-slate-900">{durationText}</span>
              </div>
              <div>
                <span className="block text-[13px] text-slate-500 mb-1">Distance Route</span>
                <span className="text-[24px] font-bold text-slate-900">{distanceText}</span>
              </div>
              {selectedCar && (
                <div className="border-t pt-4">
                  <span className="block text-[13px] text-slate-500 mb-1">Capacité du véhicule</span>
                  <span className="text-md font-bold text-slate-900">{capacity} places</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
