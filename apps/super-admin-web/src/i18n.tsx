import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type Langue = 'fr' | 'en';

const CLE_STOCKAGE = 'smartbus:langue';

const traductions = {
  /* ── Général ─────────────────────────────────────────────────── */
  'chargement':              { fr: 'Chargement…',         en: 'Loading…' },
  'enregistrer':             { fr: 'Enregistrer',          en: 'Save' },
  'enregistrement':          { fr: 'Enregistrement…',      en: 'Saving…' },
  'annuler':                 { fr: 'Annuler',              en: 'Cancel' },
  'modifier':                { fr: 'Modifier',             en: 'Edit' },
  'supprimer':               { fr: 'Supprimer',            en: 'Delete' },
  'fermer':                  { fr: 'Fermer',               en: 'Close' },
  'rechercher':              { fr: 'Rechercher…',          en: 'Search…' },
  'pages':                   { fr: 'Pages',                en: 'Pages' },

  /* ── Navbar ──────────────────────────────────────────────────── */
  'nav.profil':              { fr: 'Mon Profil',           en: 'My Profile' },
  'nav.parametres':          { fr: 'Paramètres',           en: 'Settings' },
  'nav.securite':            { fr: 'Sécurité',             en: 'Security' },
  'nav.deconnexion':         { fr: 'Déconnexion',          en: 'Log out' },
  'nav.theme_clair':         { fr: 'Passer au thème clair',  en: 'Switch to light theme' },
  'nav.theme_sombre':        { fr: 'Passer au thème sombre', en: 'Switch to dark theme' },

  /* ── Sidebar ─────────────────────────────────────────────────── */
  'sidebar.ecoles':          { fr: 'Écoles',               en: 'Schools' },
  'sidebar.equipe':          { fr: 'Équipe',               en: 'Team' },
  'sidebar.abonnements':     { fr: 'Abonnements',          en: 'Subscriptions' },
  'sidebar.centrale':        { fr: 'BioTime Centrale',     en: 'Central BioTime' },
  'sidebar.parametres':      { fr: 'Paramètres',           en: 'Settings' },
  'sidebar.aide':            { fr: 'Besoin d\'aide ?',     en: 'Need help?' },
  'sidebar.aide_desc':       { fr: 'Consultez la documentation technique', en: 'Check the technical documentation' },
  'sidebar.documentation':   { fr: 'Documentation',        en: 'Documentation' },

  /* ── Paramètres — Onglets ────────────────────────────────────── */
  'param.titre':             { fr: 'Paramètres',           en: 'Settings' },
  'param.sous_titre':        { fr: 'Gérez votre profil, la sécurité et les notifications.', en: 'Manage your profile, security and notifications.' },
  'param.chargement':        { fr: 'Chargement des paramètres…', en: 'Loading settings…' },
  'param.onglet_profil':     { fr: 'Mon Profil',           en: 'My Profile' },
  'param.onglet_securite':   { fr: 'Sécurité',             en: 'Security' },
  'param.onglet_notifs':     { fr: 'Notifications',        en: 'Notifications' },
  'param.onglet_langue':     { fr: 'Langue',               en: 'Language' },

  /* ── Profil ──────────────────────────────────────────────────── */
  'profil.prenom':           { fr: 'Prénom',               en: 'First name' },
  'profil.nom':              { fr: 'Nom',                  en: 'Last name' },
  'profil.email':            { fr: 'Adresse email',        en: 'Email address' },
  'profil.derniere_co':      { fr: 'Dernière connexion',   en: 'Last login' },
  'profil.super_admin':      { fr: 'Super Administrateur', en: 'Super Administrator' },
  'profil.succes':           { fr: 'Profil mis à jour avec succès.', en: 'Profile updated successfully.' },
  'profil.erreur':           { fr: 'Erreur lors de la mise à jour.', en: 'Error updating profile.' },

  /* ── Sécurité ────────────────────────────────────────────────── */
  'secu.titre':              { fr: 'Changer le mot de passe',          en: 'Change password' },
  'secu.mdp_actuel':         { fr: 'Mot de passe actuel',             en: 'Current password' },
  'secu.mdp_nouveau':        { fr: 'Nouveau mot de passe',            en: 'New password' },
  'secu.mdp_confirmer':      { fr: 'Confirmer le nouveau mot de passe', en: 'Confirm new password' },
  'secu.mdp_modifier':       { fr: 'Modifier le mot de passe',        en: 'Change password' },
  'secu.mdp_modification':   { fr: 'Modification…',                   en: 'Changing…' },
  'secu.mdp_pas_identiques': { fr: 'Les mots de passe ne correspondent pas.', en: 'Passwords do not match.' },
  'secu.mdp_trop_court':     { fr: 'Le mot de passe doit contenir au moins 8 caractères.', en: 'Password must be at least 8 characters.' },
  'secu.mdp_succes':         { fr: 'Mot de passe modifié avec succès.', en: 'Password changed successfully.' },
  'secu.mdp_erreur':         { fr: 'Erreur lors du changement de mot de passe.', en: 'Error changing password.' },
  'secu.sessions':           { fr: 'Sessions actives',                en: 'Active sessions' },
  'secu.session_actuelle':   { fr: 'Session actuelle',                en: 'Current session' },
  'secu.navigateur':         { fr: 'Navigateur web',                  en: 'Web browser' },
  'secu.active':             { fr: 'Active',                          en: 'Active' },

  /* ── Notifications ───────────────────────────────────────────── */
  'notif.titre':             { fr: 'Préférences de notification',     en: 'Notification preferences' },
  'notif.serveur_down':      { fr: 'Serveur BioTime hors ligne',     en: 'BioTime server offline' },
  'notif.serveur_down_desc': { fr: 'Recevoir une alerte quand un serveur BioTime d\'une école ne répond plus.', en: 'Get alerted when a school\'s BioTime server stops responding.' },
  'notif.badgeuse_off':      { fr: 'Badgeuse déconnectée',           en: 'Badge reader disconnected' },
  'notif.badgeuse_off_desc': { fr: 'Recevoir une alerte quand un terminal biométrique perd la connexion.', en: 'Get alerted when a biometric terminal loses connection.' },
  'notif.abo_expire':        { fr: 'Abonnement expiré',              en: 'Subscription expired' },
  'notif.abo_expire_desc':   { fr: 'Recevoir une alerte quand l\'abonnement d\'une école est arrivé à échéance.', en: 'Get alerted when a school\'s subscription expires.' },
  'notif.nouvelle_ecole':    { fr: 'Nouvelle école inscrite',        en: 'New school registered' },
  'notif.nouvelle_ecole_desc': { fr: 'Recevoir une notification quand une école s\'inscrit via le formulaire self-service.', en: 'Get notified when a school signs up via self-service.' },
  'notif.pref_succes':       { fr: 'Préférences enregistrées.',      en: 'Preferences saved.' },
  'notif.enregistrer_pref':  { fr: 'Enregistrer les préférences',    en: 'Save preferences' },

  /* ── Langue ──────────────────────────────────────────────────── */
  'langue.titre':            { fr: 'Langue de l\'interface',         en: 'Interface language' },
  'langue.description':      { fr: 'Choisissez la langue d\'affichage de l\'application.', en: 'Choose the application display language.' },
  'langue.francais':         { fr: 'Français',                       en: 'French' },
  'langue.anglais':          { fr: 'Anglais',                        en: 'English' },
  'langue.succes':           { fr: 'Langue mise à jour.',            en: 'Language updated.' },
} as const;

export type CleTraduction = keyof typeof traductions;

/* ── Context ───────────────────────────────────────────────────── */

interface ContexteI18n {
  langue: Langue;
  changerLangue: (l: Langue) => void;
  t: (cle: CleTraduction) => string;
}

const I18nContext = createContext<ContexteI18n | null>(null);

function lireLangueStockee(): Langue {
  try {
    const v = localStorage.getItem(CLE_STOCKAGE);
    return v === 'en' ? 'en' : 'fr';
  } catch {
    return 'fr';
  }
}

export function FournisseurI18n({ children }: { children: ReactNode }) {
  const [langue, setLangue] = useState<Langue>(lireLangueStockee);

  const changerLangue = useCallback((l: Langue) => {
    setLangue(l);
    try { localStorage.setItem(CLE_STOCKAGE, l); } catch {}
  }, []);

  const t = useCallback((cle: CleTraduction): string => {
    const entree = traductions[cle];
    return entree ? entree[langue] : cle;
  }, [langue]);

  return (
    <I18nContext.Provider value={{ langue, changerLangue, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): ContexteI18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n doit être utilisé dans un FournisseurI18n');
  return ctx;
}
