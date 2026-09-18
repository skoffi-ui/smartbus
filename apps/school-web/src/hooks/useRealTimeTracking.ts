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

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseRealTimeTrackingOptions {
  tenantId: string;
  courseIds?: string[]; // Si vide, écoute tous les cours actifs
}

interface UseRealTimeTrackingReturn {
  busPositions: Map<string, BusPosition>;
  punchEvents: PunchEvent[];
  connectionStatus: ConnectionStatus;
  activeBusCount: number;
  reconnect: () => void;
}

export function useRealTimeTracking({
  tenantId,
  courseIds = [],
}: UseRealTimeTrackingOptions): UseRealTimeTrackingReturn {
  const [busPositions, setBusPositions] = useState<Map<string, BusPosition>>(new Map());
  const [punchEvents, setPunchEvents] = useState<PunchEvent[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const socketRef = useRef(getSocket());

  const subscribeToRooms = useCallback(() => {
    if (courseIds.length > 0) {
      courseIds.forEach((courseId) => {
        subscribeToCourse(tenantId, courseId);
      });
    } else {
      // Abonnement global à toutes les courses de l'école
      subscribeToCourse(tenantId, '*');
    }
  }, [tenantId, courseIds]);

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

    // Événement GPS : mise à jour de la position du bus
    socket.on('hardware.gps', (payload: BusPosition) => {
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
    socket.on('hardware.punch', (payload: PunchEvent) => {
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
      socket.off('hardware.gps');
      socket.off('hardware.punch');
      socket.off('proximity_alert');
      socket.off('critical_anomaly');
    };
  }, [tenantId]);

  return {
    busPositions,
    punchEvents,
    connectionStatus,
    activeBusCount: busPositions.size,
    reconnect,
  };
}
