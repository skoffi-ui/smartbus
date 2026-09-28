import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * `expo-secure-store` n'a aucune implémentation web (voir la doc officielle) :
 * chaque appel direct y plante avec `ExpoSecureStore.default.getValueWithKeyAsync
 * is not a function`, observé en ouvrant `localhost:8081` dans un navigateur
 * (le bundler Metro sert aussi la cible web du projet, même si elle n'est pas
 * la plateforme visée par cette app). `localStorage` en repli sur web — pas
 * chiffré, mais suffisant pour ne pas planter en ouvrant cette page par erreur ;
 * la vraie cible (mobile natif via Expo Go/EAS) continue d'utiliser le
 * stockage sécurisé réel.
 */
export async function lire(cle: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem(cle);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(cle);
}

export async function ecrire(cle: string, valeur: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      localStorage.setItem(cle, valeur);
    } catch {
      // Mode navigation privée ou stockage désactivé — pas critique sur web.
    }
    return;
  }
  await SecureStore.setItemAsync(cle, valeur);
}

export async function supprimer(cle: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem(cle);
    } catch {
      // Idem.
    }
    return;
  }
  await SecureStore.deleteItemAsync(cle);
}
