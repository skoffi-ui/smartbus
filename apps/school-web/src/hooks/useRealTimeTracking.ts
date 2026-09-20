import { useEffect, useRef, useState, useCallback } from 'react';
import { getSocket, subscribeToCourse, disconnectSocket } from '../services/socket.service';

export interface BusPosition {
  courseId: string;
  deviceId: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading?: number;
  timestamp: string;
  // Données enrichies sur le bus
  plateNumber?: string;
  driverName?: string;
  studentsOnBoard?: number;
  courseName?: string;
  routeName?: string;
}

export interface PunchEvent {
  id: string;
  courseId: string;
  childName: string;
  childId: string;
  terminalSn: string;
  time: string;
  punchState: string; // '0' = montée, '1' = descente
  lat?: number;
  lng?: number;
  message?: string;
}

export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'unauthorized';

interface UseRealTimeTrackingOptions {
  /**
   * Courses à suivre précisément. Si vide, le client reçoit toute l'activité de son
   * école. L'école n'est jamais passée depuis le client : le serveur la déduit du
   * jeton d'authentification fourni à l'ouverture du socket.
   */
  courseIds?: string[];
}

interface UseRealTimeTrackingReturn {
  busPositions: Map<string, BusPosition>;
  punchEvents: PunchEvent[];
  connectionStatus: ConnectionStatus;
  activeBusCount: number;
  reconnect: () => void;
}

export function useRealTimeTracking({
  courseIds = [],
}: UseRealTimeTrackingOptions = {}): UseRealTimeTrackingReturn {
  const [busPositions, setBusPositions] = useState<Map<string, BusPosition>>(new Map());
  const [punchEvents, setPunchEvents] = useState<PunchEvent[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const socketRef = useRef(getSocket());

  const subscribeToRooms = useCallback(() => {
    // Sans courseIds, aucun abonnement supplémentaire n'est requis : le serveur
    // rattache déjà le client à toute l'activité de son école dès la connexion.
    courseIds.forEach((courseId) => subscribeToCourse(courseId));
  }, [courseIds]);

  const reconnect = useCallback(() => {
    disconnectSocket();
    socketRef.current = getSocket();
    setupListeners();
    setConnectionStatus('connecting');
  }, []);

  function setupListeners() {
    const socket = socketRef.current;

    socket.on('connect', () => {
      setConnectionStatus('connected');
      subscribeToRooms();
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    socket.on('connect_error', () => {
      setConnectionStatus('error');
    });

    // Le serveur confirme l'école déduite du jeton : la session est utilisable.
    socket.on('connected', () => {
      setConnectionStatus('connected');
      subscribeToRooms();
    });

    // Jeton absent, invalide, ou compte sans école : le serveur ferme la connexion.
    socket.on('unauthorized', () => {
      setConnectionStatus('unauthorized');
    });

    // Événement GPS : mise à jour de la position du bus.
    // Le nom doit correspondre exactement à celui émis par la passerelle
    // (HardwareStreamGateway.broadcast), sinon aucune position n'arrive.
    socket.on('gps', (payload: BusPosition) => {
      setBusPositions((prev) => {
        const next = new Map(prev);
        next.set(payload.courseId, {
          ...payload,
          latitude: payload.latitude,
          longitude: payload.longitude,
        });
        return next;
      });
    });

    // Événement de pointage biométrique
    socket.on('punch', (payload: PunchEvent) => {
      setPunchEvents((prev) => [payload, ...prev].slice(0, 50)); // Garde les 50 derniers
    });

    // Alerte de proximité
    socket.on('proximity_alert', (payload: any) => {
      setPunchEvents((prev) => [
        {
          id: `prox-${Date.now()}`,
          courseId: payload.courseId,
          childName: payload.childName,
          childId: payload.childId,
          terminalSn: 'GPS',
          time: new Date().toISOString(),
          punchState: 'proximity',
          lat: payload.busLat,
          lng: payload.busLng,
        },
        ...prev,
      ].slice(0, 50));
    });

    // Anomalie critique de pointage
    socket.on('critical_anomaly', (payload: any) => {
      setPunchEvents((prev) => [
        {
          id: `crit-${Date.now()}`,
          courseId: payload.detectedCourseId || 'default-course',
          childName: payload.childName,
          childId: payload.childId,
          terminalSn: payload.detectedCarPlate || 'Bus',
          time: payload.time || new Date().toISOString(),
          punchState: 'critical',
          message: payload.message,
          lat: payload.lat,
          lng: payload.lng,
        },
        ...prev,
      ].slice(0, 50));
    });
  }

  useEffect(() => {
    setupListeners();
    return () => {
      const socket = socketRef.current;
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('connected');
      socket.off('unauthorized');
      socket.off('gps');
      socket.off('punch');
      socket.off('proximity_alert');
      socket.off('critical_anomaly');
    };
  }, []);

  return {
    busPositions,
    punchEvents,
    connectionStatus,
    activeBusCount: busPositions.size,
    reconnect,
  };
}
