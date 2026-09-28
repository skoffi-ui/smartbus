import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, useSegments } from 'expo-router';
import * as authService from '../services/auth';
import { definirGestionnaireDeconnexion } from '../services/api';
import type { ParentLoginPayload, ParentSession } from '../types';

interface AuthContextValue {
  session: ParentSession | null;
  chargement: boolean;
  connecter: (payload: ParentLoginPayload) => Promise<void>;
  deconnecter: () => Promise<void>;
  /** Met à jour une partie de la session (ex. préférences de notification) et la persiste. */
  mettreAJourParent: (partiel: Partial<ParentSession['parent']>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ParentSession | null>(null);
  const [chargement, setChargement] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    authService.sessionEnCours().then((s) => {
      setSession(s);
      setChargement(false);
    });
  }, []);

  // Déconnexion forcée par l'intercepteur axios (401) — voir services/api.ts.
  useEffect(() => {
    definirGestionnaireDeconnexion(() => setSession(null));
    return () => definirGestionnaireDeconnexion(null);
  }, []);

  // Garde de navigation : hors connexion, toute page exige une session.
  // Sans ce garde, une navigation directe vers /(tabs) contournerait l'écran
  // de connexion même sans jeton valide.
  useEffect(() => {
    if (chargement) return;
    const surEcranConnexion = segments[0] === 'login';
    if (!session && !surEcranConnexion) {
      router.replace('/login');
    } else if (session && surEcranConnexion) {
      router.replace('/(tabs)');
    }
  }, [session, chargement, segments, router]);

  const connecter = useCallback(async (payload: ParentLoginPayload) => {
    const s = await authService.login(payload);
    setSession(s);
  }, []);

  const deconnecter = useCallback(async () => {
    await authService.logout();
    setSession(null);
  }, []);

  const mettreAJourParent = useCallback(async (partiel: Partial<ParentSession['parent']>) => {
    setSession((prev) => {
      if (!prev) return prev;
      const suivant = { ...prev, parent: { ...prev.parent, ...partiel } };
      authService.mettreAJourSession(suivant);
      return suivant;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ session, chargement, connecter, deconnecter, mettreAJourParent }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé à l\'intérieur de <AuthProvider>.');
  return ctx;
}
