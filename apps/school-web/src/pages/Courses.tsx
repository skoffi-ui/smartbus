import React, { useEffect, useState } from 'react';
import {
  Plus, Trash2, Bus, Clock, Calendar, User, Search, MapPin, Navigation, ArrowRight, Route, Check, AlertCircle, Edit, X
} from 'lucide-react';
import CourseMapEditor from './CourseMapEditor';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

import './UiverseButton.css';
import './UiverseInput.css';
import './UiverseRadioList.css';
import './UiverseDeleteButton.css';
import './UiverseNewButton.css';
import './UiverseNeuoInput.css';

import { getCourses, createCourse, deleteCourse, updateCourse } from '../services/transport.service';
import api from '../services/api';

// Fix Leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const schoolIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const ECOLE_COORD: [number, number] = [48.8566, 2.3522];
const MOCK_ROUTE: [number, number][] = [
  [48.8600, 2.3400], [48.8580, 2.3450], [48.8566, 2.3522]
];

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

const DEMO_COURSES: CourseData[] = [
  { id: '1', nom: 'Tournée Matin Nord', description: 'Ramassage des quartiers Nord vers l\'école centrale.', statut: 'active', couleurCarte: '#2563EB', heureDepart: '07:15', heureArrivee: '08:10', jours: ['L','M','Me','J','V'], chauffeur: 'Marc Dubois', vehicule: 'BUS-A1', route: [], markers: [] },
  { id: '2', nom: 'Tournée Soir Centre', description: 'Retour des élèves du centre-ville.', statut: 'active', couleurCarte: '#8B5CF6', heureDepart: '16:30', heureArrivee: '17:45', jours: ['L','M','J','V'], chauffeur: 'Sophie Martin', vehicule: 'BUS-B2', route: [], markers: [] },
];

export interface CourseData {
  id?: string;
  nom: string;
  description: string;
  statut: 'active' | 'inactive';
  couleurCarte: string;
  heureDepart: string;
  heureArrivee: string;
  jours: string[];
  chauffeur: string;
  vehicule: string;
  route: [number, number][];
  markers: [number, number][];
}

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-50 rounded-xl border border-red-200 text-red-600 flex flex-col items-center justify-center text-center">
          <AlertCircle size={48} className="mb-4 opacity-50" />
          <h3 className="font-bold text-lg mb-2">Une erreur inattendue est survenue</h3>
          <p className="text-sm opacity-80">{this.state.error?.message || 'Erreur d\'affichage'}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Courses() {
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [carsList, setCarsList] = useState<any[]>([]);
  const [driversList, setDriversList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const defaultForm: CourseData = { nom: '', description: '', statut: 'active', couleurCarte: '#2563EB', heureDepart: '07:00', heureArrivee: '08:30', jours: ['L', 'M', 'Me', 'J', 'V'], chauffeur: '', vehicule: '', route: [], markers: [] };
  const [formData, setFormData] = useState<CourseData>(defaultForm);

  useEffect(() => { fetchCourses(); fetchCarsList(); fetchDriversList(); }, []);

  const fetchCarsList = async () => { try { const r = await api.get('/cars'); setCarsList(r.data); } catch { /* ignore */ } };
  const fetchDriversList = async () => { try { const r = await api.get('/drivers'); setDriversList(r.data); } catch { /* ignore */ } };
  const fetchCourses = async () => {
    setLoading(true);
    try { 
      const d = await getCourses(); 
      if (Array.isArray(d)) {
        setCourses(d.length === 0 ? DEMO_COURSES : d);
      } else if (d && Array.isArray(d.data)) {
        setCourses(d.data.length === 0 ? DEMO_COURSES : d.data);
      } else {
        setCourses(DEMO_COURSES);
      }
    }
    catch { setCourses(DEMO_COURSES); }
    finally { setLoading(false); }
  };

  const parseMapData = (data: any, isRoute: boolean = false): any[] => {
    if (!data) return [];
    try {
      if (typeof data === 'string') data = JSON.parse(data);
      if (Array.isArray(data)) return data;
      if (data && data.type === 'FeatureCollection' && data.features) {
        if (!isRoute) return []; // GeoJSON to markers not handled yet
        const coords: any[] = [];
        data.features.forEach((f: any) => {
          if (f.geometry?.type === 'LineString') {
            f.geometry.coordinates.forEach((c: any) => coords.push([c[1], c[0]]));
          }
        });
        return coords;
      }
      return [];
    } catch {
      return [];
    }
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
      jours: course.joursExecution || course.jours || [], 
      chauffeur: course.driverId || course.chauffeur || '', 
      vehicule: course.carId || course.vehicule || '', 
      route: parseMapData(course.route, true), 
      markers: parseMapData(course.markers, false) 
    });
  };

  const handleNewCourse = () => {
    setSelectedCourseId(null);
    setFormData(defaultForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      const selectedDriver = driversList.find(d => d.id === formData.chauffeur);
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
        chauffeur: selectedDriver ? `${selectedDriver.firstName} ${selectedDriver.lastName}` : formData.chauffeur || null,
        route: formData.route,
        markers: formData.markers,
      };

      if (selectedCourseId) { 
        const updatedCourse = await updateCourse(selectedCourseId, payload);
        setCourses(c => c.map(x => x.id === selectedCourseId ? updatedCourse : x));
        alert('Course mise à jour avec succès !');
      } else { 
        const newCourse = await createCourse(payload); 
        setCourses(c => [newCourse, ...c]); 
        setSelectedCourseId(newCourse.id); 
        alert('Course planifiée avec succès !');
      }
    } catch (e: any) { 
      console.error('Sauvegarde serveur échouée', e);
      alert('Erreur lors de la sauvegarde : ' + (e.response?.data?.message || e.message));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCourseId) return;
    if (!confirm('Voulez-vous vraiment supprimer cette course ?')) return;
    
    setIsDeleting(true);
    try { 
      await deleteCourse(selectedCourseId);
      setCourses(c => c.filter(x => x.id !== selectedCourseId));
      handleNewCourse();
    } catch (e: any) { 
      console.error('Suppression serveur échouée', e);
      alert('Erreur lors de la suppression : ' + (e.response?.data?.message || e.message));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleJourToggle = (id: string) => setFormData(p => ({ ...p, jours: p.jours.includes(id) ? p.jours.filter(j => j !== id) : [...p.jours, id] }));

  const filteredCourses = courses.filter(c =>
    (c.nom?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (c.chauffeur?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (c.vehicule?.toLowerCase() || '').includes(search.toLowerCase())
  );

  const selectedCar = carsList.find(c => c.id === formData.vehicule);
  const capacity = selectedCar?.capacity ?? 0;
  const mockStudents = capacity > 0 ? Math.floor(capacity * 0.85) : 0;
  const fillPct = capacity > 0 ? (mockStudents / capacity) * 100 : 0;

  // Calcul basique durée (mock)
  const getDuration = () => {
    if (!formData.heureDepart || !formData.heureArrivee) return '—';
    const [dh, dm] = formData.heureDepart.split(':').map(Number);
    const [ah, am] = formData.heureArrivee.split(':').map(Number);
    let diff = (ah * 60 + am) - (dh * 60 + dm);
    if (diff < 0) diff += 24 * 60;
    return `${Math.floor(diff / 60)}h ${diff % 60}m`;
  };

  // Calcul automatique de la distance du tracé (Haversine) sécurisé
  const calculateDistance = () => {
    try {
      if (!formData.route || !Array.isArray(formData.route) || formData.route.length < 2) return 0;
      
      const deg2rad = (deg: number) => deg * (Math.PI/180);
      const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371; // Rayon de la terre en km
        const dLat = deg2rad(lat2-lat1);
        const dLon = deg2rad(lon2-lon1); 
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
          Math.sin(dLon/2) * Math.sin(dLon/2); 
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        return R * c; 
      };

      let totalKm = 0;
      const coords = formData.route;
      
      if (Array.isArray(coords) && Array.isArray(coords[0]) && coords[0].length === 2) {
        for (let i = 0; i < coords.length - 1; i++) {
          if (Array.isArray(coords[i]) && Array.isArray(coords[i+1])) {
            totalKm += getDistanceFromLatLonInKm(coords[i][0], coords[i][1], coords[i+1][0], coords[i+1][1]);
          }
        }
      }

      return totalKm;
    } catch (error) {
      console.error('Erreur lors du calcul de la distance', error);
      return 0;
    }
  };

  const distanceText = calculateDistance() > 0 ? `${calculateDistance().toFixed(1)} km` : '0 km';

  return (
    <ErrorBoundary>
    <div className="min-h-[calc(100vh-4rem)] bg-[#F8FAFC] p-6 font-sans text-[#1E293B]">
      
      {/* 3 Columns Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-[30px] lg:h-[calc(100vh-8rem)]">
        
        {/* ── Gauche : Liste des courses ── */}
        <div className="lg:col-span-3 flex flex-col gap-4 overflow-hidden">
          {/* Header Gauche */}
          <div className="bg-white rounded-[10px] p-5 shadow-sm border border-slate-100 shrink-0">
            <h2 className="text-[28px] font-bold text-slate-900 mb-1 leading-tight tracking-tight">Courses</h2>
            <p className="text-[#64748B] text-[14px] mb-4">Gestion des itinéraires</p>
            
            <div className="flex gap-3 mb-4">
              <div className="flex-1 bg-blue-50 text-[#2563EB] rounded-[8px] p-3 border border-blue-100 flex flex-col items-center justify-center">
                <span className="text-[22px] font-bold">{courses.length}</span>
                <span className="text-[12px] font-semibold uppercase tracking-wide">Total</span>
              </div>
              <div className="flex-1 bg-[#22C55E]/10 text-[#22C55E] rounded-[8px] p-3 border border-[#22C55E]/20 flex flex-col items-center justify-center">
                <span className="text-[22px] font-bold">{courses.filter(c => c.statut === 'active').length}</span>
                <span className="text-[12px] font-semibold uppercase tracking-wide">Actives</span>
              </div>
            </div>

            <div className="uiverse-search-group">
              <Search className="uiverse-search-icon" />
              <input 
                value={search} onChange={e => setSearch(e.target.value)} 
                placeholder="Rechercher..."
                className="uiverse-search-input" 
              />
            </div>
          </div>

          {/* Liste */}
          <div className="cir-radio flex-1 overflow-y-auto pr-2 custom-scrollbar" style={{ width: '100%' }}>
            {filteredCourses.map(course => (
              <label key={course.id} className="cir-radio__opt relative">
                <input 
                  type="radio" 
                  name="course-selection" 
                  checked={selectedCourseId === course.id} 
                  onChange={() => handleSelectCourse(course)} 
                />
                <div className="cir-radio__dot"></div>
                
                <div className="cir-radio__body pl-1">
                  <div className="cir-radio__t flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: course.couleurCarte || '#2563EB' }} />
                    {course.nom}
                    {course.statut === 'active' && <span className="cir-radio__chip" style={{ backgroundColor: '#22C55E' }}>Active</span>}
                  </div>
                  <div className="cir-radio__d flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1"><User size={12}/> <span className="truncate max-w-[80px]">{course.driver && typeof course.driver === 'object' ? `${course.driver.firstName || ''} ${course.driver.lastName || ''}` : course.chauffeur || 'N/A'}</span></span>
                    <span className="flex items-center gap-1"><Bus size={12}/> <span className="truncate max-w-[80px]">{course.car && typeof course.car === 'object' ? course.car.plateNumber : course.vehicule || 'N/A'}</span></span>
                  </div>
                </div>
                
                <div className="cir-radio__price text-right flex flex-col items-end justify-center">
                  <div>{course.heureDepart || '--:--'}</div>
                  <small className="mt-0.5">{course.heureArrivee || '--:--'}</small>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* ── Contenu Principal (Carte + Formulaire) ── */}
        <div className="lg:col-span-9 flex flex-col gap-6 overflow-y-auto custom-scrollbar pb-6 pr-2">
          
          {/* ── Section Haute : CARTE PLEINE LARGEUR ── */}
          <div className="bg-white rounded-[10px] shadow-sm border border-slate-200 flex flex-col overflow-hidden h-[60vh] min-h-[400px] shrink-0">
            <div className="p-4 border-b border-slate-100 bg-white flex items-center gap-2">
              <Navigation size={18} className="text-[#2563EB]" />
              <h3 className="text-[16px] font-bold text-slate-900">Tracez l'itinéraire de la course</h3>
            </div>
            <div className="flex-1 bg-[#F1F5F9] relative z-0 w-full h-full min-h-[300px]">
              <ErrorBoundary>
                <CourseMapEditor 
                  center={ECOLE_COORD} 
                  zoom={13} 
                  routeColor={formData.couleurCarte} 
                  initialRoute={formData.route}
                  initialMarkers={formData.markers}
                  onMapChange={(data) => setFormData({ ...formData, route: data.route, markers: data.markers })}
                />
              </ErrorBoundary>
            </div>
          </div>

          {/* ── Section Basse : Formulaire & Stats ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Formulaire */}
            <div className="lg:col-span-7 bg-white rounded-md shadow-sm border border-slate-200 flex flex-col overflow-hidden">
              <section className="rounded-md p-2 bg-white h-full flex flex-col">
                <div className="flex-1 overflow-y-auto custom-scrollbar my-3">
                  <div className="mx-auto p-4 w-full h-full flex flex-col">
                    <div className="mb-2"></div>
                    
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-bold leading-tight text-gray-900 tracking-tight" style={{ marginTop: '10px', marginBottom: '10px' }}>
                          {selectedCourseId ? formData.nom || 'Course sans nom' : 'Nouvelle Course'}
                        </h2>
                        {selectedCourseId && (
                          <span className={`px-2 py-0.5 rounded-[6px] text-[11px] font-bold uppercase tracking-wider ${formData.statut === 'active' ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-slate-100 text-slate-500'}`}>
                            {formData.statut}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {selectedCourseId && (
                          <button onClick={handleDelete} className="uiverse-delete-btn" type="button" disabled={isDeleting}>
                            <span className="button_top">
                              <Trash2 size={16} /> {isDeleting ? '...' : 'Supprimer'}
                            </span>
                          </button>
                        )}
                        <button onClick={handleNewCourse} className="uiverse-new-btn" type="button">
                          <span className="button_top">
                            <Plus size={16} /> Nouveau
                          </span>
                        </button>
                      </div>
                    </div>
                    
                    <p className="mt-2 text-base text-gray-600">
                      Configuration de la planification
                    </p>
                    
                    <form id="course-form" onSubmit={handleSubmit} className="mt-5 flex-1 flex flex-col">
                      <div className="uiverse-form flex-1">
                        <div className="uiverse-flex-column">
                          <label>Nom de la course</label>
                          <div className="uiverse-inputForm mt-1">
                            <input required value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})}
                              placeholder="Ex: Tournée Maternelle Centre"
                              className="uiverse-input" />
                          </div>
                        </div>
                        
                        <div className="uiverse-flex-column">
                          <label>Description</label>
                          <div className="uiverse-inputForm mt-1">
                            <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}
                              placeholder="Points de passages, instructions particulières..." rows={2}
                              className="uiverse-input resize-none" />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="uiverse-flex-column">
                            <label>Heure de départ</label>
                            <div className="uiverse-inputForm mt-1">
                              <Clock size={16} className="text-gray-400" />
                              <input type="time" required value={formData.heureDepart} onChange={e => setFormData({...formData, heureDepart: e.target.value})}
                                className="uiverse-input" />
                            </div>
                          </div>
                          <div className="uiverse-flex-column">
                            <label>Heure d'arrivée</label>
                            <div className="uiverse-inputForm mt-1">
                              <Clock size={16} className="text-gray-400" />
                              <input type="time" required value={formData.heureArrivee} onChange={e => setFormData({...formData, heureArrivee: e.target.value})}
                                className="uiverse-input" />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="text-base font-medium text-gray-900">Jours d'exécution</label>
                          <div className="flex gap-3 flex-wrap" style={{ marginTop: '30px', marginBottom: '30px' }}>
                            {JOURS_SEMAINE.map(jour => {
                              const sel = formData.jours.includes(jour.id);
                              return (
                                <button key={jour.id} type="button" onClick={() => handleJourToggle(jour.id)}
                                  className={sel ? 'uiverse-3d-btn' : 'uiverse-3d-btn-outline'}>
                                  {jour.label.substring(0, 3)}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <label className="text-base font-medium text-gray-900">Couleur d'identification</label>
                          <div className="uiverse-color-container mt-2">
                            {PRESET_COLORS.map(({ hex, label }) => {
                              const isSelected = formData.couleurCarte === hex;
                              return (
                                <button 
                                  key={hex} 
                                  type="button" 
                                  onClick={() => setFormData({...formData, couleurCarte: hex})}
                                  className={`uiverse-color-item ${isSelected ? 'selected' : ''}`}
                                  style={{ '--color': hex } as any}
                                  aria-color={label || 'Couleur'}
                                />
                              );
                            })}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-base font-medium text-gray-900">Véhicule assigné</label>
                            <div className="mt-2 relative">
                              <Bus size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                              <select value={formData.vehicule} onChange={e => setFormData({...formData, vehicule: e.target.value})}
                                className="flex h-10 w-full rounded-md border border-gray-300 bg-transparent pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:ring-offset-1 appearance-none cursor-pointer">
                                <option value="">Sélectionner</option>
                                {carsList.map((c: any) => <option key={c.id} value={c.id}>{c.plateNumber}</option>)}
                              </select>
                            </div>
                          </div>
                          
                          <div>
                            <label className="text-base font-medium text-gray-900">Chauffeur assigné</label>
                            <div className="mt-2 relative">
                              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                              <select value={formData.chauffeur} onChange={e => setFormData({...formData, chauffeur: e.target.value})}
                                className="flex h-10 w-full rounded-md border border-gray-300 bg-transparent pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:ring-offset-1 appearance-none cursor-pointer">
                                <option value="">Sélectionner</option>
                                {driversList.map((d: any) => <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>)}
                              </select>
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between">
                            <label className="text-base font-medium text-gray-900">Statut</label>
                          </div>
                          <div className="mt-2 flex bg-gray-100 p-1 rounded-md">
                            <button type="button" onClick={() => setFormData({...formData, statut: 'active'})} 
                              className={`flex-1 h-9 rounded text-sm font-semibold transition-all ${formData.statut === 'active' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                              Active
                            </button>
                            <button type="button" onClick={() => setFormData({...formData, statut: 'inactive'})} 
                              className={`flex-1 h-9 rounded text-sm font-semibold transition-all ${formData.statut === 'inactive' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                              Inactive
                            </button>
                          </div>
                        </div>

                      </div>
                      
                      <div className="mt-6 flex gap-3 pt-4 border-t border-gray-200">
                        <div className="flex-1">
                          <button type="button" onClick={handleNewCourse} className="uiverse-btn-outline">
                            Annuler
                          </button>
                        </div>
                        <div className="flex-1">
                          <button onClick={handleSubmit} type="button" className="uiverse-btn-submit">
                            {selectedCourseId ? 'Mettre à jour' : 'Planifier la course'}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              </section>
            </div>

            {/* Stats Trajet */}
            <div className="lg:col-span-5 bg-white rounded-[10px] shadow-sm border border-slate-200 p-6 flex flex-col gap-6">
              <h3 className="text-[16px] font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Route size={18} className="text-[#64748B]" /> Informations du Trajet
              </h3>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <span className="block text-[13px] font-semibold text-[#64748B] mb-1">Durée estimée</span>
                  <span className="text-[20px] font-bold text-slate-900">{getDuration()}</span>
                </div>
                <div>
                  <span className="block text-[13px] font-semibold text-[#64748B] mb-1">Distance (est.)</span>
                  <span className="text-[20px] font-bold text-slate-900">{distanceText}</span>
                </div>
              </div>
              
              <div className="border-t border-slate-100 pt-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[14px] font-semibold text-slate-900 flex items-center gap-2"><Bus size={16} className="text-[#2563EB]" /> {formData.vehicule || 'Aucun véhicule'}</span>
                  <span className="text-[13px] font-bold text-slate-500">{mockStudents} / {capacity || '--'} élèves</span>
                </div>
                <div className="h-[8px] w-full bg-[#F1F5F9] rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-1000" 
                    style={{ width: `${capacity > 0 ? Math.min(fillPct, 100) : 0}%`, backgroundColor: capacity > 0 && fillPct > 90 ? '#EF4444' : '#22C55E' }} 
                  />
                </div>
                {capacity > 0 && fillPct > 90 && <span className="text-[12px] text-[#EF4444] font-medium mt-1.5 flex items-center gap-1"><AlertCircle size={12}/> Capacité presque atteinte</span>}
              </div>

              <div className="border-t border-slate-100 pt-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#F1F5F9] flex items-center justify-center text-[#64748B]">
                  <User size={18} />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-[#64748B]">Chauffeur assigné</div>
                  <div className="text-[15px] font-bold text-slate-900">{formData.chauffeur || 'Aucun chauffeur sélectionné'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
    </ErrorBoundary>
  );
}
