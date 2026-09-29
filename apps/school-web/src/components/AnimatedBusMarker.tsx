import React, { useEffect, useRef } from 'react';
import { Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { User, Users, Navigation, Clock, Wifi, WifiOff } from 'lucide-react';
import type { BusPosition } from '../hooks/useRealTimeTracking';

// Icône SVG bus personnalisée (couleur indigo)
function createBusIcon(heading: number = 0, studentsOnBoard: number = 0, enLigne: boolean = true): L.DivIcon {
  const isLoaded = studentsOnBoard > 0;
  const color = isLoaded ? '#4f46e5' : '#94a3b8';
  // Hors ligne : dernière position connue, mais plus mise à jour depuis un
  // moment (voir `estEnLigne`) — estompé, sans pulsation, pour ne pas le
  // confondre visuellement avec un bus réellement suivi en ce moment.
  const opacite = enLigne ? 1 : 0.4;
  const pulse = isLoaded && enLigne ? `
    <div style="
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: ${color};
      opacity: 0.15;
      animation: busPulse 2s ease-in-out infinite;
    "></div>
  ` : '';

  return new L.DivIcon({
    className: '',
    html: `
      <div style="position: relative; width: 44px; height: 44px; opacity: ${opacite}; transition: opacity 0.4s ease;">
        ${pulse}
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(${heading}deg);
          width: 40px;
          height: 40px;
          background: ${color};
          border-radius: 50% 50% 50% 0;
          transform-origin: center;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
          border: 3px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          transition: background 0.3s ease;
        ">
          <span style="transform: rotate(${-heading}deg); display: block; line-height: 1;">🚌</span>
        </div>
        ${!enLigne ? `
          <div style="
            position: absolute;
            bottom: -2px;
            left: -2px;
            background: #64748b;
            color: white;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 9px;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          ">📡</div>
        ` : ''}
        ${studentsOnBoard > 0 ? `
          <div style="
            position: absolute;
            top: -4px;
            right: -4px;
            background: #10b981;
            color: white;
            font-size: 10px;
            font-weight: 700;
            font-family: Inter, sans-serif;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          ">${studentsOnBoard > 99 ? '99+' : studentsOnBoard}</div>
        ` : ''}
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  });
}

interface AnimatedBusMarkerProps {
  bus: BusPosition;
  /** Position fraîche (voir `estEnLigne`) — change l'apparence du marqueur. */
  enLigne?: boolean;
  /** Détails véhicule (immatriculation, chauffeur…) chargés via /cars. */
  detail?: any;
  /** Appelé au clic sur le bus, pour sélectionner sa course dans le parent. */
  onSelect?: () => void;
}

/**
 * Marqueur de bus qui interpole fluidement sa position
 * via requestAnimationFrame pour éviter les sauts brusques.
 */
const AnimatedBusMarker: React.FC<AnimatedBusMarkerProps> = ({ bus, enLigne = true, detail, onSelect }) => {
  const markerRef = useRef<L.Marker | null>(null);
  const prevPositionRef = useRef<[number, number]>([bus.latitude, bus.longitude]);
  const animationRef = useRef<number | null>(null);


  // Animation fluide de déplacement de A → B
  function animateToPosition(
    marker: L.Marker,
    from: [number, number],
    to: [number, number],
    duration = 1200,
  ) {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Easing: ease-in-out cubic
      const eased = progress < 0.5
        ? 4 * progress ** 3
        : 1 - (-2 * progress + 2) ** 3 / 2;

      const lat = from[0] + (to[0] - from[0]) * eased;
      const lng = from[1] + (to[1] - from[1]) * eased;
      marker.setLatLng([lat, lng]);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(tick);
      } else {
        prevPositionRef.current = to;
      }
    }
    animationRef.current = requestAnimationFrame(tick);
  }

  // Mise à jour de la position lorsque les coordonnées changent
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    const newPos: [number, number] = [bus.latitude, bus.longitude];
    const prev = prevPositionRef.current;

    // Ignore les positions inchangées (même coordonnées)
    if (prev[0] === newPos[0] && prev[1] === newPos[1]) return;

    animateToPosition(marker, prev, newPos);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [bus.latitude, bus.longitude]);

  const icon = createBusIcon(bus.heading || 0, bus.studentsOnBoard || 0, enLigne);

  return (
    <Marker
      ref={markerRef}
      position={[bus.latitude, bus.longitude]}
      icon={icon}
      eventHandlers={onSelect ? { click: onSelect } : undefined}
    >
      <Popup autoClose={false} closeOnClick={false}>
        <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 200, padding: '0.25rem' }}>
          {/* En-tête popup */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            marginBottom: '0.75rem',
            paddingBottom: '0.6rem',
            borderBottom: '1px solid #e2e8f0',
          }}>
            <span style={{ fontSize: '1.5rem' }}>🚌</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>
                {bus.plateNumber || detail?.plateNumber || 'Bus inconnu'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {bus.courseName || detail?.name || `Course ${bus.courseId?.slice(0, 8)}…`}
              </div>
            </div>
            <span style={{
              display: 'flex', alignItems: 'center', gap: '0.25rem',
              padding: '0.15rem 0.5rem', borderRadius: '1rem',
              fontSize: '0.68rem', fontWeight: 700,
              color: enLigne ? '#10b981' : '#64748b',
              background: enLigne ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.12)',
            }}>
              {enLigne ? <Wifi size={11} /> : <WifiOff size={11} />}
              {enLigne ? 'En ligne' : 'Hors ligne'}
            </span>
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
              background: enLigne ? '#f8fafc' : 'rgba(100,116,139,0.1)',
              borderRadius: '0.4rem',
              fontSize: '0.72rem',
              color: enLigne ? '#64748b' : '#475569',
              display: 'flex', alignItems: 'center', gap: '0.3rem',
              fontWeight: enLigne ? 400 : 600,
            }}>
              <Clock size={11} />
              {enLigne
                ? `Mis à jour : ${new Date(bus.timestamp).toLocaleTimeString('fr-FR')}`
                : `Hors ligne depuis ${new Date(bus.timestamp).toLocaleTimeString('fr-FR')} — aucune nouvelle position`}
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
  );
};

export default AnimatedBusMarker;
