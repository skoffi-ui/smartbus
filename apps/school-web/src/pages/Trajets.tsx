import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// Use dynamic CDN loading for LRM to bypass NPM network issues

import { Map, Save, Navigation, AlertCircle, Trash2, Route, Plus, Trash } from 'lucide-react';
import { getTrajets, createTrajet, updateTrajet, deleteTrajet, reverseGeocode } from '../services/transport.service';

import './UiverseButton.css';
import './UiverseInput.css';

// Fix icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

function RoutingMachine({ initialWaypoints, onRouteFound, readOnly = false }: any) {
  const map = useMap();
  const routingControlRef = useRef<any>(null);

  useEffect(() => {
    if (!map) return;
    
    // Load Leaflet Routing Machine from CDN if not present
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
          // If script tag exists but maybe not loaded yet, wait a bit
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
        waypoints: initialWaypoints || [],
        routeWhileDragging: !readOnly,
        show: false, // hide instructions panel
        addWaypoints: !readOnly,
        fitSelectedRoutes: true,
        lineOptions: {
          styles: [{ color: '#3b82f6', weight: 5, opacity: 0.8 }]
        },
        createMarker: function(i: number, wp: any, n: number) {
          const isStart = i === 0;
          const isEnd = i === n - 1;
          const color = isStart ? 'green' : (isEnd ? 'red' : 'blue');
          return L.marker(wp.latLng, {
            draggable: !readOnly,
            icon: new L.Icon({
              iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
              shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
              iconSize: [25, 41], iconAnchor: [12, 41]
            })
          });
        }
      }).addTo(map);

      control.on('routesfound', (e: any) => {
        const route = e.routes[0];
        const summary = route.summary;
        const coords = route.coordinates;
        
        const geojson = {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: coords.map((c: any) => [c.lng, c.lat])
            }
          }]
        };
        
        const wps = control.getWaypoints().map((w: any) => w.latLng).filter(Boolean);
        if (onRouteFound) {
          onRouteFound(summary.totalDistance, summary.totalTime, geojson, wps);
        }
      });

      routingControlRef.current = control;

      // Cleanup function is handled in the main useEffect return, but we can store cleanup logic
      } catch (err) {
        console.error("Failed to initialize Leaflet Routing Machine", err);
      }
    }
  }, [map, readOnly]); // Mount once per map config

  // Add waypoint on click (if not readonly)
  useEffect(() => {
    if (readOnly) return;
    const onMapClick = async (e: L.LeafletMouseEvent) => {
      if (routingControlRef.current) {
        const currentWps = routingControlRef.current.getWaypoints().filter((w: any) => w.latLng);
        routingControlRef.current.spliceWaypoints(currentWps.length, 0, e.latlng);
        
        // Notify parent about new point for Geocoding
        if ((window as any).handleMapClickForGeocode) {
           (window as any).handleMapClickForGeocode(e.latlng.lat, e.latlng.lng);
        }
      }
    };
    map.on('click', onMapClick);
    return () => { map.off('click', onMapClick); };
  }, [map, readOnly]);

  return null;
}

export default function Trajets() {
  const [trajets, setTrajets] = useState<any[]>([]);
  const [selectedTrajetId, setSelectedTrajetId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ nom: '', description: '', sens: 'aller' });
  
  const [waypoints, setWaypoints] = useState<any[]>([]);
  const [geoJson, setGeoJson] = useState<any>(null);
  const [distanceKm, setDistanceKm] = useState(0);
  const [dureeMin, setDureeMin] = useState(0);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Attach geocode handler to window so the RoutingMachine inner component can call it
  useEffect(() => {
    (window as any).handleMapClickForGeocode = async (lat: number, lng: number) => {
      try {
        const geo = await reverseGeocode(lat, lng);
        if (geo && geo.success) {
          setFormData(prev => ({
            ...prev,
            // Ne remplit la description que si elle est vide (préserve la saisie manuelle)
            description: prev.description && prev.description.trim() !== '' 
              ? prev.description 
              : geo.address
          }));
        }
      } catch (err) {
        console.error("Geocoding failed", err);
      }
    };
    return () => { delete (window as any).handleMapClickForGeocode; };
  }, []);

  useEffect(() => { fetchTrajets(); }, []);

  const fetchTrajets = async () => {
    try {
      const data = await getTrajets();
      setTrajets(Array.isArray(data) ? data : []);
    } catch (e) { console.error('Fetch trajets failed', e); }
  };

  const handleSelectTrajet = (trajet: any) => {
    setSelectedTrajetId(trajet.id);
    setFormData({ nom: trajet.nom, description: trajet.description || '', sens: trajet.sens || 'aller' });
    setDistanceKm(trajet.distanceKm || 0);
    setDureeMin(trajet.dureeEstimative || 0);
    setGeoJson(trajet.geoJson || null);
    
    // Convert saved waypoints back to LatLng format if needed
    if (trajet.waypoints && Array.isArray(trajet.waypoints)) {
      setWaypoints(trajet.waypoints);
    } else {
      setWaypoints([]);
    }
  };

  const handleNew = () => {
    setSelectedTrajetId(null);
    setFormData({ nom: '', description: '', sens: 'aller' });
    setWaypoints([]);
    setGeoJson(null);
    setDistanceKm(0);
    setDureeMin(0);
  };

  const handleRouteFound = (dist: number, time: number, geo: any, wps: any) => {
    setDistanceKm(dist / 1000); // meters to km
    setDureeMin(Math.round(time / 60)); // seconds to mins
    setGeoJson(geo);
    setWaypoints(wps);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (waypoints.length < 2) {
      alert("Veuillez placer au moins un point de départ et un point d'arrivée sur la carte.");
      return;
    }
    
    setIsSaving(true);
    const payload = {
      ...formData,
      distanceKm,
      dureeEstimative: dureeMin,
      geoJson,
      waypoints // save the lat/lng array
    };

    try {
      if (selectedTrajetId) {
        const updated = await updateTrajet(selectedTrajetId, payload);
        setTrajets(prev => prev.map(t => t.id === selectedTrajetId ? updated : t));
        alert('Trajet mis à jour avec succès !');
      } else {
        const created = await createTrajet(payload);
        setTrajets(prev => [...prev, created]);
        setSelectedTrajetId(created.id);
        alert('Trajet créé avec succès !');
      }
    } catch (err: any) {
      alert('Erreur: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTrajetId) return;
    if (!confirm('Voulez-vous vraiment supprimer ce trajet géographique ?')) return;
    setIsDeleting(true);
    try {
      await deleteTrajet(selectedTrajetId);
      setTrajets(prev => prev.filter(t => t.id !== selectedTrajetId));
      handleNew();
    } catch (err) {
      alert('Erreur lors de la suppression.');
    } finally {
      setIsDeleting(false);
    }
  };

  const clearMap = () => {
    if (confirm("Voulez-vous effacer le tracé actuel sur la carte ?")) {
      setWaypoints([]);
      setGeoJson(null);
      setDistanceKm(0);
      setDureeMin(0);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#F8FAFC] p-6 font-sans text-[#1E293B]">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-[30px] lg:h-[calc(100vh-8rem)]">
        
        {/* Colonne Gauche : Formulaire & Liste */}
        <div className="lg:col-span-4 flex flex-col gap-4 overflow-hidden">
          
          <div className="bg-white rounded-[10px] p-5 shadow-sm border border-slate-100 shrink-0">
            <h2 className="text-[28px] font-bold text-slate-900 mb-1 leading-tight flex items-center gap-2">
              <Route className="text-blue-600" /> Trajets
            </h2>
            <p className="text-[#64748B] text-[14px] mb-4">Itinéraires géographiques (OSRM)</p>
            
            <div className="flex gap-2">
              <select 
                className="uiverse-input flex-1" 
                value={selectedTrajetId || ''}
                onChange={(e) => {
                  if (e.target.value === '') handleNew();
                  else {
                    const trj = trajets.find(t => t.id === e.target.value);
                    if (trj) handleSelectTrajet(trj);
                  }
                }}
              >
                <option value="">-- Créer un nouveau trajet --</option>
                {trajets.map(t => (
                  <option key={t.id} value={t.id}>{t.nom} ({t.sens})</option>
                ))}
              </select>
              {selectedTrajetId && (
                <button onClick={handleNew} className="uiverse-new-btn px-3 flex-shrink-0" title="Nouveau">
                  <span className="button_top"><Plus size={18}/></span>
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-[10px] shadow-sm border border-slate-100 flex-1 overflow-y-auto custom-scrollbar p-5">
            <form onSubmit={handleSave} className="flex flex-col h-full">
              <div className="uiverse-flex-column mb-4">
                <label>Nom de la Ligne</label>
                <div className="uiverse-inputForm mt-1">
                  <input required value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})}
                    placeholder="Ex: Ligne 1 - Nord" className="uiverse-input" />
                </div>
              </div>

              <div className="uiverse-flex-column mb-4">
                <label>Sens du trajet</label>
                <div className="mt-2 flex gap-2">
                  {['aller', 'retour', 'mixte'].map(s => (
                    <button key={s} type="button" 
                      onClick={() => setFormData({...formData, sens: s})}
                      className={`flex-1 py-2 rounded font-semibold text-sm border capitalize transition-colors ${formData.sens === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="uiverse-flex-column mb-6 flex-1">
                <label>Description / Notes</label>
                <div className="uiverse-inputForm mt-1 h-full">
                  <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}
                    placeholder="Quartiers traversés..." className="uiverse-input resize-none h-full min-h-[80px]" />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
                <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2"><Navigation size={16}/> Statistiques (OSRM)</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-blue-600 block">Distance totale</span>
                    <span className="font-bold text-blue-900 text-lg">{distanceKm.toFixed(2)} km</span>
                  </div>
                  <div>
                    <span className="text-blue-600 block">Durée sans arrêts</span>
                    <span className="font-bold text-blue-900 text-lg">{dureeMin} min</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-auto">
                {selectedTrajetId && (
                  <button type="button" onClick={handleDelete} disabled={isDeleting} className="uiverse-delete-btn flex-shrink-0">
                    <span className="button_top"><Trash2 size={20}/></span>
                  </button>
                )}
                <button type="submit" disabled={isSaving} className="uiverse-btn-submit flex-1">
                  {isSaving ? '...' : (selectedTrajetId ? 'Mettre à jour le trajet' : 'Enregistrer le trajet')}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Colonne Droite : Carte Interactive */}
        <div className="lg:col-span-8 bg-white rounded-[10px] shadow-sm border border-slate-200 flex flex-col overflow-hidden relative min-h-[500px]">
          <div className="p-3 bg-white border-b flex justify-between items-center z-10 relative">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Map size={18} className="text-blue-600" />
              Cliquez sur la carte pour tracer le parcours (Départ, Étapes, Arrivée). OSRM calculera la route.
            </div>
            <button onClick={clearMap} className="text-red-500 hover:bg-red-50 p-2 rounded-md transition-colors flex items-center gap-1 text-sm font-bold">
              <Trash size={16}/> Effacer
            </button>
          </div>
          
          <div className="flex-1 relative z-0">
            {/* Clé magique : on force le remontage de la map si on change de trajet pour reset OSRM */}
            <MapContainer 
              key={selectedTrajetId || 'new'}
              center={[48.8566, 2.3522]} 
              zoom={13} 
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap'
              />
              <RoutingMachine 
                initialWaypoints={waypoints} 
                onRouteFound={handleRouteFound} 
                readOnly={false} 
              />
            </MapContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
