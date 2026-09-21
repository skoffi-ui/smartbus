import React, { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Tooltip,
  useMap,
  Polyline,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  Bus,
  MapPin,
  Bell,
  User,
  Clock,
  Wifi,
  WifiOff,
  AlertTriangle,
  Users,
  RefreshCw,
  Navigation,
  Activity,
  ChevronRight,
} from 'lucide-react';
import { useRealTimeTracking, type BusPosition, type PunchEvent } from '../hooks/useRealTimeTracking';
import AnimatedBusMarker from '../components/AnimatedBusMarker';
import api from '../services/api';

// Fix leaflet icon default
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const stopIcon = new L.DivIcon({
  className: '',
  html: `<div style="
    width: 14px;
    height: 14px;
    background: #4f46e5;
    border-radius: 50%;
    border: 3px solid white;
    box-shadow: 0 2px 8px rgba(79,70,229,0.5);
  "></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const punchStopIcon = new L.DivIcon({
  className: '',
  html: `<div style="
    width: 10px;
    height: 10px;
    background: #10b981;
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: 0 2px 6px rgba(16,185,129,0.6);
    animation: punchPulse 1s ease-out 1;
  "></div>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

// Composant interne pour centrer la carte sur les bus
function MapViewController({ positions }: { positions: BusPosition[] }) {
  const map = useMap();
  const [centered, setCentered] = useState(false);

  useEffect(() => {
    if (positions.length > 0 && !centered) {
      if (positions.length === 1) {
        map.setView([positions[0].latitude, positions[0].longitude], 14, { animate: true });
      } else {
        const bounds = L.latLngBounds(positions.map((p) => [p.latitude, p.longitude]));
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
      }
      setCentered(true);
    }
  }, [positions, map, centered]);

  return null;
}

// Badge de statut de connexion WebSocket
function ConnectionBadge({ status, onReconnect }: { status: string; onReconnect: () => void }) {
  const configs: Record<string, { color: string; icon: React.ReactNode; label: string; bg: string }> = {
    connected:    { color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: <Wifi size={13} />,       label: 'Temps réel' },
    connecting:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: <Activity size={13} />,   label: 'Connexion…' },
    disconnected: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   icon: <WifiOff size={13} />,    label: 'Déconnecté' },
    error:        { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   icon: <AlertTriangle size={13}/>,label: 'Erreur' },
    unauthorized: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   icon: <AlertTriangle size={13}/>,label: 'Session expirée' },
  };
  const cfg = configs[status] || configs.disconnected;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.35rem 0.8rem',
        borderRadius: '2rem',
        background: cfg.bg,
        color: cfg.color,
        fontSize: '0.78rem',
        fontWeight: 600,
        border: `1px solid ${cfg.color}30`,
        userSelect: 'none',
      }}>
        <span style={{ display: 'flex' }}>{cfg.icon}</span>
        <span>{cfg.label}</span>
        {status !== 'connected' && (
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, animation: 'statusPulse 1.2s ease-in-out infinite', display: 'inline-block' }} />
        )}
        {status === 'connected' && (
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.color, display: 'inline-block' }} />
        )}
      </div>
      {(status === 'disconnected' || status === 'error') && (
        <button onClick={onReconnect} title="Reconnecter" style={{
          display: 'flex', alignItems: 'center', gap: '0.3rem',
          padding: '0.35rem 0.7rem', borderRadius: '2rem',
          background: 'rgba(79,70,229,0.1)', color: 'var(--accent-primary)',
          border: '1px solid rgba(79,70,229,0.25)', fontSize: '0.75rem',
          fontWeight: 600, cursor: 'pointer',
        }}>
          <RefreshCw size={12} /> Reconnecter
        </button>
      )}
    </div>
  );
}

// Carte de stat en haut
function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.9)',
      border: '1px solid var(--glass-border)',
      borderRadius: '0.75rem',
      padding: '0.85rem 1.1rem',
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      minWidth: 120,
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    }}>
      <div style={{ color, display: 'flex', padding: '0.5rem', background: `${color}15`, borderRadius: '0.5rem' }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '1.3rem', fontWeight: 700, lineHeight: 1, color: 'var(--text-primary)' }}>{value}</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{label}</div>
      </div>
    </div>
  );
}

// Carte d'événement latérale
function EventCard({ event }: { event: PunchEvent & { type?: string } }) {
  const isMontee = event.punchState === '0';
  const isProximity = event.punchState === 'proximity';
  const isCritical = event.punchState === 'critical';

  const color = isCritical ? '#ef4444' : isProximity ? '#f59e0b' : isMontee ? '#4f46e5' : '#10b981';
  const icon = isCritical ? '🚨' : isProximity ? '📍' : isMontee ? '⬆️' : '⬇️';
  const label = isCritical ? 'Anomalie Critique' : isProximity ? 'Alerte Proximité' : isMontee ? 'Montée' : 'Descente';

  return (
    <div style={{
      padding: '0.85rem 1rem',
      background: isCritical ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.7)',
      border: `1px solid ${color}30`,
      borderLeft: `3px solid ${color}`,
      borderRadius: '0.5rem',
      animation: 'slideInEvent 0.3s ease-out',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.9rem' }}>{icon}</span>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color }}>{label}</span>
        </div>
        <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
          <Clock size={9} />{new Date(event.time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>
      <div style={{ marginTop: '0.4rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
        {event.childName}
      </div>
      {isCritical && event.message ? (
        <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem', lineHeight: 1.4, fontWeight: 500 }}>
          {event.message}
        </div>
      ) : null}
      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
        <span>Bus : {event.terminalSn}</span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Composant principal
// ──────────────────────────────────────────────────────────────────────────────
export default function LiveTracking() {
  // L'école n'est plus déterminée côté client : le serveur la déduit du jeton et
  // ne diffuse que les bus de cette école.
  const { busPositions, punchEvents, connectionStatus, activeBusCount, reconnect } =
    useRealTimeTracking();

  const [busDetails, setBusDetails] = useState<Record<string, any>>({});
  const [selectedBus, setSelectedBus] = useState<string | null>(null);
  const [stops, setStops] = useState<any[]>([]);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const abidjanCenter: [number, number] = [5.3364, -4.0267];

  // Charger le tracé d'itinéraire OSRM réel lorsque le bus/course est sélectionné
  useEffect(() => {
    if (!selectedBus) {
      setRouteCoordinates([]);
      return;
    }
    
    if (stops.length < 2) return;
    
    // Convertir les arrêts en waypoints valides pour OSRM
    const waypoints = stops
      .filter(s => s.latitude && s.longitude)
      .map(s => ({
        lat: parseFloat(s.latitude),
        lng: parseFloat(s.longitude)
      }));

    if (waypoints.length < 2) return;

    async function fetchRoute() {
      try {
        const res = await api.post('/gps/route', { waypoints });
        if (res.data && res.data.success && res.data.geometry && res.data.geometry.coordinates) {
          // OSRM retourne [lng, lat] dans GeoJSON, Leaflet attend [lat, lng]
          const mappedCoords: [number, number][] = res.data.geometry.coordinates.map(
            (c: [number, number]) => [c[1], c[0]]
          );
          setRouteCoordinates(mappedCoords);
        }
      } catch (err) {
        console.error("Erreur de récupération de l'itinéraire OSRM :", err);
      }
    }
    
    fetchRoute();
  }, [selectedBus, stops]);

  // Chargement initial des arrêts et données de bus depuis l'API REST
  useEffect(() => {
    async function loadData() {
      try {
        const [carsRes, stopsRes] = await Promise.all([
          api.get('/cars').catch(() => ({ data: [] })),
          api.get('/points-recuperation').catch(() => ({ data: [] })),
        ]);
        const cars: any[] = carsRes.data?.data || carsRes.data || [];
        const carMap: Record<string, any> = {};
        cars.forEach((c: any) => { carMap[c.id] = c; });
        setBusDetails(carMap);
        setStops(stopsRes.data?.data || stopsRes.data || []);
      } catch (e) {
        console.warn('Chargement données carte:', e);
      }
    }
    loadData();
  }, []);

  const busArray = Array.from(busPositions.values());
  const totalStudents = busArray.reduce((sum, b) => sum + (b.studentsOnBoard || 0), 0);

  // Anomalies critiques = événements de type 'critical' dans le fil d'activité
  const criticalAnomalies = punchEvents.filter(e => e.punchState === 'critical');
  const latestCritical = criticalAnomalies[0] ?? null;

  return (
    <div
      className="animate-fade-in"
      style={{ height: 'calc(100vh - 116px)', display: 'flex', flexDirection: 'column', gap: '1rem' }}
    >
      {/* ── En-tête ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>
            Centre de Contrôle Temps Réel
          </h1>
          <p style={{ margin: '0.2rem 0 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Suivi GPS instantané via WebSocket — mis à jour en continu.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <StatCard icon={<Bus size={18} />}   label="Bus actifs"   value={activeBusCount}  color="#4f46e5" />
          <StatCard icon={<Users size={18} />} label="Élèves à bord" value={totalStudents}   color="#10b981" />
          <StatCard icon={<Bell size={18} />}  label="Événements"    value={punchEvents.length} color="#f59e0b" />
          <ConnectionBadge status={connectionStatus} onReconnect={reconnect} />
        </div>
      </div>

      {/* ── Bannière d'anomalie critique ── */}
      {latestCritical && (
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          padding: '0.85rem 1.1rem',
          background: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(220,38,38,0.06))',
          border: '1px solid rgba(239,68,68,0.4)',
          borderLeft: '4px solid #ef4444',
          borderRadius: '0.75rem',
          animation: 'slideInEvent 0.35s ease-out',
        }}>
          <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>🚨</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: '#ef4444', fontSize: '0.85rem' }}>
                ANOMALIE CRITIQUE — {latestCritical.terminalSn}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                {new Date(latestCritical.time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.15rem' }}>
              {latestCritical.childName}
            </div>
            {latestCritical.message && (
              <div style={{ fontSize: '0.76rem', color: '#b91c1c', marginTop: '0.15rem', lineHeight: 1.4 }}>
                {latestCritical.message}
              </div>
            )}
          </div>
          {criticalAnomalies.length > 1 && (
            <span style={{
              fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem',
              background: '#ef4444', color: 'white', borderRadius: '999px',
              whiteSpace: 'nowrap', alignSelf: 'center',
            }}>
              +{criticalAnomalies.length - 1}
            </span>
          )}
        </div>
      )}

      {/* ── Corps ── */}
      <div style={{ display: 'flex', gap: '1.25rem', flex: 1, minHeight: 0 }}>

        {/* ── Carte ── */}
        <div
          className="glass-panel"
          style={{ flex: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}
        >
          {/* Légende */}
          <div style={{
            padding: '0.7rem 1rem',
            borderBottom: '1px solid var(--glass-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MapPin size={18} style={{ color: 'var(--accent-primary)' }} />
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Carte en Direct</span>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#4f46e5', display: 'inline-block' }} />
                Bus en route
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#94a3b8', display: 'inline-block' }} />
                Bus vide / stationnaire
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#4f46e5', border: '2px solid white', boxShadow: '0 0 4px rgba(79,70,229,0.5)', display: 'inline-block' }} />
                Arrêt
              </span>
            </div>
          </div>

          <div style={{ flex: 1, zIndex: 0 }}>
            <MapContainer
              center={abidjanCenter}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
              zoomControl={true}
            >
              {/* Tuiles fond de carte (OpenStreetMap) */}
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <MapViewController positions={busArray} />

              {/* Arrêts de récupération */}
              {stops.map((stop: any) => (
                stop.latitude && stop.longitude ? (
                  <Marker
                    key={stop.id}
                    position={[parseFloat(stop.latitude), parseFloat(stop.longitude)]}
                    icon={stopIcon}
                  >
                    <Tooltip direction="top" permanent={false}>
                      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.78rem' }}>
                        <strong>{stop.name || stop.nom}</strong>
                      </div>
                    </Tooltip>
                  </Marker>
                ) : null
              ))}

              {/* Tracé routier réel OSRM */}
              {routeCoordinates.length > 0 && (
                <Polyline
                  positions={routeCoordinates}
                  color="#4f46e5"
                  weight={4}
                  opacity={0.8}
                  dashArray="10, 10"
                />
              )}

              {/* Marqueurs de pointage récents */}
              {punchEvents
                .filter((e) => e.lat && e.lng)
                .slice(0, 15)
                .map((e) => (
                  <Marker key={e.id} position={[e.lat!, e.lng!]} icon={punchStopIcon}>
                    <Tooltip direction="top">
                      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.78rem' }}>
                        <strong>{e.childName}</strong><br />
                        {e.punchState === '0' ? 'Montée' : 'Descente'} — {new Date(e.time).toLocaleTimeString('fr-FR')}
                      </div>
                    </Tooltip>
                  </Marker>
                ))}

              {/* Marqueurs de bus avec animation fluide */}
              {busArray.map((bus) => {
                const detail = Object.values(busDetails).find(
                  (c: any) => c.courseId === bus.courseId || c.id === bus.deviceId,
                ) as any;
                return (
                  <React.Fragment key={bus.courseId}>
                    <AnimatedBusMarker bus={bus} />

                    {/* Infobulle permanente pour le bus sélectionné */}
                    <Marker
                      position={[bus.latitude, bus.longitude]}
                      icon={new L.DivIcon({ className: '', html: '', iconSize: [1, 1] })}
                      eventHandlers={{
                        click: () => setSelectedBus(bus.courseId === selectedBus ? null : bus.courseId),
                      }}
                    >
                      <Popup
                        autoClose={false}
                        closeOnClick={false}
                      >
                        <div style={{
                          fontFamily: 'Inter, sans-serif',
                          minWidth: 200,
                          padding: '0.25rem',
                        }}>
                          {/* En-tête popup */}
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            marginBottom: '0.75rem',
                            paddingBottom: '0.6rem',
                            borderBottom: '1px solid #e2e8f0',
                          }}>
                            <span style={{ fontSize: '1.5rem' }}>🚌</span>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>
                                {bus.plateNumber || detail?.plateNumber || 'Bus inconnu'}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                {bus.courseName || detail?.name || `Course ${bus.courseId?.slice(0, 8)}…`}
                              </div>
                            </div>
                          </div>

                          {/* Infos chauffeur */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                              <User size={13} style={{ color: '#4f46e5', flexShrink: 0 }} />
                              <span style={{ color: '#64748b' }}>Chauffeur :</span>
                              <span style={{ fontWeight: 600, color: '#0f172a' }}>
                                {bus.driverName || detail?.driverName || '—'}
                              </span>
                            </div>

                            {/* Nombre d'élèves */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                              <Users size={13} style={{ color: '#10b981', flexShrink: 0 }} />
                              <span style={{ color: '#64748b' }}>Élèves à bord :</span>
                              <span style={{
                                fontWeight: 700,
                                color: 'white',
                                background: bus.studentsOnBoard ? '#10b981' : '#94a3b8',
                                padding: '0.1rem 0.5rem',
                                borderRadius: '1rem',
                                fontSize: '0.78rem',
                              }}>
                                {bus.studentsOnBoard ?? 0}
                              </span>
                            </div>

                            {/* Vitesse */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                              <Navigation size={13} style={{ color: '#f59e0b', flexShrink: 0 }} />
                              <span style={{ color: '#64748b' }}>Vitesse :</span>
                              <span style={{ fontWeight: 600, color: '#0f172a' }}>{bus.speed || 0} km/h</span>
                            </div>

                            {/* Dernière mise à jour */}
                            <div style={{
                              marginTop: '0.5rem',
                              padding: '0.4rem 0.6rem',
                              background: '#f8fafc',
                              borderRadius: '0.4rem',
                              fontSize: '0.72rem',
                              color: '#64748b',
                              display: 'flex', alignItems: 'center', gap: '0.3rem',
                            }}>
                              <Clock size={11} />
                              Mis à jour : {new Date(bus.timestamp).toLocaleTimeString('fr-FR')}
                            </div>
                          </div>
                        </div>
                      </Popup>

                      {/* Tooltip léger au survol */}
                      <Tooltip direction="top" offset={[0, -24]}>
                        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: 600 }}>
                          {bus.plateNumber || 'Bus'} — {bus.studentsOnBoard ?? 0} élèves
                        </div>
                      </Tooltip>
                    </Marker>
                  </React.Fragment>
                );
              })}
            </MapContainer>

            {/* Overlay si aucun bus en direct */}
            {busArray.length === 0 && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 500,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                background: 'rgba(248,250,252,0.85)',
                backdropFilter: 'blur(4px)',
                pointerEvents: 'none',
              }}>
                <Bus size={48} style={{ color: '#94a3b8', marginBottom: '1rem' }} />
                <p style={{ fontWeight: 600, color: '#64748b', fontSize: '1rem', margin: 0 }}>
                  {connectionStatus === 'connected'
                    ? 'Aucun bus en service actuellement'
                    : 'Connexion WebSocket en cours…'}
                </p>
                <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: '0.4rem' }}>
                  Les positions GPS s'afficheront dès qu'un bus sera actif
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Panneau latéral : Fil d'événements ── */}
        <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 280 }}>
          {/* En-tête */}
          <div style={{
            padding: '0.85rem 1rem',
            borderBottom: '1px solid var(--glass-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={18} style={{ color: '#f59e0b' }} />
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Fil d'Activité</span>
            </div>
            <span style={{
              background: 'rgba(245,158,11,0.15)', color: '#d97706',
              padding: '0.15rem 0.55rem', borderRadius: '1rem',
              fontSize: '0.72rem', fontWeight: 700,
            }}>
              {punchEvents.length} événements
            </span>
          </div>

          {/* Liste des bus actifs */}
          {busArray.length > 0 && (
            <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
              <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Bus en service
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {busArray.map((bus) => {
                  const isSelected = selectedBus === bus.courseId;
                  return (
                    <div
                      key={bus.courseId}
                      onClick={() => setSelectedBus(isSelected ? null : bus.courseId)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.5rem 0.65rem',
                        background: isSelected ? 'rgba(79,70,229,0.15)' : 'rgba(79,70,229,0.06)',
                        border: isSelected ? '2px solid rgba(79,70,229,0.6)' : '1px solid rgba(79,70,229,0.12)',
                        borderRadius: '0.5rem',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%', background: '#10b981',
                        boxShadow: '0 0 6px #10b981', display: 'inline-block',
                        animation: 'statusPulse 2s ease-in-out infinite',
                      }} />
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {bus.plateNumber || `Bus ${bus.courseId?.slice(0, 6)}`}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-secondary)' }}>
                      <Users size={11} />
                      <span style={{ fontWeight: 700, color: '#10b981' }}>{bus.studentsOnBoard ?? 0}</span>
                      <ChevronRight size={11} />
                    </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Flux d'événements */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }} className="custom-scrollbar">
            {punchEvents.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                <Bell size={36} style={{ opacity: 0.2 }} />
                <div>
                  <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Aucun événement</p>
                  <p style={{ fontSize: '0.8rem' }}>Les pointages et alertes apparaîtront ici en temps réel.</p>
                </div>
              </div>
            ) : (
              punchEvents.map((event) => <EventCard key={event.id} event={event} />)
            )}
          </div>
        </div>
      </div>

      {/* Styles CSS injectés */}
      <style>{`
        @keyframes busPulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.15; }
          50%       { transform: translate(-50%, -50%) scale(1.5); opacity: 0.05; }
        }
        @keyframes punchPulse {
          0%   { transform: scale(1);   opacity: 1; }
          100% { transform: scale(3.5); opacity: 0; }
        }
        @keyframes statusPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        @keyframes slideInEvent {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--glass-border); border-radius: 4px; }
        .leaflet-popup-content-wrapper {
          border-radius: 0.75rem !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.12) !important;
          border: 1px solid #e2e8f0 !important;
          padding: 0 !important;
        }
        .leaflet-popup-content { margin: 0.75rem !important; }
        .leaflet-popup-tip-container { display: none; }
        .leaflet-tooltip {
          font-family: 'Inter', sans-serif !important;
          border-radius: 0.4rem !important;
          border: 1px solid #e2e8f0 !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08) !important;
          padding: 0.3rem 0.6rem !important;
        }
      `}</style>
    </div>
  );
}
