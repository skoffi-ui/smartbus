# Faire tourner SMARTBUS pour une démonstration

Procédure de mise en route locale et déroulé conseillé. Comptez 5 minutes
d'installation avant de commencer à montrer quoi que ce soit.

## Avant de commencer

PostgreSQL et Redis doivent tourner. Si vous utilisez le `docker-compose.yml`
du dépôt :

```bash
docker compose up -d
```

Le fichier `.env` doit exister à la racine. Deux variables refusent désormais
toute valeur par défaut, et un service sans elles ne démarre pas :

| Variable | Rôle |
|---|---|
| `JWT_SECRET` | Signature des jetons. 32 caractères minimum. |
| `INTERNAL_API_KEY` | Secret des appels entre la super-app et l'app école. |

## 1. Démarrer les services

Cinq fenêtres de terminal, dans cet ordre. Attendez que chacune affiche sa
ligne de démarrage avant de lancer la suivante.

```bash
# Fenêtre 1 — Serveur BioTime FICTIF (port 4010) — voir encadré ci-dessous
npm run demo:biotime-serveur

# Fenêtre 2 — Super App (port 3000)
npm run build super-app && node dist/apps/super-app/main.js

# Fenêtre 3 — App École (port 3001)
npm run build school-app && node dist/apps/school-app/main.js

# Fenêtre 4 — API Gateway (port 3002) — la seule porte d'entrée
npm run build api-gateway && node dist/apps/api-gateway/main.js

# Fenêtre 5 — Interface École (port 5174)
cd apps/school-web && npx vite
```

> **Serveur BioTime central : FICTIF, temporairement.** Le vrai serveur est
> HS. `npm run demo:biotime-serveur` en fait tourner un faux à la place —
> même API (créer un département, un élève, lister les badgeuses...), aucune
> vraie donnée. `.env` (`BIOTIME_CENTRAL_URL=http://localhost:4010`) pointe
> déjà vers lui ; c'est pour ça qu'il doit démarrer **avant** la super-app.
> Sans lui, la création d'une école ou d'un élève échouera avec une erreur
> BioTime. Une fois le vrai serveur rétabli : remplacez ces deux lignes de
> `.env` par ses vraies coordonnées, redémarrez la super-app, et vous pouvez
> arrêter cette fenêtre — rien d'autre à changer dans le code.

Les ports 3000 et 3001 n'écoutent que sur `127.0.0.1` : c'est voulu, la gateway
est le seul point d'entrée réseau. Tout passe par le port 3002.

Vérification rapide :

```bash
curl http://localhost:3002/health
```

## 2. Préparer les données

À ne faire qu'une fois, sauf si vous repartez d'une base vierge.

```bash
npm run demo:peupler    # 3 trajets, 17 points, 3 courses, 12 élèves, 7 jours d'historique
npm run demo:balises    # rattache les balises GPS des véhicules à l'école
npm run demo:biotime    # département, badgeuses et statut de synchro BioTime — fictifs
```

Les trois scripts sont idempotents : les relancer n'écrase rien d'existant.
Ils ciblent la première école de la base centrale — pour en viser une autre,
passez son code : `DEMO_ORG_CODE=NNG-3146 npm run demo:peupler`.

`demo:biotime` n'appelle jamais de serveur BioTime (fictif ou réel) — il
écrit directement en base un département, 3 badgeuses et un statut de
synchro pour les élèves déjà créés par `demo:peupler`, pour peupler d'un
coup les écrans (Réglages École, Gestion BioTime centralisée) sans repasser
par chaque élève un par un. Tout ce qu'il crée est visiblement préfixé
`[DÉMO]`/`DEMO-`.

Pour toute action faite *pendant* la démo (créer une école, ajouter un
élève...), c'est le serveur fictif de la fenêtre 1 qui répond réellement,
en HTTP, comme le ferait le vrai serveur — à dire clairement si la question
vient : les identifiants BioTime qui s'affichent alors sont fictifs, mais le
mécanisme de bout en bout (l'appel réseau, la création du département/élève,
le retour du statut) est authentique.

## 3. Faire rouler les bus

**À lancer juste avant la démonstration, et à laisser tourner pendant.**

```bash
npm run demo:gps
```

Les quatre véhicules avancent le long de leur trajet et envoient une position
toutes les 4 secondes, par le même chemin d'ingestion que des balises réelles.
Pour ralentir : `npm run demo:gps -- 8`. `Ctrl+C` pour arrêter.

Sans ce simulateur, la carte de suivi affiche « Aucun bus en service » — ce qui
est exact : aucune balise n'émet.

## 4. Se connecter

<http://localhost:5174> — compte école :

```
direction@gmail.com
Smartbus@Demo2026
```

**Changez ce mot de passe après la démonstration.**

## Déroulé conseillé

L'ordre compte : il raconte le produit du général au détail.

1. **Vue d'ensemble** — les compteurs de l'établissement et l'activité récente
   des badgeages. Pose le décor en dix secondes.
2. **Live Tracking** — les quatre bus qui se déplacent sur Abidjan. C'est le
   moment fort ; laissez la carte respirer quelques secondes.
3. **Trajets** — choisissez « Aller Matin — Riviera / Cocody » dans le menu
   déroulant. Les points typés s'affichent avec le tracé et les statistiques.
   *La page s'ouvre en mode création : sans sélection, elle montre 0 km, ce qui
   est normal.*
4. **Courses** — la planification qui relie un trajet, un véhicule et un
   chauffeur, avec ses horaires et ses jours.
5. **Affectation des élèves** — choisissez une course, puis un arrêt, pour
   montrer qui monte où. *Deux étapes obligatoires : le panneau de droite reste
   vide jusqu'à la sélection d'un arrêt.*
6. **Suivi des montées** — l'historique réel, avec les badgeages refusés.
7. **Centre d'Alertes** — les anomalies détectées : mauvais arrêt, mauvais
   véhicule, badgeage hors horaire.

## Si quelque chose ne va pas

**« Aucun bus en service » sur la carte** — le simulateur n'est pas lancé, ou la
super-app a redémarré. Les positions vivent en mémoire du processus : un
redémarrage les efface. Relancez `npm run demo:gps`.

**Erreurs 502 dans la console du navigateur** — la gateway ne joint pas un
service. Vérifiez que les fenêtres 2 et 3 tournent toujours.

**Création d'école ou d'élève qui échoue avec une erreur BioTime** — le
serveur fictif (fenêtre 1) n'est pas lancé, ou a démarré après la super-app.
Lancez/relancez-le, puis redémarrez la super-app.

**Erreurs 401 partout** — jeton expiré ou secret changé. Déconnectez-vous et
reconnectez-vous.

**Un service refuse de démarrer en parlant de `JWT_SECRET`** — la variable est
absente ou trop courte. C'est un garde-fou volontaire : il n'existe pas de
valeur de repli sûre pour un secret de signature.

## Ce qui n'est pas dans cette démonstration

À dire si la question vient, plutôt que de laisser croire que c'est fini :

- Le **portail parent** et l'**application chauffeur** ne sont pas commencés.
- Le paiement **CinetPay** est un guichet simulé.
- Le calcul d'itinéraire OSRM **d'un nouveau trajet dessiné à la main** ne
  renvoie pas encore ses statistiques ; les trajets enregistrés affichent bien
  les leurs.
- L'ingestion matérielle (balises, badgeuses) n'est pas encore authentifiée
  appareil par appareil.
- Le **vrai** serveur BioTime central n'est pas fonctionnel. Un serveur
  fictif tourne à la place (`npm run demo:biotime-serveur`, voir plus haut) :
  les identifiants (département, élève) qu'il renvoie sont inventés, mais
  chaque appel réseau est réel. À remplacer par les vraies coordonnées dans
  `.env` dès que le serveur réel est rétabli — aucun autre changement requis.
