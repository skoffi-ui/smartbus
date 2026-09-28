import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckCircle,
  Clock,
  Phone,
  MapPin,
  Bus,
  User,
  FileText,
  Shield,
  Zap,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Navigation,
} from 'lucide-react';
import { socketService } from '../services/socket.service';
import api from '../services/api';
import { aAcces } from '../constants/schoolFeatures';

// ──────────────────────────────────────────────────────────────────────────────
// Fix leaflet icon default
// ──────────────────────────────────────────────────────────────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const dangerIcon = new L.DivIcon({
  className: '',
  html: `<div style="
    width: 28px; height: 28px;
    background: #ef4444;
    border-radius: 50%;
    border: 3px solid white;
    box-shadow: 0 0 0 4px rgba(239,68,68,0.35), 0 4px 12px rgba(239,68,68,0.5);
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; animation: criticalPing 1.2s ease-in-out infinite;
  ">🚨</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────
interface CriticalAnomaly {
  id: string;
  type: string;
  severity: string;
  message: string;
  childId: string;
  childName: string;
  childEmpCode?: string;
  detectedCarPlate?: string;
  terminalSn?: string;
  detectedCourseId?: string;
  driverId?: string;
  expectedCourseId?: string;
  expectedStopName?: string;
  punchTime: string;
  time?: string;
  lat?: number;
  lng?: number;
  resolved?: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
  createdAt?: string;
  // Extended local fields
  _resolving?: boolean;
  _expanded?: boolean;
}

/**
 * Alerte de proximité : un bus qui approche de l'arrêt d'un élève — bénin,
 * jamais à résoudre, distinct d'une anomalie critique de badgeage. Fusionné
 * ici depuis l'ancien écran « Alertes Transport » (`GET /montees/alertes`),
 * qui ne contenait plus que ce type d'alerte depuis le retrait de la
 * validation des montées.
 */
interface ProximiteAlerte {
  id: string;
  type?: string;
  date?: string;
  heure?: string;
  createdAt?: string;
  child?: { firstName?: string; lastName?: string };
  course?: { nom?: string };
  car?: { plateNumber?: string };
  // Champs du direct (voir hardware-stream.service.ts, événement `proximity_alert`)
  childName?: string;
  stopName?: string;
  distance?: number;
  time?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  MAUVAIS_CAR: { label: 'Mauvais Véhicule', icon: '🚌', color: '#ef4444' },
  MAUVAIS_ARRET: { label: 'Mauvais Arrêt', icon: '📍', color: '#f59e0b' },
  ENFANT_NON_AFFECTE: { label: 'Élève Non Affecté', icon: '👤', color: '#8b5cf6' },
  COURSE_INACTIVE: { label: 'Course Inactive', icon: '⛔', color: '#6b7280' },
  CAR_INCONNU: { label: 'Badgeuse Inconnue', icon: '❓', color: '#ef4444' },
};

// ──────────────────────────────────────────────────────────────────────────────
// Sous-composant : Carte GPS de détail
// ──────────────────────────────────────────────────────────────────────────────
function MiniMap({ lat, lng, plateNumber }: { lat: number; lng: number; plateNumber: string }) {
  return (
    <div style={{ borderRadius: '0.75rem', overflow: 'hidden', height: 200, border: '1px solid rgba(239,68,68,0.25)' }}>
      <MapContainer
        center={[lat, lng]}
        zoom={15}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={[lat, lng]} icon={dangerIcon}>
          <Popup>{plateNumber} — Position lors de l'anomalie</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Sous-composant : Fiche d'anomalie
// ──────────────────────────────────────────────────────────────────────────────
function AnomalyCard({
  anomaly,
  drivers,
  onResolve,
  onExpand,
}: {
  anomaly: CriticalAnomaly;
  drivers: Record<string, any>;
  onResolve: (id: string, note: string) => void;
  onExpand: (id: string) => void;
}) {
  const [noteText, setNoteText] = useState('');
  const [showNote, setShowNote] = useState(false);
  const cfg = TYPE_CONFIG[anomaly.type] ?? { label: anomaly.type, icon: '⚠️', color: '#f59e0b' };

  const punchDate = new Date(anomaly.punchTime || anomaly.time || anomaly.createdAt || Date.now());
  const elapsed = Math.floor((Date.now() - punchDate.getTime()) / 1000);
  const elapsedStr = elapsed < 60 ? `${elapsed}s` : elapsed < 3600 ? `${Math.floor(elapsed / 60)}min` : `${Math.floor(elapsed / 3600)}h`;

  // Chauffeur de la course détectée (voir AlertesCritiquesService.getUnresolved
  // et l'émission live dans hardware-stream.service.ts, qui fournissent
  // maintenant `driverId`). Avant ce correctif, on tentait de faire
  // correspondre `detectedCarPlate` à un champ `plateNumber` inexistant sur
  // `Driver` — ce panneau ne pouvait donc jamais s'afficher, pour aucune
  // anomalie. `drivers` (déjà chargé via GET /drivers) est indexé par id.
  const driver = anomaly.driverId ? drivers[anomaly.driverId] : undefined;

  return (
    <div
      className={anomaly.resolved ? '' : 'anomaly-card-active'}
      style={{
        borderRadius: '0.875rem',
        border: `1.5px solid ${anomaly.resolved ? 'rgba(16,185,129,0.3)' : `${cfg.color}55`}`,
        background: anomaly.resolved
          ? 'rgba(16,185,129,0.04)'
          : `linear-gradient(135deg, ${cfg.color}08, ${cfg.color}03)`,
        overflow: 'hidden',
        transition: 'all 0.25s ease',
      }}
    >
      {/* Header */}
      <div
        onClick={() => onExpand(anomaly.id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.9rem 1rem',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {/* Severity dot + icon */}
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: anomaly.resolved ? 'rgba(16,185,129,0.12)' : `${cfg.color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.2rem', flexShrink: 0,
          position: 'relative',
        }}>
          {cfg.icon}
          {!anomaly.resolved && (
            <span style={{
              position: 'absolute', top: 0, right: 0,
              width: 10, height: 10, borderRadius: '50%',
              background: cfg.color, border: '2px solid white',
              animation: 'criticalPing 1.2s ease-in-out infinite',
            }} />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.55rem',
              borderRadius: '999px', background: anomaly.resolved ? '#10b981' : cfg.color,
              color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {anomaly.resolved ? '✓ Résolu' : cfg.label}
            </span>
            {anomaly.severity === 'CRITICAL' && !anomaly.resolved && (
              <span style={{
                fontSize: '0.65rem', fontWeight: 800, padding: '0.1rem 0.45rem',
                borderRadius: '999px', background: 'rgba(239,68,68,0.1)',
                color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)',
                letterSpacing: '0.08em',
              }}>⚡ CRITIQUE</span>
            )}
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: '0.2rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {anomaly.childName}
          </div>
          {anomaly.detectedCarPlate && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.1rem' }}>
              <Bus size={11} /> {anomaly.detectedCarPlate}
              {anomaly.expectedStopName && <><span>·</span><MapPin size={11} /> {anomaly.expectedStopName}</>}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem', flexShrink: 0 }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <Clock size={9} /> {elapsedStr}
          </span>
          {anomaly._expanded ? <ChevronUp size={14} color="var(--text-secondary)" /> : <ChevronDown size={14} color="var(--text-secondary)" />}
        </div>
      </div>

      {/* Expanded detail panel */}
      {anomaly._expanded && (
        <div style={{ padding: '0 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Message */}
          <div style={{
            padding: '0.65rem 0.85rem',
            background: `${cfg.color}0d`,
            borderRadius: '0.5rem',
            fontSize: '0.8rem',
            color: 'var(--text-primary)',
            lineHeight: 1.5,
            borderLeft: `3px solid ${cfg.color}`,
          }}>
            {anomaly.message}
          </div>

          {/* GPS mini-map */}
          {anomaly.lat && anomaly.lng && (
            <div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <MapPin size={11} /> Position GPS du bus au moment de l'anomalie
              </p>
              <MiniMap lat={anomaly.lat} lng={anomaly.lng} plateNumber={anomaly.detectedCarPlate ?? 'Bus'} />
            </div>
          )}

          {/* Driver info + Call button */}
          {driver && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.7rem 0.85rem',
              background: 'rgba(79,70,229,0.05)',
              borderRadius: '0.5rem',
              border: '1px solid rgba(79,70,229,0.15)',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'var(--accent-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', flexShrink: 0,
              }}>
                <User size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                  {driver.firstName || driver.lastName ? `${driver.firstName ?? ''} ${driver.lastName ?? ''}`.trim() : 'Chauffeur'}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{driver.phone ?? 'Tél. inconnu'}</div>
              </div>
              {driver.phone && (
                <a
                  href={`tel:${driver.phone}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.5rem 0.9rem', borderRadius: '2rem',
                    background: 'var(--accent-primary)', color: 'white',
                    fontWeight: 700, fontSize: '0.8rem', textDecoration: 'none',
                    boxShadow: '0 2px 8px rgba(79,70,229,0.35)',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent-primary)')}
                >
                  <Phone size={13} /> Appeler
                </a>
              )}
            </div>
          )}

          {/* Resolve action */}
          {!anomaly.resolved && (
            <div>
              {!showNote ? (
                <button
                  onClick={() => setShowNote(true)}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '0.5rem',
                    background: 'rgba(16,185,129,0.08)',
                    border: '1px solid rgba(16,185,129,0.3)',
                    color: '#10b981',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(16,185,129,0.15)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(16,185,129,0.08)')}
                >
                  <CheckCircle size={15} /> Marquer comme Résolue
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <FileText size={11} /> Note de suivi (optionnelle)
                  </label>
                  <textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Ex: Élève récupéré par le chauffeur, ramené à son arrêt..."
                    rows={3}
                    style={{
                      width: '100%', padding: '0.6rem 0.75rem',
                      borderRadius: '0.5rem', border: '1px solid var(--glass-border)',
                      fontFamily: 'var(--font-sans)', fontSize: '0.82rem',
                      color: 'var(--text-primary)', background: 'rgba(255,255,255,0.8)',
                      resize: 'vertical', outline: 'none',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => { onResolve(anomaly.id, noteText); setShowNote(false); }}
                      disabled={anomaly._resolving}
                      style={{
                        flex: 1, padding: '0.55rem',
                        borderRadius: '0.5rem',
                        background: anomaly._resolving ? '#9ca3af' : '#10b981',
                        border: 'none', color: 'white', fontWeight: 700,
                        fontSize: '0.82rem', cursor: anomaly._resolving ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
                      }}
                    >
                      {anomaly._resolving ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Envoi...</> : <><CheckCircle size={13} /> Confirmer</>}
                    </button>
                    <button
                      onClick={() => setShowNote(false)}
                      style={{
                        padding: '0.55rem 0.9rem', borderRadius: '0.5rem',
                        background: 'rgba(100,116,139,0.1)', border: 'none',
                        color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
                      }}
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {anomaly.resolved && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 0.75rem',
              background: 'rgba(16,185,129,0.08)',
              borderRadius: '0.5rem',
              color: '#10b981',
              fontSize: '0.78rem',
              fontWeight: 600,
            }}>
              <CheckCircle size={14} /> Anomalie résolue
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Sous-composant : Fiche de proximité (bénin, jamais à résoudre)
// ──────────────────────────────────────────────────────────────────────────────
function ProximityCard({ alerte }: { alerte: ProximiteAlerte }) {
  const nomEnfant =
    alerte.childName ??
    (alerte.child ? `${alerte.child.firstName ?? ''} ${alerte.child.lastName ?? ''}`.trim() : '') ??
    'Élève';
  const heure = alerte.time ?? alerte.createdAt ?? alerte.date;

  return (
    <div
      style={{
        borderRadius: '0.875rem',
        border: '1.5px solid rgba(245,158,11,0.3)',
        background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(245,158,11,0.02))',
        padding: '0.75rem 1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Navigation size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
          {nomEnfant || 'Élève'} {alerte.stopName ? `— ${alerte.stopName}` : ''}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          Bus à proximité de l'arrêt
          {typeof alerte.distance === 'number' && <span>· {alerte.distance} km</span>}
          {alerte.car?.plateNumber && <span className="flex items-center gap-1"><Bus size={10} />{alerte.car.plateNumber}</span>}
        </div>
      </div>
      {heure && (
        <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.2rem', flexShrink: 0 }}>
          <Clock size={9} /> {new Date(heure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Composant principal — Alertes (Centre d'Alertes + Alertes de proximité, fusionnés)
// ──────────────────────────────────────────────────────────────────────────────
export default function CentreAlertes() {
  const [anomalies, setAnomalies] = useState<CriticalAnomaly[]>([]);
  const [historique, setHistorique] = useState<CriticalAnomaly[]>([]);
  const [proximiteAlertes, setProximiteAlertes] = useState<ProximiteAlerte[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'resolved' | 'all'>('active');
  const [drivers, setDrivers] = useState<Record<string, any>>({});
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Une école peut n'avoir accès qu'à l'une des deux fonctionnalités
  // fusionnées ici (voir App.tsx, PageProtegee) — n'afficher/charger que ce
  // qu'elle a réellement le droit de voir.
  const accesCritiques = aAcces('centre-alertes');
  const accesProximite = aAcces('alertes');
  const [categorie, setCategorie] = useState<'toutes' | 'critiques' | 'proximite'>(
    accesCritiques ? 'toutes' : 'proximite',
  );

  // Extract tenant from JWT
  const tenantId = (() => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return '';
      const p = JSON.parse(atob(token.split('.')[1]));
      return p.organisationId || p.tenantId || p.sub || '';
    } catch { return ''; }
  })();

  // ── Audio Alert (Web Audio API — no external file needed) ─────────────────
  const playAlert = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      // Three short descending beeps
      const sequence = [880, 660, 440];
      sequence.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.15);
        gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i * 0.15 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.13);
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.15);
      });
    } catch { /* silent fail */ }
  }, [soundEnabled]);

  // ── Load initial data ────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchInitial() {
      setLoading(true);
      try {
        // `statut=all` : sans ça, seules les anomalies NON résolues étaient
        // renvoyées, et les onglets « Résolues »/« Toutes » ne montraient
        // que ce qui avait été résolu depuis l'ouverture de cette page —
        // tout disparaissait au rechargement.
        const [alertsRes, driversRes, proximiteRes] = await Promise.all([
          accesCritiques ? api.get('/alertes-critiques?limit=100&statut=all').catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
          accesCritiques ? api.get('/drivers').catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
          accesProximite ? api.get('/montees/alertes').catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        ]);

        const alertList: CriticalAnomaly[] = Array.isArray(alertsRes.data)
          ? alertsRes.data
          : alertsRes.data?.data ?? [];

        setHistorique(alertList);

        const driverList: any[] = Array.isArray(driversRes.data)
          ? driversRes.data
          : driversRes.data?.data ?? [];

        const driverMap: Record<string, any> = {};
        driverList.forEach(d => { driverMap[d.id] = d; });
        setDrivers(driverMap);

        setProximiteAlertes(Array.isArray(proximiteRes.data) ? proximiteRes.data : []);
      } catch (e) {
        console.warn('Erreur chargement alertes critiques :', e);
      } finally {
        setLoading(false);
      }
    }
    fetchInitial();
  }, [accesCritiques, accesProximite]);

  // ── WebSocket subscription ────────────────────────────────────────────────
  useEffect(() => {
    const socket = socketService.connect();

    // Join tenant-wide room
    if (tenantId) {
      socket.emit('subscribe', { tenantId, courseId: '*' });
    }

    socket.on('critical_anomaly', (payload: any) => {
      const incoming: CriticalAnomaly = {
        // `payload.id` est maintenant le vrai id BDD de l'AlerteCritique
        // déjà enregistrée (voir hardware-stream.service.ts) — un id
        // synthétique ici rendait "Marquer comme résolue" muet pour toute
        // alerte reçue en direct : l'écran l'affichait résolue localement,
        // mais l'appel à PATCH /alertes-critiques/:id/resolve n'avait
        // jamais lieu, donc elle réapparaissait non résolue au rechargement.
        id: payload.id ?? `live-${Date.now()}-${Math.random()}`,
        type: payload.type ?? 'MAUVAIS_CAR',
        severity: payload.severity ?? 'HIGH',
        message: payload.message ?? 'Anomalie détectée',
        childId: payload.childId ?? '',
        childName: payload.childName ?? 'Élève inconnu',
        childEmpCode: payload.childEmpCode,
        detectedCarPlate: payload.detectedCarPlate,
        terminalSn: payload.terminalSn,
        detectedCourseId: payload.detectedCourseId,
        driverId: payload.driverId,
        expectedCourseId: payload.expectedCourseId,
        expectedStopName: payload.expectedStopName,
        punchTime: payload.time ?? new Date().toISOString(),
        lat: payload.lat,
        lng: payload.lng,
        resolved: false,
        _expanded: true, // auto-expand new alerts
      };

      setAnomalies(prev => [incoming, ...prev].slice(0, 50));
      playAlert();

      // Flash page title
      let count = 0;
      const originalTitle = document.title;
      const titleInterval = setInterval(() => {
        document.title = count % 2 === 0 ? '🚨 ANOMALIE CRITIQUE !' : originalTitle;
        if (++count >= 10) {
          clearInterval(titleInterval);
          document.title = originalTitle;
        }
      }, 700);
    });

    // Alerte de proximité — bénigne, jamais sonore, jamais de clignotement
    // de l'onglet (contrairement à une anomalie critique).
    socket.on('proximity_alert', (payload: any) => {
      const incoming: ProximiteAlerte = {
        id: `prox-${Date.now()}-${Math.random()}`,
        childName: payload.childName,
        stopName: payload.stopName,
        distance: payload.distance,
        time: payload.time ?? new Date().toISOString(),
      };
      setProximiteAlertes(prev => [incoming, ...prev].slice(0, 50));
    });

    return () => {
      socket.off('critical_anomaly');
      socket.off('proximity_alert');
    };
  }, [tenantId, playAlert]);

  // ── Resolve handler ───────────────────────────────────────────────────────
  const handleResolve = useCallback(async (id: string, note: string) => {
    // Mark as resolving in local state
    const setResolvingState = (resolving: boolean) => {
      setAnomalies(prev => prev.map(a => a.id === id ? { ...a, _resolving: resolving } : a));
      setHistorique(prev => prev.map(a => a.id === id ? { ...a, _resolving: resolving } : a));
    };

    setResolvingState(true);

    try {
      // Only call API for persisted anomalies (ids from DB are UUIDs)
      const isDbId = /^[0-9a-f-]{36}$/.test(id);
      if (isDbId) {
        await api.patch(`/alertes-critiques/${id}/resolve`, { note });
      }

      // Mark resolved locally
      const markResolved = (a: CriticalAnomaly) =>
        a.id === id ? { ...a, resolved: true, _resolving: false, _expanded: false } : a;
      setAnomalies(prev => prev.map(markResolved));
      setHistorique(prev => prev.map(markResolved));
    } catch (e) {
      console.error('Résolution échouée :', e);
      setResolvingState(false);
    }
  }, []);

  // ── Expand toggle ─────────────────────────────────────────────────────────
  const handleExpand = useCallback((id: string) => {
    const toggle = (a: CriticalAnomaly) => a.id === id ? { ...a, _expanded: !a._expanded } : a;
    setAnomalies(prev => prev.map(toggle));
    setHistorique(prev => prev.map(toggle));
  }, []);

  // ── Derived lists ─────────────────────────────────────────────────────────
  const allAnomalies = [
    ...anomalies,
    ...historique.filter(h => !anomalies.some(a => a.id === h.id)),
  ];

  const displayedAnomalies = allAnomalies.filter(a => {
    if (filter === 'active') return !a.resolved;
    if (filter === 'resolved') return a.resolved;
    return true;
  });

  const unresolvedCount = allAnomalies.filter(a => !a.resolved).length;

  // ── Stats ─────────────────────────────────────────────────────────────────
  const criticalCount = allAnomalies.filter(a => !a.resolved && a.severity === 'CRITICAL').length;
  const resolvedCount = allAnomalies.filter(a => a.resolved).length;

  return (
    <div className="animate-fade-in" style={{ padding: '0 0 2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── CSS animations ─────────────────────────────────────────────────── */}
      <style>{`
        @keyframes criticalPing {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.6); }
          50% { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
        }
        @keyframes criticalBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .anomaly-card-active {
          animation: criticalBlink 2.5s ease-in-out 3;
        }
        .anomaly-card-active:hover {
          animation: none !important;
        }
        .tab-btn { transition: all 0.2s ease; }
        .tab-btn:hover { background: rgba(79,70,229,0.08) !important; }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '0.6rem',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(239,68,68,0.35)',
            }}>
              <Shield size={18} color="white" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>Alertes</h1>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {accesCritiques && accesProximite
                  ? 'Anomalies de badgeage et proximité des bus, en temps réel'
                  : accesCritiques
                  ? "Détection d'anomalies de badgeage en temps réel"
                  : 'Bus approchant des arrêts, en temps réel'}
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Sound toggle */}
          <button
            onClick={() => setSoundEnabled(prev => !prev)}
            title={soundEnabled ? 'Désactiver le son' : 'Activer le son'}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.45rem 0.85rem', borderRadius: '2rem',
              background: soundEnabled ? 'rgba(79,70,229,0.1)' : 'rgba(100,116,139,0.1)',
              border: `1px solid ${soundEnabled ? 'rgba(79,70,229,0.25)' : 'rgba(100,116,139,0.2)'}`,
              color: soundEnabled ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer',
            }}
          >
            {soundEnabled ? <Bell size={14} /> : <BellOff size={14} />}
            {soundEnabled ? 'Son activé' : 'Son coupé'}
          </button>

          {/* Unresolved badge */}
          {accesCritiques && unresolvedCount > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.45rem 0.9rem', borderRadius: '2rem',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#ef4444', fontWeight: 700, fontSize: '0.8rem',
              animation: 'criticalBlink 2s ease-in-out infinite',
            }}>
              <Zap size={13} />
              {unresolvedCount} alerte{unresolvedCount > 1 ? 's' : ''} active{unresolvedCount > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* ── Stats cards ────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
        {[
          ...(accesCritiques ? [
            { label: 'Alertes Actives', value: unresolvedCount, color: '#ef4444', icon: <AlertTriangle size={18} /> },
            { label: '⚡ Critiques', value: criticalCount, color: '#dc2626', icon: <Zap size={18} /> },
            { label: 'Résolues', value: resolvedCount, color: '#10b981', icon: <CheckCircle size={18} /> },
          ] : []),
          ...(accesProximite ? [
            { label: 'Proximité', value: proximiteAlertes.length, color: '#f59e0b', icon: <Navigation size={18} /> },
          ] : []),
          { label: 'Total', value: allAnomalies.length + (accesProximite ? proximiteAlertes.length : 0), color: '#64748b', icon: <FileText size={18} /> },
        ].map(stat => (
          <div key={stat.label} className="glass-panel" style={{ padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
            <div style={{
              padding: '0.5rem', borderRadius: '0.5rem',
              background: `${stat.color}15`, color: stat.color,
            }}>
              {stat.icon}
            </div>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: stat.value > 0 && stat.color !== '#64748b' && stat.color !== '#10b981' ? stat.color : 'var(--text-primary)', lineHeight: 1 }}>
                {stat.value}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Sélecteur de catégorie (seulement si les 2 sont accessibles) ────── */}
      {accesCritiques && accesProximite && (
        <div style={{ display: 'flex', gap: '0.4rem', background: 'rgba(241,245,249,0.7)', padding: '0.3rem', borderRadius: '0.75rem', width: 'fit-content', border: '1px solid var(--glass-border)' }}>
          {([
            { key: 'toutes', label: 'Toutes' },
            { key: 'critiques', label: `Anomalies critiques (${unresolvedCount})` },
            { key: 'proximite', label: `Proximité (${proximiteAlertes.length})` },
          ] as const).map(tab => (
            <button
              key={tab.key}
              className="tab-btn"
              onClick={() => setCategorie(tab.key)}
              style={{
                padding: '0.4rem 0.9rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: categorie === tab.key ? 'white' : 'transparent',
                color: categorie === tab.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: categorie === tab.key ? 700 : 500,
                fontSize: '0.8rem',
                cursor: 'pointer',
                boxShadow: categorie === tab.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Filter tabs (uniquement pertinent pour les anomalies critiques) ── */}
      {accesCritiques && categorie !== 'proximite' && (
        <div style={{ display: 'flex', gap: '0.4rem', background: 'rgba(241,245,249,0.7)', padding: '0.3rem', borderRadius: '0.75rem', width: 'fit-content', border: '1px solid var(--glass-border)' }}>
          {([
            { key: 'active', label: `Actives (${unresolvedCount})` },
            { key: 'resolved', label: `Résolues (${resolvedCount})` },
            { key: 'all', label: `Toutes (${allAnomalies.length})` },
          ] as const).map(tab => (
            <button
              key={tab.key}
              className="tab-btn"
              onClick={() => setFilter(tab.key)}
              style={{
                padding: '0.4rem 0.9rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: filter === tab.key ? 'white' : 'transparent',
                color: filter === tab.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: filter === tab.key ? 700 : 500,
                fontSize: '0.8rem',
                cursor: 'pointer',
                boxShadow: filter === tab.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Liste des anomalies critiques ─────────────────────────────────── */}
      {accesCritiques && categorie !== 'proximite' && (
        <div className="glass-panel" style={{ padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: '0.5rem', display: 'block', margin: '0 auto 0.5rem' }} />
              Chargement des alertes…
            </div>
          )}

          {!loading && displayedAnomalies.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>
                {filter === 'resolved' ? '✅' : '🟢'}
              </div>
              <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.3rem' }}>
                {filter === 'active' ? 'Aucune anomalie active' : filter === 'resolved' ? 'Aucune anomalie résolue' : 'Aucune anomalie enregistrée'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {filter === 'active' ? 'Tous les badgeages sont conformes. Le système surveille en temps réel.' : 'Les résultats apparaîtront ici.'}
              </div>
            </div>
          )}

          {!loading && displayedAnomalies.map(anomaly => (
            <AnomalyCard
              key={anomaly.id}
              anomaly={anomaly}
              drivers={drivers}
              onResolve={handleResolve}
              onExpand={handleExpand}
            />
          ))}
        </div>
      )}

      {/* ── Liste des alertes de proximité ───────────────────────────────── */}
      {accesProximite && categorie !== 'critiques' && (
        <div className="glass-panel" style={{ padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {!loading && proximiteAlertes.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🟢</div>
              <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.3rem' }}>Aucune alerte de proximité</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Une entrée apparaît ici lorsqu'un bus approche de l'arrêt d'un élève.
              </div>
            </div>
          )}
          {proximiteAlertes.map((alerte, idx) => (
            <ProximityCard key={alerte.id ?? idx} alerte={alerte} />
          ))}
        </div>
      )}
    </div>
  );
}
