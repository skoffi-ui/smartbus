import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Image, Linking, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api, { messageFromError } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import type { Child } from '../../src/types';

function CarteEnfant({ enfant }: { enfant: Child }) {
  return (
    <View style={styles.carte}>
      <View style={styles.enTeteCarte}>
        {enfant.photoUrl ? (
          <Image source={{ uri: enfant.photoUrl }} style={styles.photo} />
        ) : (
          <View style={[styles.photo, styles.photoRepli]}>
            <Ionicons name="person" size={24} color="#94a3b8" />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.nomEnfant}>{enfant.firstName} {enfant.lastName}</Text>
          {enfant.className ? <Text style={styles.classe}>{enfant.className}</Text> : null}
        </View>
      </View>

      {enfant.usualStop ? (
        <View style={styles.ligneInfo}>
          <Ionicons name="location" size={16} color="#4f46e5" />
          <Text style={styles.texteInfo}>Arrêt habituel : {enfant.usualStop.name}</Text>
        </View>
      ) : (
        <View style={styles.ligneInfo}>
          <Ionicons name="alert-circle-outline" size={16} color="#f59e0b" />
          <Text style={styles.texteInfo}>Aucun point de récupération affecté encore.</Text>
        </View>
      )}

      {enfant.busLines.length > 0 && (
        <View style={{ gap: 8 }}>
          {enfant.busLines.map((ligne) => (
            <View key={ligne.id} style={styles.ligneBusBloc}>
              <View style={styles.badgeLigne}>
                <Ionicons name="bus" size={14} color="#4f46e5" />
                <Text style={styles.texteBadge}>
                  {ligne.name} {ligne.heureDepart ? `· ${ligne.heureDepart}` : ''}
                </Text>
              </View>
              {/* Absent si aucun véhicule assigné à cette course — pas d'info fantôme. */}
              {ligne.vehicule && (
                <View style={styles.badgeVehicule}>
                  <Ionicons name="car-sport" size={13} color="#334155" />
                  <Text style={styles.texteVehicule}>
                    {ligne.vehicule.plateNumber}
                    {ligne.vehicule.brand ? ` · ${ligne.vehicule.brand} ${ligne.vehicule.model ?? ''}`.trim() : ''}
                  </Text>
                </View>
              )}
              {/* Absent si aucun chauffeur assigné à cette course — pas de bouton mort. */}
              {ligne.driver?.phone && (
                <Pressable
                  onPress={() => Linking.openURL(`tel:${ligne.driver!.phone}`)}
                  style={styles.boutonAppel}
                >
                  <Ionicons name="call" size={13} color="#10b981" />
                  <Text style={styles.texteBoutonAppel}>Appeler le chauffeur</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function MesEnfantsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [enfants, setEnfants] = useState<Child[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  const charger = useCallback(async () => {
    setErreur('');
    try {
      const { data } = await api.get<Child[]>('/parent/enfants');
      setEnfants(Array.isArray(data) ? data : []);
    } catch (err) {
      setErreur(messageFromError(err, 'Impossible de charger la liste des enfants.'));
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  return (
    <View style={styles.conteneur}>
      <View style={styles.enTete}>
        <Text style={styles.bienvenue}>
          Bonjour {session?.parent.firstName ?? ''} 👋
        </Text>
        <Text style={styles.ecole}>{session?.schoolName}</Text>
        <Pressable onPress={() => router.push('/(tabs)/profil')} style={styles.boutonDeconnexion}>
          <Ionicons name="person-circle-outline" size={24} color="#64748b" />
        </Pressable>
      </View>

      {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}

      <FlatList
        data={enfants}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.liste}
        refreshControl={<RefreshControl refreshing={chargement} onRefresh={charger} />}
        renderItem={({ item }) => <CarteEnfant enfant={item} />}
        ListEmptyComponent={
          !chargement ? (
            <View style={styles.vide}>
              <Ionicons name="school-outline" size={40} color="#cbd5e1" />
              <Text style={styles.texteVide}>Aucun enfant associé à ce compte pour le moment.</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: '#f8fafc' },
  enTete: { padding: 20, paddingBottom: 12, position: 'relative' },
  bienvenue: { fontSize: 20, fontWeight: '800', color: '#1e1b4b' },
  ecole: { fontSize: 13, color: '#64748b', marginTop: 2 },
  boutonDeconnexion: { position: 'absolute', right: 16, top: 20, padding: 6 },
  erreur: {
    color: '#dc2626',
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    fontSize: 13,
  },
  liste: { padding: 16, gap: 12 },
  carte: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  enTeteCarte: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  photo: { width: 48, height: 48, borderRadius: 24 },
  photoRepli: { backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  nomEnfant: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  classe: { fontSize: 13, color: '#64748b' },
  ligneInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  texteInfo: { fontSize: 13, color: '#334155', flex: 1 },
  ligneBusBloc: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badgeLigne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eef2ff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  texteBadge: { fontSize: 12, fontWeight: '600', color: '#4f46e5' },
  badgeVehicule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  texteVehicule: { fontSize: 12, fontWeight: '600', color: '#334155' },
  boutonAppel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  texteBoutonAppel: { fontSize: 12, fontWeight: '600', color: '#10b981' },
  vide: { alignItems: 'center', marginTop: 60, gap: 10 },
  texteVide: { color: '#94a3b8', fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
});
