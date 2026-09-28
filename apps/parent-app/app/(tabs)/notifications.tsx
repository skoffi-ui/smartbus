import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api, { messageFromError } from '../../src/services/api';
import type { ParentNotification } from '../../src/types';

const ICONES: Record<string, { nom: keyof typeof Ionicons.glyphMap; couleur: string }> = {
  PUNCH: { nom: 'checkmark-circle', couleur: '#10b981' },
  PROXIMITY: { nom: 'navigate-circle', couleur: '#f59e0b' },
};

function formaterHeure(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function CarteNotification({ notif, onLue }: { notif: ParentNotification; onLue: (id: string) => void }) {
  const icone = ICONES[notif.type] ?? { nom: 'notifications' as const, couleur: '#64748b' };

  return (
    <Pressable
      onPress={() => !notif.isRead && onLue(notif.id)}
      style={[styles.carte, !notif.isRead && styles.carteNonLue]}
    >
      <Ionicons name={icone.nom} size={24} color={icone.couleur} />
      <View style={{ flex: 1 }}>
        <Text style={styles.titreNotif}>{notif.title}</Text>
        <Text style={styles.messageNotif}>{notif.message}</Text>
        <Text style={styles.heureNotif}>{formaterHeure(notif.createdAt)}</Text>
      </View>
      {!notif.isRead && <View style={styles.pointNonLu} />}
    </Pressable>
  );
}

type Filtre = 'TOUTES' | 'PUNCH' | 'PROXIMITY';

const LIBELLES_FILTRE: Record<Filtre, string> = {
  TOUTES: 'Toutes',
  PUNCH: 'Présence',
  PROXIMITY: 'Proximité',
};

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<ParentNotification[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [filtre, setFiltre] = useState<Filtre>('TOUTES');

  const charger = useCallback(async (filtreActuel: Filtre) => {
    setErreur('');
    try {
      const params = filtreActuel !== 'TOUTES' ? { type: filtreActuel } : undefined;
      const { data } = await api.get<ParentNotification[]>('/parent/notifications', { params });
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      setErreur(messageFromError(err, 'Impossible de charger les notifications.'));
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    setChargement(true);
    charger(filtre);
  }, [charger, filtre]);

  const marquerLue = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    try {
      await api.patch(`/parent/notifications/${id}/read`);
    } catch {
      // Best-effort : si ça échoue, la notification réapparaîtra non lue au
      // prochain chargement plutôt que de bloquer l'interaction.
    }
  }, []);

  return (
    <View style={styles.conteneur}>
      <View style={styles.rangeeFiltres}>
        {(Object.keys(LIBELLES_FILTRE) as Filtre[]).map((cle) => (
          <Pressable
            key={cle}
            onPress={() => setFiltre(cle)}
            style={[styles.puceFiltre, filtre === cle && styles.puceFiltreActive]}
          >
            <Text style={[styles.texteFiltre, filtre === cle && styles.texteFiltreActif]}>
              {LIBELLES_FILTRE[cle]}
            </Text>
          </Pressable>
        ))}
      </View>

      {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.liste}
        refreshControl={<RefreshControl refreshing={chargement} onRefresh={() => charger(filtre)} />}
        renderItem={({ item }) => <CarteNotification notif={item} onLue={marquerLue} />}
        ListEmptyComponent={
          !chargement ? (
            <View style={styles.vide}>
              <Ionicons name="notifications-off-outline" size={40} color="#cbd5e1" />
              <Text style={styles.texteVide}>
                Aucune notification pour l'instant. Vous serez prévenu à chaque pointage et
                approche du bus.
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: '#f8fafc' },
  rangeeFiltres: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 16 },
  puceFiltre: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  puceFiltreActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  texteFiltre: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  texteFiltreActif: { color: '#fff' },
  erreur: {
    color: '#dc2626',
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 10,
    marginHorizontal: 16,
    marginTop: 12,
    fontSize: 13,
  },
  liste: { padding: 16, gap: 10 },
  carte: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
  },
  carteNonLue: { backgroundColor: '#eef2ff' },
  titreNotif: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  messageNotif: { fontSize: 13, color: '#334155', marginTop: 2 },
  heureNotif: { fontSize: 11, color: '#94a3b8', marginTop: 6 },
  pointNonLu: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4f46e5', marginTop: 6 },
  vide: { alignItems: 'center', marginTop: 60, gap: 10 },
  texteVide: { color: '#94a3b8', fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
});
