import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import api from './api';

// Affiche la notification même quand l'app est au premier plan — sans ça,
// une alerte de proximité reçue pendant que le parent consulte l'app
// n'apparaîtrait jamais (comportement par défaut : silencieux au premier plan).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Demande la permission puis récupère le token push natif de l'appareil
 * (FCM sur Android). Volontairement `getDevicePushTokenAsync()` et non le
 * token Expo générique : `FcmService` côté backend (déjà écrit,
 * `admin.messaging().send()`) appelle directement Firebase Admin SDK avec
 * un vrai token FCM — le token Expo (relayé par le service push d'Expo)
 * n'est pas ce format et ne fonctionnerait pas avec ce code serveur existant.
 *
 * `null` sur simulateur/émulateur (pas de vrai service push) ou permission
 * refusée — pas une erreur, l'app reste utilisable sans notifications.
 */
export async function obtenirTokenPushAppareil(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: statutActuel } = await Notifications.getPermissionsAsync();
  let statut = statutActuel;
  if (statut !== 'granted') {
    const demande = await Notifications.requestPermissionsAsync();
    statut = demande.status;
  }
  if (statut !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'SMARTBUS',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const { data } = await Notifications.getDevicePushTokenAsync();
  return data;
}

/** Enregistre le token auprès du backend — à appeler une fois le parent connecté. */
export async function enregistrerTokenPush(): Promise<void> {
  try {
    const token = await obtenirTokenPushAppareil();
    if (!token) return;
    await api.post('/parent/fcm-token', { token });
  } catch {
    // Best-effort : l'app reste utilisable sans notifications push si
    // l'enregistrement échoue (réseau, permission retirée entre-temps…).
  }
}
