import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { enregistrerTokenPush } from '../src/services/notifications';

export {
  // Capture les erreurs levées dans l'arbre de navigation.
  ErrorBoundary,
} from 'expo-router';

// Empêche l'écran de démarrage de disparaître avant la fin du chargement des polices.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

function RootLayoutNav() {
  const { session } = useAuth();

  // Enregistre le token push une fois connecté — pas avant (le backend
  // associe le token au parent authentifié, voir POST parent/fcm-token).
  useEffect(() => {
    if (session) enregistrerTokenPush();
  }, [session]);

  return (
    <Stack>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
