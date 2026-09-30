import * as stockage from './storage';
import api, { TOKEN_KEY } from './api';
import type { ParentLoginPayload, ParentSession } from '../types';

const SESSION_KEY = 'smartbus_parent_session';

export async function login(
  payload: ParentLoginPayload,
): Promise<ParentSession> {
  const { data } = await api.post('/auth/parent/login', payload);
  const session: ParentSession = {
    token: data.token,
    tenantId: data.tenantId,
    schoolName: data.schoolName,
    schoolCode: data.schoolCode,
    parent: data.parent,
  };
  await stockage.ecrire(TOKEN_KEY, session.token);
  await stockage.ecrire(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function logout(): Promise<void> {
  await stockage.supprimer(TOKEN_KEY);
  await stockage.supprimer(SESSION_KEY);
}

/** Session déjà connue localement, sans appel réseau — utilisé au démarrage de l'app. */
export async function sessionEnCours(): Promise<ParentSession | null> {
  const brut = await stockage.lire(SESSION_KEY);
  if (!brut) return null;
  try {
    return JSON.parse(brut) as ParentSession;
  } catch {
    return null;
  }
}

/**
 * Persiste localement une modification de la session (préférences de
 * notification changées depuis l'écran Profil) — sans ça, un rechargement
 * de l'app relirait les anciennes valeurs depuis le stockage local.
 */
export async function mettreAJourSession(
  session: ParentSession,
): Promise<void> {
  await stockage.ecrire(SESSION_KEY, JSON.stringify(session));
}
