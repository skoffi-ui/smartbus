import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import api, { messageFromError } from '../../src/services/api';
import { obtenirSocket, deconnecterSocket } from '../../src/services/socket';
import type { Child } from '../../src/types';

interface PositionBus {
  courseId: string;
  carId: string;
  plateNumber?: string;
  lat: number;
  lng: number;
  speed: number;
  time: string;
}

/** Même seuil que `useRealTimeTracking.ts` côté school-web : au-delà, une
 * position ne peut plus être considérée comme réellement « en direct ». */
const SEUIL_HORS_LIGNE_MS = 90_000;

const ABIDJAN: Region = { latitude: 5.3364, longitude: -4.0267, latitudeDelta: 0.15, longitudeDelta: 0.15 };

export default function CarteScreen() {
  const [enfants, setEnfants] = useState<Child[]>([]);
  const [positions, setPositions] = useState<Record<string, PositionBus>>({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const mapRef = useRef<MapView | null>(null);

  useEffect(() => {
    const id = setInterval(() => setMaintenant(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  const chargerEnfants = useCallback(async () => {
    try {
      const { data } = await api.get<Child[]>('/parent/enfants');
      setEnfants(Array.isArray(data) ? data : []);
    } catch (err) {
      setErreur(messageFromError(err, 'Impossible de charger les courses à suivre.'));
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    chargerEnfants();
  }, [chargerEnfants]);

  useEffect(() => {
    let annule = false;

    obtenirSocket().then((socket) => {
      if (annule) return;
      socket.on('gps', (payload: any) => {
        const lat = Number(payload?.lat);
        const lng = Number(payload?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || !payload?.courseId) return;
        setPositions((prev) => ({
          ...prev,
          [payload.courseId]: {
            courseId: payload.courseId,
            carId: payload.carId,
            plateNumber: payload.plateNumber,
            lat,
            lng,
            speed: Number(payload.speed) || 0,
            time: payload.time || new Date().toISOString(),
          },
        }));
      });
    });

    return () => {
      annule = true;
      deconnecterSocket();
    };
  }, []);

  const busActifs = Object.values(positions);
  const estEnLigne = (p: PositionBus) => maintenant - new Date(p.time).getTime() < SEUIL_HORS_LIGNE_MS;

  // Nom d'affichage : la ligne de bus (busLines) qui correspond à ce courseId.
  const nomCourse = (courseId: string): string => {
    for (const enfant of enfants) {
      const ligne = enfant.busLines.find((l) => l.id === courseId);
      if (ligne) return `${ligne.name} (${enfant.firstName})`;
    }
    return 'Bus';
  };

  if (chargement) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <View style={styles.conteneur}>
      {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}

      <MapView ref={mapRef} style={styles.carte} initialRegion={ABIDJAN}>
        {busActifs.map((bus) => (
          <Marker
            key={bus.courseId}
            coordinate={{ latitude: bus.lat, longitude: bus.lng }}
            title={`${nomCourse(bus.courseId)}${bus.plateNumber ? ` — ${bus.plateNumber}` : ''}`}
            description={estEnLigne(bus) ? `${bus.speed} km/h` : 'Hors ligne — dernière position connue'}
            opacity={estEnLigne(bus) ? 1 : 0.4}
          >
            <View style={[styles.icone, !estEnLigne(bus) && styles.iconeHorsLigne]}>
              <Ionicons name="bus" size={18} color="#fff" />
            </View>
          </Marker>
        ))}
      </MapView>

      {busActifs.length === 0 && (
        <View style={styles.superposition} pointerEvents="none">
          <Ionicons name="bus-outline" size={40} color="#94a3b8" />
          <Text style={styles.texteVide}>
            Aucun bus en direct pour l'instant. La position apparaît dès qu'une course de votre
            enfant est active.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  carte: { flex: 1 },
  erreur: {
    color: '#dc2626',
    backgroundColor: '#fef2f2',
    padding: 10,
    fontSize: 13,
  },
  icone: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  iconeHorsLigne: { backgroundColor: '#94a3b8' },
  superposition: {
    position: 'absolute',
    top: '40%',
    left: 32,
    right: 32,
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 14,
    padding: 20,
  },
  texteVide: { color: '#64748b', fontSize: 13, textAlign: 'center' },
});
