# SMARTBUS Parent

Application mobile (React Native / Expo) permettant à un parent de suivre le
transport scolaire de son ou ses enfants : connexion, liste des enfants avec
leur arrêt/ligne de bus, notifications (pointage badgeuse, approche du bus).

Fait partie du monorepo `smart-bus-app`, mais reste un projet Expo autonome
(son propre `package.json`/`node_modules`, comme `school-web` et
`super-admin-web`) — ce monorepo n'utilise pas de workspaces npm.

## Backend

Consomme l'API Gateway existante (`apps/api-gateway`, port 3002 par défaut),
qui route déjà tout `parent/*` et `auth/parent/login` vers le module
`apps/super-app/src/modules/parent-portal/`. Aucune configuration
supplémentaire côté gateway.

## Démarrer en dev

1. Les 3 backends (`super-app`, `school-app`, `api-gateway`) doivent tourner
   (voir `DEMO.md` à la racine du dépôt).
2. Copier `.env.example` en `.env` et renseigner `EXPO_PUBLIC_API_URL` avec
   l'**IP LAN** de la machine de dev (pas `localhost` — Expo Go tourne sur un
   appareil/émulateur séparé).
3. `npm install` puis `npx expo start`.
4. Scanner le QR code avec l'app **Expo Go** (Android) sur un téléphone
   connecté au même réseau, ou `npx expo start --android` avec un émulateur.

## Compte de test

Aucun parent réel n'existe encore dans les bases école — il faut en créer un
directement en base pour tester (table `parents` de la base de l'école
concernée, `pin_code` en clair sur 4 chiffres) tant qu'aucune interface
d'inscription des parents n'existe côté école.

## Limites connues de la V1

- Pas de suivi live sur carte (explicitement hors périmètre V1).
- Pas de jeton de rafraîchissement côté parent (`POST auth/parent/login` ne
  renvoie qu'un jeton d'accès, valable `JWT_EXPIRES_IN`, 7 jours par défaut) —
  une session expirée renvoie simplement à l'écran de connexion.
- Notifications push : le token FCM natif (`getDevicePushTokenAsync`) est
  envoyé au backend, qui utilise déjà Firebase Admin SDK pour l'envoi réel.
  Fonctionne sur Android dès que les vraies clés Firebase sont configurées
  côté `super-app` (`.env`, voir roadmap précédente). Le push iOS réel exige
  en plus la configuration APNs dans la console Firebase — dépendance
  externe, indépendante du code de cette app.

Voir `AGENTS.md` pour les conventions Expo (routage par fichiers, `expo
install`, etc.) à suivre dans ce projet.
