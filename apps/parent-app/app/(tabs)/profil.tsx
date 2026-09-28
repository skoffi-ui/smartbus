import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Switch, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api, { messageFromError } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';

export default function ProfilScreen() {
  const { session, deconnecter, mettreAJourParent } = useAuth();

  const [ancienPin, setAncienPin] = useState('');
  const [nouveauPin, setNouveauPin] = useState('');
  const [confirmationPin, setConfirmationPin] = useState('');
  const [chargementPin, setChargementPin] = useState(false);
  const [messagePin, setMessagePin] = useState<{ texte: string; erreur: boolean } | null>(null);

  const [chargementPrefs, setChargementPrefs] = useState<'PUNCH' | 'PROXIMITY' | null>(null);

  const changerPin = async () => {
    setMessagePin(null);
    if (nouveauPin.length !== 4 || !/^\d{4}$/.test(nouveauPin)) {
      setMessagePin({ texte: 'Le nouveau code doit contenir exactement 4 chiffres.', erreur: true });
      return;
    }
    if (nouveauPin !== confirmationPin) {
      setMessagePin({ texte: 'La confirmation ne correspond pas au nouveau code.', erreur: true });
      return;
    }
    setChargementPin(true);
    try {
      await api.patch('/parent/me/pin', { ancienPin, nouveauPin });
      setMessagePin({ texte: 'Code PIN modifié avec succès.', erreur: false });
      setAncienPin('');
      setNouveauPin('');
      setConfirmationPin('');
    } catch (err) {
      setMessagePin({ texte: messageFromError(err, 'Erreur lors du changement de code.'), erreur: true });
    } finally {
      setChargementPin(false);
    }
  };

  const basculerPref = async (type: 'PUNCH' | 'PROXIMITY', valeur: boolean) => {
    setChargementPrefs(type);
    const cle = type === 'PUNCH' ? 'notifPunchEnabled' : 'notifProximityEnabled';
    try {
      await api.patch('/parent/me/notification-prefs', { [cle]: valeur });
      await mettreAJourParent({ [cle]: valeur });
    } catch {
      // Pas de rollback visuel forcé : au prochain chargement de l'écran,
      // la valeur réelle (depuis la session persistée) redevient correcte.
    } finally {
      setChargementPrefs(null);
    }
  };

  return (
    <ScrollView style={styles.conteneur} contentContainerStyle={{ padding: 20, gap: 24 }}>
      <View>
        <Text style={styles.nom}>{session?.parent.firstName} {session?.parent.lastName}</Text>
        <Text style={styles.detail}>{session?.parent.email || session?.parent.phone}</Text>
        <Text style={styles.detail}>{session?.schoolName}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.titreSection}>Notifications</Text>

        <View style={styles.ligneSwitch}>
          <View style={{ flex: 1 }}>
            <Text style={styles.libelleSwitch}>Pointages (montée/descente)</Text>
            <Text style={styles.sousLibelle}>Prévenu à chaque badgeage de votre enfant.</Text>
          </View>
          {chargementPrefs === 'PUNCH' ? (
            <ActivityIndicator size="small" />
          ) : (
            <Switch
              value={session?.parent.notifPunchEnabled ?? true}
              onValueChange={(v) => basculerPref('PUNCH', v)}
            />
          )}
        </View>

        <View style={styles.ligneSwitch}>
          <View style={{ flex: 1 }}>
            <Text style={styles.libelleSwitch}>Approche du bus</Text>
            <Text style={styles.sousLibelle}>Prévenu quand le bus approche de l'arrêt.</Text>
          </View>
          {chargementPrefs === 'PROXIMITY' ? (
            <ActivityIndicator size="small" />
          ) : (
            <Switch
              value={session?.parent.notifProximityEnabled ?? true}
              onValueChange={(v) => basculerPref('PROXIMITY', v)}
            />
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.titreSection}>Changer mon code PIN</Text>
        <TextInput
          style={styles.saisie}
          placeholder="Code actuel"
          secureTextEntry
          keyboardType="number-pad"
          maxLength={4}
          value={ancienPin}
          onChangeText={setAncienPin}
        />
        <TextInput
          style={styles.saisie}
          placeholder="Nouveau code (4 chiffres)"
          secureTextEntry
          keyboardType="number-pad"
          maxLength={4}
          value={nouveauPin}
          onChangeText={setNouveauPin}
        />
        <TextInput
          style={styles.saisie}
          placeholder="Confirmer le nouveau code"
          secureTextEntry
          keyboardType="number-pad"
          maxLength={4}
          value={confirmationPin}
          onChangeText={setConfirmationPin}
        />
        {messagePin && (
          <Text style={messagePin.erreur ? styles.messageErreur : styles.messageSucces}>
            {messagePin.texte}
          </Text>
        )}
        <Pressable style={styles.bouton} onPress={changerPin} disabled={chargementPin}>
          {chargementPin ? <ActivityIndicator color="#fff" /> : <Text style={styles.boutonTexte}>Valider</Text>}
        </Pressable>
      </View>

      <Pressable style={styles.boutonDeconnexion} onPress={deconnecter}>
        <Ionicons name="log-out-outline" size={18} color="#dc2626" />
        <Text style={styles.texteDeconnexion}>Se déconnecter</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: '#f8fafc' },
  nom: { fontSize: 20, fontWeight: '800', color: '#1e1b4b' },
  detail: { fontSize: 13, color: '#64748b', marginTop: 2 },
  section: { backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 12 },
  titreSection: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  ligneSwitch: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  libelleSwitch: { fontSize: 14, fontWeight: '600', color: '#334155' },
  sousLibelle: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  saisie: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#f8fafc',
  },
  messageErreur: { color: '#dc2626', fontSize: 13 },
  messageSucces: { color: '#10b981', fontSize: 13 },
  bouton: { backgroundColor: '#4f46e5', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  boutonTexte: { color: '#fff', fontWeight: '700', fontSize: 15 },
  boutonDeconnexion: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12 },
  texteDeconnexion: { color: '#dc2626', fontWeight: '600', fontSize: 14 },
});
