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

  /* ── Dashboard ───────────────────────────────────────────────── */
  'dash.titre':              { fr: 'Tableau de bord',      en: 'Dashboard' },
  'dash.bienvenue':          { fr: 'Bienvenue',            en: 'Welcome' },
  'dash.actions_rapides':    { fr: 'Actions rapides',      en: 'Quick actions' },
  'dash.nouveau_bus':        { fr: 'Nouveau bus',          en: 'New bus' },
  'dash.nouveau_chauffeur':  { fr: 'Nouveau chauffeur',    en: 'New driver' },
  'dash.nouvel_eleve':       { fr: 'Nouvel élève',         en: 'New student' },
  'dash.activite_recente':   { fr: 'Activité récente',     en: 'Recent activity' },
  'dash.aucune_activite':    { fr: 'Aucune activité récente', en: 'No recent activity' },
  'dash.voir_tout':          { fr: 'Voir tout',            en: 'View all' },
  'dash.statistiques':       { fr: 'Statistiques',         en: 'Statistics' },
  'dash.vehicules':          { fr: 'Véhicules',            en: 'Vehicles' },
  'dash.chauffeurs':         { fr: 'Chauffeurs',           en: 'Drivers' },
  'dash.parents':            { fr: 'Parents',              en: 'Parents' },
  'dash.eleves':             { fr: 'Élèves',               en: 'Students' },
  'dash.abonnement':         { fr: 'Abonnement',           en: 'Subscription' },
  'dash.actif':              { fr: 'Actif',                en: 'Active' },
  'dash.expire_le':          { fr: 'Expire le',            en: 'Expires on' },
  'dash.renouveler':         { fr: 'Renouveler',           en: 'Renew' },

  /* ── Véhicules (Cars) ────────────────────────────────────────── */
  'cars.titre':              { fr: 'Flotte de véhicules',  en: 'Vehicle fleet' },
  'cars.sous_titre':         { fr: 'Gérez vos bus et minivans', en: 'Manage your buses and minivans' },
  'cars.ajouter':            { fr: 'Ajouter un Véhicule',  en: 'Add Vehicle' },
  'cars.nouveau':            { fr: 'Nouveau Véhicule',     en: 'New Vehicle' },
  'cars.modifier':           { fr: 'Modifier le Véhicule', en: 'Edit Vehicle' },
  'cars.modifier_info':      { fr: 'Modifiez les informations du véhicule.', en: 'Edit vehicle information.' },
  'cars.saisir_info':        { fr: 'Saisissez les informations du véhicule.', en: 'Enter vehicle information.' },
  'cars.supprimer':          { fr: 'Supprimer',            en: 'Delete' },
  'cars.confirmer_suppression': { fr: 'Voulez-vous vraiment supprimer ce véhicule ?', en: 'Do you really want to delete this vehicle?' },
  'cars.immatriculation':    { fr: 'Immatriculation',      en: 'License plate' },
  'cars.marque':             { fr: 'Marque',               en: 'Brand' },
  'cars.modele':             { fr: 'Modèle',               en: 'Model' },
  'cars.capacite':           { fr: 'Capacité',             en: 'Capacity' },
  'cars.capacite_places':    { fr: 'Capacité (Places)',    en: 'Capacity (Seats)' },
  'cars.gps':                { fr: 'GPS Device ID',        en: 'GPS Device ID' },
  'cars.gps_balise':         { fr: 'Balise GPS Associée (optionnel)', en: 'Associated GPS Beacon (optional)' },
  'cars.aucune_balise':      { fr: 'Aucune balise',       en: 'No beacon' },
  'cars.badgeuse':           { fr: 'Badgeuse Associée (optionnel)', en: 'Associated Badge Reader (optional)' },
  'cars.aucune_badgeuse':    { fr: 'Aucune badgeuse',     en: 'No badge reader' },
  'cars.terminal':           { fr: 'Terminal BioTime',     en: 'BioTime Terminal' },
  'cars.aucun':              { fr: 'Aucun Véhicule',       en: 'No Vehicles' },
  'cars.aucun_desc':         { fr: 'Commencez par ajouter des bus ou des minivans à votre flotte.', en: 'Start by adding buses or minivans to your fleet.' },
  'cars.sync_libellule':     { fr: 'Sync. Libellule',      en: 'Sync Libellule' },
  'cars.synchronisation':    { fr: 'Synchronisation...',   en: 'Syncing...' },
  'cars.places':             { fr: 'places',               en: 'seats' },

  /* ── Chauffeurs (Drivers) ────────────────────────────────────── */
  'drivers.titre':           { fr: 'Chauffeurs',           en: 'Drivers' },
  'drivers.ajouter':         { fr: 'Ajouter un chauffeur', en: 'Add driver' },
  'drivers.modifier':        { fr: 'Modifier le chauffeur',en: 'Edit driver' },
  'drivers.supprimer':       { fr: 'Supprimer',            en: 'Delete' },
  'drivers.confirmer_suppression': { fr: 'Voulez-vous vraiment supprimer ce chauffeur ?', en: 'Do you really want to delete this driver?' },
  'drivers.prenom':          { fr: 'Prénom',               en: 'First name' },
  'drivers.nom':             { fr: 'Nom',                  en: 'Last name' },
  'drivers.telephone':       { fr: 'Téléphone',            en: 'Phone' },
  'drivers.permis':          { fr: 'N° Permis',            en: 'License number' },
  'drivers.aucun':           { fr: 'Aucun chauffeur',      en: 'No drivers' },

  /* ── Parents ─────────────────────────────────────────────────── */
  'parents.titre':           { fr: 'Parents',              en: 'Parents' },
  'parents.ajouter':         { fr: 'Ajouter un parent',    en: 'Add parent' },
  'parents.modifier':        { fr: 'Modifier le parent',   en: 'Edit parent' },
  'parents.supprimer':       { fr: 'Supprimer',            en: 'Delete' },
  'parents.confirmer_suppression': { fr: 'Voulez-vous vraiment supprimer ce parent ?', en: 'Do you really want to delete this parent?' },
  'parents.prenom':          { fr: 'Prénom',               en: 'First name' },
  'parents.nom':             { fr: 'Nom',                  en: 'Last name' },
  'parents.telephone':       { fr: 'Téléphone',            en: 'Phone' },
  'parents.email':           { fr: 'Email',                en: 'Email' },
  'parents.aucun':           { fr: 'Aucun parent',         en: 'No parents' },
  'parents.enfants':         { fr: 'enfant(s)',            en: 'child(ren)' },

  /* ── Élèves (Children) ───────────────────────────────────────── */
  'children.titre':          { fr: 'Élèves',               en: 'Students' },
  'children.gestion':        { fr: 'Gestion des Élèves',   en: 'Student Management' },
  'children.sous_titre':     { fr: 'Gérez les élèves, liez-les aux parents et aux cartes BioTime.', en: 'Manage students, link them to parents and BioTime cards.' },
  'children.ajouter':        { fr: 'Nouvel Élève',         en: 'New Student' },
  'children.importer':       { fr: 'Importer',             en: 'Import' },
  'children.inscrire':       { fr: 'Inscrire',             en: 'Enroll' },
  'children.modifier':       { fr: 'Modifier l\'élève',    en: 'Edit student' },
  'children.supprimer':      { fr: 'Supprimer',            en: 'Delete' },
  'children.confirmer_suppression': { fr: 'Voulez-vous vraiment supprimer cet élève ?', en: 'Do you really want to delete this student?' },
  'children.prenom':         { fr: 'Prénom',               en: 'First name' },
  'children.nom':            { fr: 'Nom',                  en: 'Last name' },
  'children.classe':         { fr: 'Classe',               en: 'Class' },
  'children.emp_code':       { fr: 'Code employé',         en: 'Employee code' },
  'children.parent':         { fr: 'Parent',               en: 'Parent' },
  'children.selectionner_parent': { fr: 'Sélectionner un parent', en: 'Select a parent' },
  'children.aucun':          { fr: 'Aucun Élève',          en: 'No Students' },
  'children.aucun_desc':     { fr: 'Commencez par ajouter des élèves manuellement ou importez-les directement depuis votre base de données BioTime.', en: 'Start by adding students manually or import them directly from your BioTime database.' },
  'children.profil':         { fr: 'Profil',               en: 'Profile' },
  'children.rechercher':     { fr: 'Rechercher un élève par nom, classe ou badge...', en: 'Search student by name, class or badge...' },
  'children.rechercher_placeholder': { fr: 'Rechercher…', en: 'Search…' },
  'children.tous':           { fr: 'Tous',                 en: 'All' },
  'children.complets':       { fr: 'Complets',             en: 'Complete' },
  'children.incomplets':     { fr: 'Incomplets',           en: 'Incomplete' },
  'children.inscrit':        { fr: 'inscrit',              en: 'enrolled' },
  'children.inscrits':       { fr: 'inscrits',             en: 'enrolled' },
  'children.resultat':       { fr: 'résultat',             en: 'result' },
  'children.resultats':      { fr: 'résultats',            en: 'results' },
  'children.aucun_trouve':   { fr: 'Aucun élève trouvé',  en: 'No students found' },
  'children.aucun_recherche': { fr: 'Aucun élève ne correspond à votre recherche.', en: 'No students match your search.' },
  'children.aucun_filtre':   { fr: 'Aucun élève ne correspond aux filtres sélectionnés.', en: 'No students match the selected filters.' },
  'children.sync_photos':    { fr: 'Resync photos',        en: 'Resync photos' },
  'children.carte_badge':    { fr: 'Carte/Badge',          en: 'Card/Badge' },
  'children.voir_profil':    { fr: 'Voir le profil',       en: 'View profile' },
  'children.complet':        { fr: 'Complet',              en: 'Complete' },
  'children.incomplet':      { fr: 'Incomplet',            en: 'Incomplete' },
  'children.sans_classe':    { fr: 'Sans Classe',          en: 'No Class' },
  'children.badge':          { fr: 'Badge',                en: 'Badge' },
  'children.non_assigne':    { fr: 'Non assigné',          en: 'Not assigned' },
  'children.modifier_eleve': { fr: 'Modifier l\'élève',    en: 'Edit student' },
  'children.supprimer_eleve':{ fr: 'Supprimer l\'élève',   en: 'Delete student' },

  /* ── Actions communes ─────────────────────────────────────────── */
  'action.ajouter':          { fr: 'Ajouter',              en: 'Add' },
  'action.modifier':         { fr: 'Modifier',             en: 'Edit' },
  'action.supprimer':        { fr: 'Supprimer',            en: 'Delete' },
  'action.annuler':          { fr: 'Annuler',              en: 'Cancel' },
  'action.enregistrer':      { fr: 'Enregistrer',          en: 'Save' },
  'action.fermer':           { fr: 'Fermer',               en: 'Close' },
  'action.rechercher':       { fr: 'Rechercher…',          en: 'Search…' },
  'action.tout_selectionner':{ fr: 'Tout sélectionner',    en: 'Select all' },
  'action.tout_deselectionner':{ fr: 'Tout désélectionner',en: 'Deselect all' },
  'action.importer':         { fr: 'Importer',             en: 'Import' },
  'action.exporter':         { fr: 'Exporter',             en: 'Export' },
  'action.actualiser':       { fr: 'Actualiser',           en: 'Refresh' },

  /* ── Messages ─────────────────────────────────────────────────── */
  'msg.erreur':              { fr: 'Erreur',               en: 'Error' },
  'msg.succes':              { fr: 'Succès',               en: 'Success' },
  'msg.confirmation':        { fr: 'Confirmation',         en: 'Confirmation' },
  'msg.aucun_resultat':      { fr: 'Aucun résultat',       en: 'No results' },
  'msg.chargement':          { fr: 'Chargement…',          en: 'Loading…' },

  /* ── BioTime Employees ───────────────────────────────────────── */
  'biotime.titre':           { fr: 'Annuaire BioTime',     en: 'BioTime Directory' },
  'biotime.sous_titre':      { fr: 'Synchronisez les élèves depuis BioTime', en: 'Sync students from BioTime' },
  'biotime.selectionner':    { fr: 'Sélectionner',         en: 'Select' },
  'biotime.importer':        { fr: 'Importer la sélection', en: 'Import selection' },
  'biotime.importer_court':  { fr: 'Importer',             en: 'Import' },
  'biotime.emp_code':        { fr: 'Code employé',         en: 'Employee code' },
  'biotime.departement':     { fr: 'Département',          en: 'Department' },
  'biotime.rechercher':      { fr: 'Rechercher dans BioTime…', en: 'Search in BioTime…' },
  'biotime.aucun':           { fr: 'Aucun employé trouvé', en: 'No employees found' },
  'biotime.selectionnes':    { fr: 'sélectionné(s)',       en: 'selected' },
  'biotime.sync_photos':     { fr: 'Resynchroniser les photos', en: 'Resync photos' },
  'biotime.import_succes':   { fr: 'élève(s) importé(s) avec succès', en: 'student(s) imported successfully' },
  'biotime.import_erreur':   { fr: 'Erreur lors de l\'importation', en: 'Import error' },

  /* ── BioTime Config ──────────────────────────────────────────── */
  'biotime_cfg.titre':       { fr: 'Configuration BioTime', en: 'BioTime Configuration' },
  'biotime_cfg.sous_titre':  { fr: 'Paramètres de connexion au serveur BioTime', en: 'BioTime server connection settings' },
  'biotime_cfg.url':         { fr: 'URL du serveur',       en: 'Server URL' },
  'biotime_cfg.username':    { fr: 'Nom d\'utilisateur',   en: 'Username' },
  'biotime_cfg.password':    { fr: 'Mot de passe',         en: 'Password' },
  'biotime_cfg.tester':      { fr: 'Tester la connexion',  en: 'Test connection' },
  'biotime_cfg.test_ok':     { fr: 'Connexion réussie !',  en: 'Connection successful!' },
  'biotime_cfg.test_ko':     { fr: 'Échec de la connexion', en: 'Connection failed' },

  /* ── Courses ─────────────────────────────────────────────────── */
  'courses.titre':           { fr: 'Courses',              en: 'Rides' },
  'courses.ajouter':         { fr: 'Nouvelle course',      en: 'New ride' },
  'courses.modifier':        { fr: 'Modifier la course',   en: 'Edit ride' },
  'courses.supprimer':       { fr: 'Supprimer',            en: 'Delete' },
  'courses.date':            { fr: 'Date',                 en: 'Date' },
  'courses.heure':           { fr: 'Heure',                en: 'Time' },
  'courses.trajet':          { fr: 'Trajet',               en: 'Route' },
  'courses.bus':             { fr: 'Bus',                  en: 'Bus' },
  'courses.chauffeur':       { fr: 'Chauffeur',            en: 'Driver' },
  'courses.statut':          { fr: 'Statut',               en: 'Status' },
  'courses.en_cours':        { fr: 'En cours',             en: 'In progress' },
  'courses.terminee':        { fr: 'Terminée',             en: 'Completed' },
  'courses.annulee':         { fr: 'Annulée',              en: 'Cancelled' },
  'courses.planifiee':       { fr: 'Planifiée',            en: 'Scheduled' },
  'courses.aucune':          { fr: 'Aucune course',        en: 'No rides' },

  /* ── Trajets ─────────────────────────────────────────────────── */
  'trajets.titre':           { fr: 'Trajets',              en: 'Routes' },
  'trajets.ajouter':         { fr: 'Nouveau trajet',       en: 'New route' },
  'trajets.modifier':        { fr: 'Modifier le trajet',   en: 'Edit route' },
  'trajets.supprimer':       { fr: 'Supprimer',            en: 'Delete' },
  'trajets.nom':             { fr: 'Nom du trajet',        en: 'Route name' },
  'trajets.type':            { fr: 'Type',                 en: 'Type' },
  'trajets.aller':           { fr: 'Aller (Matin)',        en: 'Outbound (Morning)' },
  'trajets.retour':          { fr: 'Retour (Soir)',        en: 'Return (Evening)' },
  'trajets.points':          { fr: 'Points d\'arrêt',      en: 'Stops' },
  'trajets.aucun':           { fr: 'Aucun trajet',         en: 'No routes' },

  /* ── Affectation ─────────────────────────────────────────────── */
  'affectation.titre':       { fr: 'Affectation des élèves', en: 'Student Assignment' },
  'affectation.sous_titre':  { fr: 'Assignez les élèves aux points d\'arrêt', en: 'Assign students to stops' },
  'affectation.eleve':       { fr: 'Élève',                en: 'Student' },
  'affectation.point':       { fr: 'Point d\'arrêt',       en: 'Stop' },
  'affectation.trajet':      { fr: 'Trajet',               en: 'Route' },
  'affectation.assigner':    { fr: 'Assigner',             en: 'Assign' },
  'affectation.non_assigne': { fr: 'Non assigné',          en: 'Not assigned' },

  /* ── Suivi Montées ───────────────────────────────────────────── */
  'suivi.titre':             { fr: 'Suivi des montées',    en: 'Boarding Tracking' },
  'suivi.sous_titre':        { fr: 'Historique des badgeages', en: 'Badge history' },
  'suivi.date':              { fr: 'Date',                 en: 'Date' },
  'suivi.heure':             { fr: 'Heure',                en: 'Time' },
  'suivi.eleve':             { fr: 'Élève',                en: 'Student' },
  'suivi.sens':              { fr: 'Sens',                 en: 'Direction' },
  'suivi.montee':            { fr: 'Montée',               en: 'Boarding' },
  'suivi.descente':          { fr: 'Descente',             en: 'Alighting' },
  'suivi.statut':            { fr: 'Statut',               en: 'Status' },
  'suivi.valide':            { fr: 'Validé',               en: 'Valid' },
  'suivi.refuse':            { fr: 'Refusé',               en: 'Refused' },
  'suivi.aucun':             { fr: 'Aucun badgeage',       en: 'No badges' },

  /* ── Alertes Transport ───────────────────────────────────────── */
  'alertes_transport.titre': { fr: 'Alertes Transport',    en: 'Transport Alerts' },
  'alertes_transport.toutes':{ fr: 'Toutes',               en: 'All' },
  'alertes_transport.critiques': { fr: 'Critiques',        en: 'Critical' },
  'alertes_transport.info':  { fr: 'Infos',                en: 'Info' },
  'alertes_transport.aucune':{ fr: 'Aucune alerte',        en: 'No alerts' },
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
