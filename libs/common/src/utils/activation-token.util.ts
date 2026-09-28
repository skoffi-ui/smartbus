import * as crypto from 'crypto';

export interface JetonActivation {
  /** Jeton brut, à mettre dans le lien envoyé au directeur — jamais stocké tel quel. */
  rawToken: string;
  /** Hash SHA-256 du jeton brut — c'est cette valeur qui va dans `User.resetPasswordToken`. */
  tokenHash: string;
  /** Date d'expiration du jeton. */
  expires: Date;
}

/**
 * Génère un jeton d'activation/réinitialisation de mot de passe.
 *
 * Même principe que `AuthService.forgotPassword()` (jeton aléatoire de 32
 * octets, haché en SHA-256 avant stockage — le jeton brut n'est jamais
 * persisté), mais avec une expiration de 7 jours au lieu d'1 heure : ce jeton
 * n'est pas un "mot de passe oublié" agi dans l'instant, c'est un lien
 * transmis hors-bande par le Super Admin (à la création d'un compte
 * directeur, ou lors d'une réinitialisation qu'il déclenche) — voir
 * `AuthService.registerSchool`, `UsersService.createDirector` et
 * `UsersService.resetPassword`.
 *
 * Fonction pure et sans dépendance : les appelants posent eux-mêmes
 * `user.resetPasswordToken = tokenHash` et `user.resetPasswordExpires = expires`
 * sur l'entité `User` qu'ils ont déjà en main, puis sauvegardent. Le jeton
 * est ensuite consommé par le même endpoint `POST /auth/reset-password` que
 * `forgotPassword()`, qu'il s'agisse d'une première activation ou d'une
 * réinitialisation.
 */
export function genererJetonActivation(dureeValiditeMs = 7 * 24 * 60 * 60 * 1000): JetonActivation {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expires = new Date(Date.now() + dureeValiditeMs);
  return { rawToken, tokenHash, expires };
}
