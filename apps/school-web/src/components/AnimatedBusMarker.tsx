import React, { useEffect, useRef } from 'react';
import { Marker } from 'react-leaflet';
import L from 'leaflet';
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
}

/**
 * Marqueur de bus qui interpole fluidement sa position
 * via requestAnimationFrame pour éviter les sauts brusques.
 */
const AnimatedBusMarker: React.FC<AnimatedBusMarkerProps> = ({ bus, enLigne = true }) => {
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
    >
      {/* Le Popup est géré par le composant parent via Tooltip */}
    </Marker>
  );
};

export default AnimatedBusMarker;
