# API BioTime Admin - Documentation

API REST pour la gestion centralisée du serveur BioTime dans l'architecture multi-tenant SMARTBUS.

## 🔐 Authentification

Tous les endpoints nécessitent :

- **Bearer Token JWT** dans le header `Authorization`
- **Rôle SUPER_ADMIN**

```http
Authorization: Bearer <votre_token_jwt>
```

## 📋 Base URL

```
POST   /admin/biotime/**
GET    /admin/biotime/**
DELETE /admin/biotime/**
```

---

## 🏢 Gestion des Départements

### Créer un département BioTime pour une organisation

Crée un département sur le serveur BioTime central et l'associe à une organisation.  
**1 organisation = 1 département BioTime** pour l'isolation des données.

```http
POST /admin/biotime/departments/create
Content-Type: application/json

{
  "organisationId": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Réponse (201):**

```json
{
  "message": "Department created successfully",
  "organisation": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "École Nangui Abrogoua",
    "biotimeDepartmentId": 5,
    "biotimeDepartmentName": "École Nangui Abrogoua"
  }
}
```

**Erreurs:**

- `400` : Organisation a déjà un département
- `404` : Organisation non trouvée

---

### Lister tous les départements BioTime

Récupère tous les départements du serveur BioTime central.

```http
GET /admin/biotime/departments
```

**Réponse (200):**

```json
[
  {
    "id": 5,
    "dept_name": "École Nangui Abrogoua",
    "dept_code": "nangui-abrogoua",
    "parent": null
  },
  {
    "id": 6,
    "dept_name": "École Sainte Marie",
    "dept_code": "sainte-marie",
    "parent": null
  }
]
```

---

## 📟 Gestion des Terminaux (Badgeuses)

### Lister les terminaux disponibles (non assignés)

Retourne tous les terminaux qui peuvent être assignés à une école.

```http
GET /admin/biotime/terminals/available
```

**Réponse (200):**

```json
[
  {
    "id": "uuid-terminal-1",
    "serialNumber": "SN001",
    "terminalName": "Terminal SN001",
    "biotimeTerminalId": 12,
    "ipAddress": "192.168.1.100",
    "model": "ZKTeco F18",
    "status": "ACTIVE",
    "organisationId": null,
    "lastSyncAt": null,
    "createdAt": "2026-09-25T10:00:00Z"
  }
]
```

---

### Récupérer tous les terminaux du serveur BioTime

Interroge directement le serveur BioTime (liste complète).

```http
GET /admin/biotime/terminals/all-from-server
```

**Réponse (200):**

```json
[
  {
    "id": 12,
    "sn": "SN001",
    "alias": "Badgeuse Bus 1",
    "terminal_name": "ZKTeco F18",
    "ip_address": "192.168.1.100",
    "state": 1
  }
]
```

---

### Synchroniser les terminaux depuis BioTime

Récupère tous les terminaux du serveur BioTime et synchronise avec la DB locale.

```http
POST /admin/biotime/terminals/sync
```

**Réponse (200):**

```json
{
  "synced": 15,
  "created": 5,
  "updated": 10
}
```

---

### Assigner un terminal à une organisation

Affecte un terminal (badgeuse) à une école spécifique.

```http
POST /admin/biotime/terminals/assign
Content-Type: application/json

{
  "serialNumber": "SN001",
  "organisationId": "123e4567-e89b-12d3-a456-426614174000",
  "terminalName": "Badgeuse Bus 1 - École Nangui"
}
```

**Paramètres:**

- `serialNumber` **(requis)** : Numéro de série du terminal
- `organisationId` **(requis)** : UUID de l'organisation
- `terminalName` _(optionnel)_ : Nom personnalisé

**Réponse (200):**

```json
{
  "message": "Terminal assigned successfully",
  "terminal": {
    "id": "uuid-terminal-1",
    "serialNumber": "SN001",
    "terminalName": "Badgeuse Bus 1 - École Nangui",
    "status": "ACTIVE",
    "organisationId": "123e4567-e89b-12d3-a456-426614174000"
  }
}
```

**Erreurs:**

- `404` : Terminal ou organisation non trouvé(e)

---

### Désassigner un terminal

Libère un terminal pour le rendre disponible.

```http
DELETE /admin/biotime/terminals/:id/unassign
```

**Paramètres URL:**

- `:id` : UUID du terminal

**Réponse (200):**

```json
{
  "message": "Terminal unassigned successfully"
}
```

**Erreurs:**

- `404` : Terminal non trouvé

---

### Lister les terminaux d'une organisation

Retourne tous les terminaux assignés à une école.

```http
GET /admin/biotime/organisations/:orgId/terminals
```

**Paramètres URL:**

- `:orgId` : UUID de l'organisation

**Réponse (200):**

```json
[
  {
    "id": "uuid-terminal-1",
    "serialNumber": "SN001",
    "terminalName": "Badgeuse Bus 1 - École Nangui",
    "biotimeTerminalId": 12,
    "ipAddress": "192.168.1.100",
    "model": "ZKTeco F18",
    "status": "ACTIVE",
    "organisationId": "123e4567-e89b-12d3-a456-426614174000",
    "organisation": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "École Nangui Abrogoua",
      "code": "nangui-abrogoua"
    }
  }
]
```

---

### Récupérer un terminal par numéro de série

```http
GET /admin/biotime/terminals/:serialNumber
```

**Paramètres URL:**

- `:serialNumber` : Numéro de série du terminal (ex: SN001)

**Réponse (200):**

```json
{
  "id": "uuid-terminal-1",
  "serialNumber": "SN001",
  "terminalName": "Badgeuse Bus 1 - École Nangui",
  "biotimeTerminalId": 12,
  "ipAddress": "192.168.1.100",
  "model": "ZKTeco F18",
  "status": "ACTIVE",
  "organisationId": "123e4567-e89b-12d3-a456-426614174000",
  "organisation": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "École Nangui Abrogoua"
  }
}
```

**Erreurs:**

- `404` : Terminal non trouvé

---

## 📊 Transactions (Pointages)

### Récupérer les transactions récentes d'une organisation

Retourne les 100 dernières transactions, filtrées par le département BioTime de l'organisation.

```http
GET /admin/biotime/organisations/:orgId/transactions/recent
```

**Paramètres URL:**

- `:orgId` : UUID de l'organisation

**Réponse (200):**

```json
[
  {
    "id": 12345,
    "emp_code": "EMP001",
    "punch_time": "2026-09-25T08:30:00Z",
    "terminal_sn": "SN001",
    "department": 5
  }
]
```

**Erreurs:**

- `404` : Organisation non trouvée ou sans département BioTime

---

## 🔄 Workflow Typique

### 1. Onboarding d'une nouvelle école

```javascript
// Étape 1 : Créer le département BioTime
POST /admin/biotime/departments/create
{
  "organisationId": "org-uuid"
}

// Étape 2 : Synchroniser les terminaux disponibles
POST /admin/biotime/terminals/sync

// Étape 3 : Lister les terminaux disponibles
GET /admin/biotime/terminals/available

// Étape 4 : Assigner des terminaux à l'école
POST /admin/biotime/terminals/assign
{
  "serialNumber": "SN001",
  "organisationId": "org-uuid",
  "terminalName": "Badgeuse Bus 1"
}

// Étape 5 : Vérifier l'assignation
GET /admin/biotime/organisations/org-uuid/terminals
```

### 2. Réaffecter un terminal à une autre école

```javascript
// Étape 1 : Désassigner le terminal
DELETE /admin/biotime/terminals/terminal-uuid/unassign

// Étape 2 : L'assigner à la nouvelle école
POST /admin/biotime/terminals/assign
{
  "serialNumber": "SN001",
  "organisationId": "new-org-uuid"
}
```

---

## 📱 Exemples avec cURL

### Créer un département

```bash
curl -X POST http://localhost:3001/admin/biotime/departments/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"organisationId":"123e4567-e89b-12d3-a456-426614174000"}'
```

### Assigner un terminal

```bash
curl -X POST http://localhost:3001/admin/biotime/terminals/assign \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "serialNumber": "SN001",
    "organisationId": "123e4567-e89b-12d3-a456-426614174000",
    "terminalName": "Badgeuse Bus 1 - École Nangui"
  }'
```

### Lister les terminaux d'une école

```bash
curl -X GET http://localhost:3001/admin/biotime/organisations/123e4567-e89b-12d3-a456-426614174000/terminals \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🔍 Swagger UI

Documentation interactive disponible sur :

```
http://localhost:3001/api
```

**Tag : BioTime Admin**

---

## ⚙️ Configuration Requise

Variables d'environnement nécessaires dans `.env` :

```env
# Serveur BioTime Central
BIOTIME_CENTRAL_URL=https://biotime.votredomaine.com
BIOTIME_CENTRAL_TOKEN=your_biotime_api_token
```

---

## 🛡️ Sécurité

- ✅ Authentification JWT obligatoire
- ✅ Rôle SUPER_ADMIN requis
- ✅ Validation des DTOs avec class-validator
- ✅ Isolation des données par département BioTime
- ✅ Logs d'audit recommandés

---

## 📌 Notes Importantes

1. **1 Organisation = 1 Département BioTime**  
   Chaque école a son propre département pour isoler les données.

2. **Terminaux Exclusifs**  
   Un terminal ne peut être assigné qu'à UNE seule organisation à la fois.

3. **Synchronisation**  
   Exécuter `/terminals/sync` régulièrement pour maintenir la liste à jour.

4. **Transactions Filtrées**  
   Les pointages sont automatiquement filtrés par le département de l'organisation.

---

## 🚀 Prochaines Étapes

- [ ] Interface Super Admin Web (React)
- [ ] Webhook pour notifications en temps réel
- [ ] Monitoring du statut des terminaux
- [ ] Logs d'audit détaillés
