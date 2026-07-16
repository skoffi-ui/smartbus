import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import api from '../services/api';
import { Bus, MapPin, Bell, User, Clock } from 'lucide-react';
import './Dashboard.css';

// Fix leaflet icon issue in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const busIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const punchIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [20, 32],
  iconAnchor: [10, 32],
  popupAnchor: [1, -28],
  shadowSize: [32, 32]
});

function MapUpdater({ locations }: { locations: any[] }) {
  const map = useMap();
  const [hasCentered, setHasCentered] = useState(false);
  
  useEffect(() => {
    if (locations.length > 0 && !hasCentered) {
      const bounds = L.latLngBounds(locations.map(loc => [loc.lat, loc.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      setHasCentered(true); // Empêche la carte de se recentrer toutes les 10 secondes
    }
  }, [locations, map, hasCentered]);
  return null;
}

export default function LiveTracking() {
  const [locations, setLocations] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [gpsRes, notifRes] = await Promise.all([
        api.get('/gps/live'),
        api.get('/notifications')
      ]);
      setLocations(gpsRes.data || []);
      setNotifications(notifRes.data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des données en direct:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Rafraîchir toutes les 10 secondes
    return () => clearInterval(interval);
  }, []);

  const abidjanCenter: [number, number] = [5.3364, -4.0267];

  return (
    <div className="animate-fade-in" style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-2xl" style={{ margin: 0 }}>Centre de Contrôle & Tracking</h1>
          <p className="text-secondary" style={{ marginTop: '0.25rem' }}>Suivez vos véhicules et recevez les alertes de pointage en temps réel.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
           <div className="glass-panel" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '2rem' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 10px var(--success)' }}></div>
              <span className="text-sm font-medium">GPS Actif</span>
           </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', flex: 1, minHeight: 0 }}>
        {/* Colonne Carte GPS */}
        <div className="glass-panel" style={{ flex: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MapPin size={20} className="text-primary" />
            <h2 className="text-lg" style={{ margin: 0 }}>Carte en Direct</h2>
          </div>
          <div style={{ flex: 1, zIndex: 0 }}>
            {loading && locations.length === 0 ? (
               <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <p className="text-secondary">Chargement de la carte...</p>
               </div>
            ) : (
              <MapContainer center={abidjanCenter} zoom={12} style={{ height: '100%', width: '100%' }}>
                <MapUpdater locations={locations} />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {locations.map((loc, idx) => (
                  <Marker key={idx} position={[loc.lat, loc.lng]} icon={busIcon}>
                    <Popup>
                      <div style={{ textAlign: 'center' }}>
                         <strong style={{ fontSize: '1.1rem', color: '#1e293b' }}>{loc.plateNumber}</strong><br/>
                         <span style={{ color: '#64748b' }}>{loc.brand} {loc.model}</span><br/>
                         <div style={{ marginTop: '5px', padding: '3px 8px', background: '#f1f5f9', borderRadius: '4px', display: 'inline-block', fontSize: '0.85rem' }}>
                           Vitesse: {loc.speed} km/h
                         </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
                
                {/* Historique des pointages (avec décalage visuel si le bus est garé) */}
                {notifications
                  .filter(n => n.metadata && n.metadata.lat && n.metadata.lng)
                  .map((notif, idx) => {
                    // Création d'un très léger décalage en spirale pour que les points ne se superposent pas
                    // 0.00005 degrés = environ 5 mètres
                    const offset = 0.00008;
                    const angle = idx * 1.5; // Angle arbitraire
                    const radius = offset * Math.sqrt(idx);
                    
                    const displayLat = notif.metadata.lat + (Math.cos(angle) * radius);
                    const displayLng = notif.metadata.lng + (Math.sin(angle) * radius);
                    
                    return (
                      <Marker 
                        key={`punch-${notif.id || idx}`} 
                        position={[displayLat, displayLng]} 
                        icon={punchIcon}
                      >
                        <Popup>
                          <div style={{ textAlign: 'center', maxWidth: '200px' }}>
                             <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>{notif.title}</strong><br/>
                             <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                               {new Date(notif.createdAt).toLocaleTimeString('fr-FR')}
                             </span>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })
                }
              </MapContainer>
            )}
          </div>
        </div>

        {/* Colonne Notifications / Alertes */}
        <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bell size={20} className="text-warning" />
              <h2 className="text-lg" style={{ margin: 0 }}>Fil d'Alertes</h2>
            </div>
            <span style={{ background: 'rgba(245, 158, 11, 0.2)', color: 'var(--warning)', padding: '0.2rem 0.6rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 'bold' }}>
              {notifications.length}
            </span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }} className="custom-scrollbar">
             {loading && notifications.length === 0 ? (
                <p className="text-center text-secondary">Chargement...</p>
             ) : notifications.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem' }}>
                   <Bell size={32} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
                   <p>Aucune alerte pour le moment.</p>
                </div>
             ) : (
                notifications.map((notif) => {
                  const isMontée = notif.message.includes('monté');
                  return (
                    <div key={notif.id} style={{ 
                      padding: '1rem', 
                      background: 'rgba(255,255,255,0.03)', 
                      border: '1px solid var(--glass-border)',
                      borderLeft: `4px solid ${isMontée ? 'var(--primary)' : 'var(--warning)'}`,
                      borderRadius: '0.5rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                         <strong style={{ fontSize: '0.95rem' }}>{notif.title}</strong>
                         <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <Clock size={10} /> {new Date(notif.createdAt).toLocaleTimeString('fr-FR')}
                         </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        {notif.message}
                      </p>
                      
                      {notif.metadata && notif.metadata.lat && (
                        <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                           <a 
                             href={`https://www.google.com/maps/search/?api=1&query=${notif.metadata.lat},${notif.metadata.lng}`}
                             target="_blank"
                             rel="noreferrer"
                             style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--primary)', textDecoration: 'none', background: 'rgba(59, 130, 246, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}
                           >
                             <MapPin size={12} /> Voir sur la carte
                           </a>
                        </div>
                      )}
                    </div>
                  );
                })
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
