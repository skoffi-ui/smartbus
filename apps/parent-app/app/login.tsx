import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../src/context/AuthContext';
import { messageFromError } from '../src/services/api';

export default function LoginScreen() {
  const { connecter } = useAuth();
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState('');

  const soumettre = async () => {
    if (!emailOrPhone.trim() || !pinCode.trim()) {
      setErreur('Renseignez votre email/téléphone et votre code PIN.');
      return;
    }
    setChargement(true);
    setErreur('');
    try {
      await connecter({
        emailOrPhone: emailOrPhone.trim(),
        pinCode: pinCode.trim(),
        schoolCode: schoolCode.trim() || undefined,
      });
    } catch (err) {
      setErreur(messageFromError(err, 'Identifiants ou code PIN incorrects.'));
    } finally {
      setChargement(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.conteneur}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.contenu}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.logo}>🚌</Text>
        <Text style={styles.titre}>SMARTBUS Parent</Text>
        <Text style={styles.sousTitre}>Suivez le trajet de votre enfant</Text>

        <View style={styles.champ}>
          <Text style={styles.etiquette}>Email ou téléphone</Text>
          <TextInput
            style={styles.saisie}
            value={emailOrPhone}
            onChangeText={setEmailOrPhone}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="parent@exemple.com"
          />
        </View>

        <View style={styles.champ}>
          <Text style={styles.etiquette}>Code PIN (4 chiffres)</Text>
          <TextInput
            style={styles.saisie}
            value={pinCode}
            onChangeText={setPinCode}
            keyboardType="number-pad"
            maxLength={4}
            secureTextEntry
            placeholder="••••"
          />
        </View>

        <View style={styles.champ}>
          <Text style={styles.etiquette}>Code établissement (optionnel)</Text>
          <TextInput
            style={styles.saisie}
            value={schoolCode}
            onChangeText={setSchoolCode}
            autoCapitalize="characters"
            placeholder="Laissez vide si vous ne le connaissez pas"
          />
        </View>

        {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}

        <Pressable
          style={[styles.bouton, chargement && styles.boutonDesactive]}
          onPress={soumettre}
          disabled={chargement}
        >
          {chargement ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.boutonTexte}>Se connecter</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: '#fff' },
  contenu: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { fontSize: 56, textAlign: 'center', marginBottom: 8 },
  titre: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    color: '#1e1b4b',
  },
  sousTitre: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 32,
  },
  champ: { marginBottom: 16 },
  etiquette: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  saisie: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#f8fafc',
  },
  erreur: {
    color: '#dc2626',
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    fontSize: 13,
  },
  bouton: {
    backgroundColor: '#4f46e5',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  boutonDesactive: { opacity: 0.6 },
  boutonTexte: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
