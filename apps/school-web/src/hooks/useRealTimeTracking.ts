import { useEffect, useRef, useState, useCallback } from 'react';
import {
  getSocket,
  subscribeToCourse,
  disconnectSocket,
} from '../services/socket.service';
import api from '../services/api';

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
  /**
   * Statut brut GPSWOX (`'online' | 'ack' | 'offline'`) — absent pour
   * Libellule/Traccar. Purement informatif : voir `estEnLigne` pour le seul
   * signal réellement fiable et commun à toutes les sources.
   */
  online?: string;
}

/**
 * Un bus n'émet plus forcément un événement quand il tombe en panne ou perd
 * le réseau : sans notion de fraîcheur, son dernier point connu restait
 * affiché indéfiniment, identique en apparence à un bus réellement suivi.
 * La fraîcheur de `timestamp` est le seul signal commun aux trois sources
 * (GPSWOX, Traccar, Libellule) — GPSWOX expose bien un champ `online`, mais
 * il ne couvre que son propre flux et un appareil qui repasse `offline` chez
 * GPSWOX est simplement exclu des cycles suivants (voir
 * `estAllumeOuEnDeplacement` côté serveur) : plus aucun événement n'arrive
 * jamais pour le signaler autrement que par ce silence.
 */
export const SEUIL_HORS_LIGNE_MS = 90_000; // 90s sans nouvelle position → hors ligne
export const SEUIL_EXPIRATION_MS = 10 * 60_000; // 10min sans nouvelle position → retiré de la carte

export function estEnLigne(
  bus: BusPosition,
  maintenant: number = Date.now(),
): boolean {
  const t = new Date(bus.timestamp).getTime();
  if (!Number.isFinite(t)) return false;
  return maintenant - t < SEUIL_HORS_LIGNE_MS;
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
  /** Nombre de bus réellement en ligne (position fraîche), pas seulement connus. */
  activeBusCount: number;
  reconnect: () => void;
}

/**
 * Ramène une position à la forme attendue par la carte.
 *
 * Le serveur parle en `lat`/`lng`/`time` — c'est le vocabulaire des balises — là
 * où ce hook expose `latitude`/`longitude`/`timestamp`. Sans cette traduction,
 * chaque position arrivait avec des coordonnées `undefined` et aucun marqueur ne
 * pouvait s'afficher : le suivi temps réel paraissait vide en permanence.
 *
 * L'indexation se fait sur le véhicule, pas sur la course : un même bus peut
 * enchaîner plusieurs courses dans la journée, et c'est bien un marqueur par
 * véhicule que l'on veut voir sur la carte.
 */
function normaliserPosition(
  brut: any,
): { cle: string; position: BusPosition } | null {
  const latitude = Number(brut?.latitude ?? brut?.lat);
  const longitude = Number(brut?.longitude ?? brut?.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const cle = brut.carId || brut.deviceId || brut.courseId;
  if (!cle) return null;

  return {
    cle,
    position: {
      courseId: brut.courseId || '',
      deviceId: brut.deviceId || brut.carId || '',
      latitude,
      longitude,
      speed: Number(brut.speed ?? 0),
      heading: brut.heading,
      timestamp: brut.timestamp || brut.time || new Date().toISOString(),
      plateNumber: brut.plateNumber,
      driverName: brut.driverName,
      studentsOnBoard: brut.studentsOnBoard,
      courseName: brut.courseName,
      routeName: brut.routeName,
      online: brut.online,
    },
  };
}

export function useRealTimeTracking({
  courseIds = [],
}: UseRealTimeTrackingOptions = {}): UseRealTimeTrackingReturn {
  const [busPositions, setBusPositions] = useState<Map<string, BusPosition>>(
    new Map(),
  );
  const [punchEvents, setPunchEvents] = useState<PunchEvent[]>([]);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('connecting');
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
    socket.on('gps', (payload: any) => {
      const normalisee = normaliserPosition(payload);
      if (!normalisee) return;
      setBusPositions((prev) => {
        const next = new Map(prev);
        next.set(normalisee.cle, normalisee.position);
        return next;
      });
    });

    // Événement de pointage biométrique
    socket.on('punch', (payload: PunchEvent) => {
      setPunchEvents((prev) => [payload, ...prev].slice(0, 50)); // Garde les 50 derniers
    });

    // Alerte de proximité
    socket.on('proximity_alert', (payload: any) => {
      setPunchEvents((prev) =>
        [
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
        ].slice(0, 50),
      );
    });

    // Anomalie critique de pointage
    socket.on('critical_anomaly', (payload: any) => {
      setPunchEvents((prev) =>
        [
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
        ].slice(0, 50),
      );
    });
  }

  /**
   * Positions déjà connues du serveur, chargées à l'ouverture de l'écran.
   *
   * Le WebSocket ne transmet que ce qui arrive APRÈS la connexion. Sans ce
   * premier appel, ouvrir la carte affichait « aucun bus en service » jusqu'au
   * prochain message d'une balise — plusieurs dizaines de secondes en conditions
   * réelles, et un écran vide au moment précis où on regarde.
   */
  useEffect(() => {
    let annule = false;

    api
      .get('/gps/live')
      .then((res) => {
        if (annule) return;
        const liste: any[] = Array.isArray(res.data)
          ? res.data
          : res.data?.data || [];
        setBusPositions((prev) => {
          const next = new Map(prev);
          for (const brut of liste) {
            const normalisee = normaliserPosition(brut);
            // Une position reçue en direct pendant le chargement est plus fraîche.
            if (normalisee && !next.has(normalisee.cle))
              next.set(normalisee.cle, normalisee.position);
          }
          return next;
        });
      })
      .catch(() => {
        // L'absence de positions initiales n'est pas une erreur d'écran : le
        // WebSocket prendra le relais dès la première trame reçue.
      });

    return () => {
      annule = true;
    };
  }, []);

  // Purge périodique : un bus dont la position n'a plus bougé depuis
  // `SEUIL_EXPIRATION_MS` est retiré de la carte plutôt que d'y rester figé
  // indéfiniment à son dernier point connu (voir `estEnLigne`). Sert aussi de
  // tic régulier pour que le statut « hors ligne » (calculé à l'affichage à
  // partir de `timestamp`) se rafraîchisse même sans nouvelle trame reçue.
  useEffect(() => {
    const id = setInterval(() => {
      const maintenant = Date.now();
      setBusPositions((prev) => {
        let modifie = false;
        const next = new Map(prev);
        for (const [cle, position] of prev) {
          const t = new Date(position.timestamp).getTime();
          if (!Number.isFinite(t) || maintenant - t >= SEUIL_EXPIRATION_MS) {
            next.delete(cle);
            modifie = true;
          }
        }
        return modifie ? next : prev;
      });
    }, 10_000);
    return () => clearInterval(id);
  }, []);

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
    activeBusCount: Array.from(busPositions.values()).filter((b) =>
      estEnLigne(b),
    ).length,
    reconnect,
  };
}
