import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type Langue = 'fr' | 'en';

const CLE_STOCKAGE = 'smartbus:langue';

const traductions = {
  /* ── Général ─────────────────────────────────────────────────── */
  'chargement':              { fr: 'Chargement…',          en: 'Loading…' },
  'enregistrer':             { fr: 'Enregistrer',          en: 'Save' },
  'enregistrement':          { fr: 'Enregistrement…',      en: 'Saving…' },

  /* ── Sidebar ─────────────────────────────────────────────────── */
  'sidebar.vue_ensemble':    { fr: "Vue d'ensemble",       en: 'Overview' },
  'sidebar.live':            { fr: 'Live Tracking',        en: 'Live Tracking' },
  'sidebar.flotte':          { fr: 'Flotte (Bus)',         en: 'Fleet (Buses)' },
  'sidebar.chauffeurs':      { fr: 'Chauffeurs',           en: 'Drivers' },
  'sidebar.parents':         { fr: 'Parents',              en: 'Parents' },
  'sidebar.eleves':          { fr: 'Élèves',               en: 'Students' },
  'sidebar.courses':         { fr: 'Courses',              en: 'Rides' },
  'sidebar.trajets':         { fr: 'Trajets',              en: 'Routes' },
  'sidebar.affectation':     { fr: 'Affectation des élèves', en: 'Student Assignment' },
  'sidebar.suivi':           { fr: 'Suivi des montées',    en: 'Boarding Tracking' },
  'sidebar.alertes':         { fr: 'Alertes',              en: 'Alerts' },
  'sidebar.centre_alertes':  { fr: "Centre d'Alertes",     en: 'Alert Center' },
  'sidebar.annuaire':        { fr: 'Annuaire BioTime',     en: 'BioTime Directory' },
  'sidebar.config_biotime':  { fr: 'Config BioTime',       en: 'BioTime Config' },
  'sidebar.parametres':      { fr: 'Paramètres',           en: 'Settings' },
  'sidebar.deconnexion':     { fr: 'Déconnexion',          en: 'Log out' },
  'sidebar.confirmer_deco':  { fr: 'Voulez-vous vraiment vous déconnecter ?', en: 'Do you really want to log out?' },

  /* ── Header ──────────────────────────────────────────────────── */
  'header.theme_clair':      { fr: 'Passer au thème clair',  en: 'Switch to light theme' },
  'header.theme_sombre':     { fr: 'Passer au thème sombre', en: 'Switch to dark theme' },
  'header.parametres':       { fr: 'Paramètres',           en: 'Settings' },

  /* ── Paramètres — Global ─────────────────────────────────────── */
  'param.titre':             { fr: 'Paramètres',           en: 'Settings' },
  'param.sous_titre':        { fr: 'Configurez votre établissement, la synchronisation BioTime, les alertes et votre compte.', en: 'Configure your school, BioTime sync, alerts and your account.' },

  /* ── Onglets ─────────────────────────────────────────────────── */
  'onglet.ecole':            { fr: 'Mon École',            en: 'My School' },
  'onglet.biotime':          { fr: 'BioTime',              en: 'BioTime' },
  'onglet.alertes':          { fr: 'Alertes',              en: 'Alerts' },
  'onglet.classes':          { fr: 'Classes',              en: 'Classes' },
  'onglet.compte':           { fr: 'Mon Compte',           en: 'My Account' },
  'onglet.langue':           { fr: 'Langue',               en: 'Language' },

  /* ── Mon École ───────────────────────────────────────────────── */
  'ecole.titre':             { fr: "Informations de l'établissement", en: 'School information' },
  'ecole.nom':               { fr: "Nom de l'école",       en: 'School name' },
  'ecole.code':              { fr: 'Code école',           en: 'School code' },
  'ecole.adresse':           { fr: 'Adresse',              en: 'Address' },
  'ecole.telephone':         { fr: 'Téléphone',            en: 'Phone' },
  'ecole.fuseau':            { fr: 'Fuseau horaire',       en: 'Timezone' },
  'ecole.responsable':       { fr: 'Responsable',          en: 'Director' },
  'ecole.nom_directeur':     { fr: 'Nom du directeur',     en: 'Director name' },
  'ecole.email':             { fr: 'Email',                en: 'Email' },
  'ecole.succes':            { fr: "Informations de l'école enregistrées.", en: 'School information saved.' },

  /* ── BioTime ─────────────────────────────────────────────────── */
  'bio.titre':               { fr: 'Synchronisation BioTime', en: 'BioTime Sync' },
  'bio.synchronises':        { fr: 'Synchronisés',         en: 'Synced' },
  'bio.en_attente':          { fr: 'En attente',           en: 'Pending' },
  'bio.en_echec':            { fr: 'En échec',             en: 'Failed' },
  'bio.non_configures':      { fr: 'Non configurés',       en: 'Not configured' },
  'bio.retry_titre':         { fr: 'Resynchroniser les élèves en échec', en: 'Retry failed student sync' },
  'bio.retry_desc':          { fr: 'élève(s) en attente ou en échec seront remis en file BullMQ pour synchronisation vers BioTime.', en: 'student(s) pending or failed will be re-queued via BullMQ for BioTime sync.' },
  'bio.retry_btn':           { fr: 'Resynchroniser',       en: 'Retry sync' },
  'bio.retry_encours':       { fr: 'En cours…',            en: 'In progress…' },
  'bio.retry_fait':          { fr: 'Fait !',               en: 'Done!' },
  'bio.retry_succes':        { fr: 'élève(s) remis en file de synchronisation.', en: 'student(s) re-queued for sync.' },
  'bio.retry_aucun':         { fr: 'Aucun élève à resynchroniser.', en: 'No students to re-sync.' },
  'bio.retry_erreur':        { fr: 'Erreur lors de la resynchronisation.', en: 'Error during re-sync.' },
  'bio.classes_titre':       { fr: 'Synchroniser les classes vers BioTime', en: 'Sync classes to BioTime' },
  'bio.classes_desc':        { fr: 'Crée les départements manquants dans BioTime à partir des noms de classes de vos élèves.', en: 'Creates missing departments in BioTime from your students\' class names.' },
  'bio.classes_btn':         { fr: 'Synchroniser les classes', en: 'Sync classes' },
  'bio.classes_succes':      { fr: 'département(s) créé(s) dans BioTime.', en: 'department(s) created in BioTime.' },
  'bio.classes_existe':      { fr: 'Tous les départements existent déjà.', en: 'All departments already exist.' },
  'bio.classes_erreur':      { fr: 'Erreur lors de la synchronisation des classes.', en: 'Error syncing classes.' },
  'bio.echec_titre':         { fr: 'Élèves en échec de synchronisation', en: 'Students with sync failures' },
  'bio.col_eleve':           { fr: 'Élève',                en: 'Student' },
  'bio.col_classe':          { fr: 'Classe',               en: 'Class' },
  'bio.col_erreur':          { fr: 'Erreur',               en: 'Error' },
  'bio.erreur_inconnue':     { fr: 'Erreur inconnue',      en: 'Unknown error' },

  /* ── Alertes ─────────────────────────────────────────────────── */
  'alerte.titre':            { fr: 'Alertes & Notifications', en: 'Alerts & Notifications' },
  'alerte.plage_titre':      { fr: 'Plage horaire des notifications', en: 'Notification time range' },
  'alerte.plage_desc':       { fr: 'Les parents ne seront pas notifiés en dehors de cette plage.', en: 'Parents will not be notified outside this time range.' },
  'alerte.debut':            { fr: 'Début',                en: 'Start' },
  'alerte.fin':              { fr: 'Fin',                  en: 'End' },
  'alerte.a':                { fr: 'à',                    en: 'to' },
  'alerte.rayon_titre':      { fr: 'Rayon de proximité GPS', en: 'GPS proximity radius' },
  'alerte.rayon_desc':       { fr: 'Distance en mètres à laquelle le parent est notifié que le bus approche.', en: 'Distance in meters at which the parent is notified the bus is approaching.' },
  'alerte.types_titre':      { fr: "Types d'alertes actives", en: 'Active alert types' },
  'alerte.montee':           { fr: 'Badge montée',         en: 'Boarding badge' },
  'alerte.montee_desc':      { fr: "Notifier le parent quand l'élève badge en montant dans le bus.", en: 'Notify parent when student badges boarding the bus.' },
  'alerte.descente':         { fr: 'Badge descente',       en: 'Alighting badge' },
  'alerte.descente_desc':    { fr: "Notifier le parent quand l'élève badge en descendant du bus.", en: 'Notify parent when student badges leaving the bus.' },
  'alerte.retard':           { fr: 'Retard détecté',       en: 'Delay detected' },
  'alerte.retard_desc':      { fr: "Notifier si le bus n'est pas arrivé à l'heure prévue.", en: 'Notify if the bus has not arrived on time.' },
  'alerte.proximite':        { fr: 'Bus en approche',      en: 'Bus approaching' },
  'alerte.proximite_desc':   { fr: "Notifier le parent quand le bus est à moins de {rayon}m de l'arrêt.", en: 'Notify parent when bus is within {rayon}m of the stop.' },
  'alerte.absence':          { fr: 'Absence',              en: 'Absence' },
  'alerte.absence_desc':     { fr: "Notifier si l'élève n'a pas badgé à la fin de la course.", en: "Notify if student didn't badge by end of ride." },
  'alerte.succes':           { fr: "Préférences d'alertes enregistrées.", en: 'Alert preferences saved.' },

  /* ── Classes ─────────────────────────────────────────────────── */
  'classe.titre':            { fr: 'Classes & Emploi du temps', en: 'Classes & Schedule' },
  'classe.aucune':           { fr: 'Aucune classe trouvée. Ajoutez des élèves avec une classe assignée.', en: 'No classes found. Add students with an assigned class.' },
  'classe.eleve':            { fr: 'élève',                en: 'student' },
  'classe.eleves':           { fr: 'élèves',               en: 'students' },
  'classe.horaires':         { fr: 'Horaires scolaires',   en: 'School schedule' },
  'classe.horaires_desc':    { fr: 'Utilisés pour détecter les retards et déclencher les alertes.', en: 'Used to detect delays and trigger alerts.' },
  'classe.arrivee':          { fr: 'Arrivée matin',        en: 'Morning arrival' },
  'classe.sortie_matin':     { fr: 'Sortie matin',         en: 'Morning dismissal' },
  'classe.reprise_am':       { fr: 'Reprise après-midi',   en: 'Afternoon start' },
  'classe.sortie_am':        { fr: 'Sortie après-midi',    en: 'Afternoon dismissal' },
  'classe.succes':           { fr: 'Horaires enregistrés.', en: 'Schedule saved.' },

  /* ── Mon Compte ──────────────────────────────────────────────── */
  'compte.titre':            { fr: 'Mon Compte',           en: 'My Account' },
  'compte.abonnement':       { fr: 'Abonnement',           en: 'Subscription' },
  'compte.actif':            { fr: 'Actif',                en: 'Active' },
  'compte.essai':            { fr: 'Essai gratuit',        en: 'Free trial' },
  'compte.expire_le':        { fr: 'Expire le',            en: 'Expires on' },
  'compte.infos':            { fr: 'Informations personnelles', en: 'Personal information' },
  'compte.prenom':           { fr: 'Prénom',               en: 'First name' },
  'compte.nom':              { fr: 'Nom',                  en: 'Last name' },
  'compte.email':            { fr: 'Email',                en: 'Email' },
  'compte.profil_succes':    { fr: 'Profil mis à jour.',   en: 'Profile updated.' },
  'compte.profil_erreur':    { fr: 'Erreur lors de la mise à jour.', en: 'Error updating profile.' },
  'compte.mdp_titre':        { fr: 'Changer le mot de passe', en: 'Change password' },
  'compte.mdp_actuel':       { fr: 'Mot de passe actuel',  en: 'Current password' },
  'compte.mdp_nouveau':      { fr: 'Nouveau mot de passe', en: 'New password' },
  'compte.mdp_confirmer':    { fr: 'Confirmer',            en: 'Confirm' },
  'compte.mdp_btn':          { fr: 'Modifier le mot de passe', en: 'Change password' },
  'compte.mdp_pas_identiques': { fr: 'Les mots de passe ne correspondent pas.', en: 'Passwords do not match.' },
  'compte.mdp_trop_court':   { fr: 'Minimum 8 caractères.', en: 'Minimum 8 characters.' },
  'compte.mdp_succes':       { fr: 'Mot de passe modifié.', en: 'Password changed.' },

  /* ── Langue ──────────────────────────────────────────────────── */
  'langue.titre':            { fr: "Langue de l'interface", en: 'Interface language' },
  'langue.description':      { fr: "Choisissez la langue d'affichage de l'application.", en: 'Choose the application display language.' },
  'langue.francais':         { fr: 'Français',             en: 'French' },
  'langue.anglais':          { fr: 'Anglais',              en: 'English' },
  'langue.succes':           { fr: 'Langue mise à jour.',  en: 'Language updated.' },
  'langue.non_assignee':     { fr: 'Non assignée',         en: 'Not assigned' },
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
