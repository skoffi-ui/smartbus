# Configuration BioTime Central - Guide de Démarrage

## ✅ Étapes Complétées

- [x] Migrations database exécutées
- [x] Structure de base de données créée
- [x] Variables d'environnement configurées
- [x] Interface Super Admin créée

## 🔧 Configuration Requise

### 1. Obtenir le Token API BioTime

Connectez-vous à votre serveur BioTime central :

1. **Interface Web BioTime** → `http://160.120.143.20:8080`
2. **Personnel** → **API Tokens**
3. **Créer un nouveau token** ou copier le token existant
4. Copier le token généré

### 2. Configurer les Variables d'Environnement

Éditez le fichier `.env` à la racine du projet :

```bash
# BioTime Central Server
BIOTIME_CENTRAL_URL=http://160.120.143.20:8080
BIOTIME_CENTRAL_TOKEN=VOTRE_TOKEN_ICI
```

### 3. Redémarrer les Applications

```bash
# Arrêter les applications
# Ctrl+C dans les terminaux

# Redémarrer Super App
npm run start:super

# Redémarrer School App
npm run start:school
```

## 🚀 Workflow de Test

### Étape 1 : Créer un Département pour une École

1. Accédez à l'interface Super Admin : `http://localhost:5173`
2. Menu **BioTime Centrale**
3. Onglet **Départements**
4. Cliquez sur **Créer un département**
5. Sélectionnez une organisation (école)
6. Confirmer

**Résultat attendu** : Le département BioTime est créé avec l'ID et nom affichés

### Étape 2 : Synchroniser les Terminaux

1. Onglet **Terminaux**
2. Cliquez sur **Synchroniser depuis BioTime**
3. Attendez la confirmation

**Résultat attendu** : Liste des terminaux disponibles affichée

### Étape 3 : Assigner un Terminal

1. Dans la liste des **Terminaux disponibles**
2. Cliquez sur **Assigner à une école**
3. Sélectionnez l'organisation
4. (Optionnel) Personnaliser le nom du terminal
5. Confirmer

**Résultat attendu** : Terminal déplacé dans la liste **Terminaux assignés**

### Étape 4 : Créer un Élève

1. Connectez-vous à l'interface école : `http://localhost:5174`
2. Menu **Élèves** → **Ajouter un élève**
3. Remplissez les informations :
   - Prénom, Nom
   - Date de naissance
   - Classe
   - **Important** : Un `empCode` sera généré automatiquement
4. Enregistrer

**Résultat attendu** :
- L'élève est créé localement
- `biotimeSyncStatus` = PENDING
- Synchronisation automatique vers BioTime central
- `biotimeDepartmentId` rempli après sync réussie
- `biotimeSyncStatus` = SYNCED

### Étape 5 : Vérifier la Synchronisation

**Option A : Via Interface Super Admin**
1. **BioTime Centrale** → Onglet **Terminaux**
2. Cliquer sur une organisation
3. **Récupérer les transactions récentes**

**Option B : Via API**
```bash
curl -X GET http://localhost:3000/api/v1/admin/biotime/organisations/{orgId}/transactions/recent \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Résultat attendu** : Transactions filtrées par département de l'organisation

## 🔍 Vérifications

### Vérifier les Migrations

```bash
npm run migration:central:show
```

**Attendu** : Toutes les migrations marquées [X]

```
[X] 1 CreateTenantSchemaVersion1721140000000
[X] 2 CreateHardwareDevices1721140000001
[X] 3 AddPendingSubscriptionStatus1721140000002
[X] 4 BiotimeParEcole1721140000003
[X] 5 AddBiotimeTerminals1727100000000
[X] 6 UpdateOrganisationBiotime1727100000001
[X] 7 UpdateCarBiotimeTerminal1727100000002
```

### Vérifier les Tables

```sql
-- Table biotime_terminals
SELECT * FROM biotime_terminals;

-- Colonnes BioTime dans organisations
SELECT id, name, biotime_department_id, biotime_department_name
FROM organisations
WHERE biotime_department_id IS NOT NULL;

-- Colonnes BioTime dans children (tenant DB)
-- Accéder via l'application school-app
```

## 🐛 Résolution de Problèmes

### Erreur : "BIOTIME_CENTRAL_TOKEN not configured"

**Solution** : Vérifier que le token est bien dans `.env` et redémarrer l'app

### Erreur : "Failed to create department"

**Causes possibles** :
1. Token BioTime invalide ou expiré
2. Serveur BioTime inaccessible
3. Organisation a déjà un département

**Debug** :
```bash
# Tester la connexion au serveur BioTime
curl http://160.120.143.20:8080/iclock/api/departments/ \
  -H "Authorization: Token VOTRE_TOKEN"
```

### Erreur : "Terminal not found"

**Solution** :
1. Synchroniser les terminaux depuis BioTime
2. Vérifier que le terminal existe sur le serveur BioTime
3. Vérifier le numéro de série

### Les Élèves ne se Synchronisent Pas

**Vérifications** :
1. L'organisation a un `biotimeDepartmentId` ?
2. Le token BioTime est valide ?
3. Logs de l'application :
```bash
# Dans le terminal de super-app
# Rechercher "[BioTime→Central]"
```

## 📊 Architecture Finale

```
┌─────────────────────────────────────────────┐
│     Serveur BioTime Central                 │
│     http://160.120.143.20:8080              │
│                                             │
│  ├─ Département A (École Nangui Abrogoua) │
│  │   └─ Élèves : EMP001, EMP002...        │
│  │                                          │
│  ├─ Département B (École Sainte Marie)    │
│  │   └─ Élèves : EMP101, EMP102...        │
│  │                                          │
│  └─ Terminaux                              │
│      ├─ SN001 → École A                    │
│      ├─ SN002 → École A                    │
│      ├─ SN003 → École B                    │
│      └─ SN004 (Disponible)                │
└─────────────────────────────────────────────┘
```

## 📝 Notes Importantes

### Isolation des Données

- Chaque école voit UNIQUEMENT ses propres élèves et transactions
- Le filtrage par `biotimeDepartmentId` est automatique
- Les terminaux peuvent être réassignés entre écoles

### Backward Compatibility

- Les anciennes écoles (per-school) continuent de fonctionner
- Détection automatique : si `biotimeDepartmentId` existe → central, sinon → per-school
- Migration progressive possible

### Sécurité

- Tous les endpoints Admin requièrent le rôle `SUPER_ADMIN`
- Token BioTime stocké de manière sécurisée
- Authentification JWT obligatoire

## 🎯 Prochaines Étapes Recommandées

1. ✅ **Tester le workflow complet** (ci-dessus)
2. [ ] Former les administrateurs sur l'interface BioTime Centrale
3. [ ] Migrer les écoles existantes vers architecture centralisée
4. [ ] Configurer monitoring/alertes pour serveur BioTime
5. [ ] Documenter procédures d'onboarding nouvelle école
6. [ ] Planifier sauvegarde/restauration données BioTime

## 📞 Support

En cas de problème :
1. Vérifier les logs de l'application
2. Tester connexion serveur BioTime directement
3. Vérifier les migrations database
4. Consulter README_API.md pour détails endpoints

---

**Architecture créée le** : 2026-09-25  
**Version** : 1.0.0 - Multi-Tenant Centralisé
