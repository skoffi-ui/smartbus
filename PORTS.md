# SMARTBUS - Architecture des Ports

> **Source unique de verite** : /.env a la racine du projet.
> Ne jamais coder un port en dur dans le code source.

---

## Table des ports

| Service         | Port     | Type                           | URL locale                 |
| --------------- | -------- | ------------------------------ | -------------------------- |
| api-gateway     | **3002** | NestJS (point d'entree unique) | http://localhost:3002      |
| super-app       | **3000** | NestJS API (backend admin)     | http://localhost:3000      |
| school-app      | **3001** | NestJS API (backend ecole)     | http://localhost:3001      |
| super-admin-web | **5173** | Vite React (frontend admin)    | http://localhost:5173      |
| school-web      | **5174** | Vite React (frontend ecole)    | http://localhost:5174      |
| PostgreSQL      | **5432** | Base de donnees                | localhost:5432             |
| MinIO           | **9000** | Stockage fichiers              | http://localhost:9000      |
| BioTime         | **8080** | Biometrie (externe)            | http://160.120.143.20:8080 |

---

## Connexions entre services

```
super-admin-web (5173) --+
                         +--> api-gateway (3002) --JWT + statut ecole--> super-app (3000)
    school-web (5174) ---+                        \--------------------> school-app (3001)
   school-app (3001)  --auth calls-->   super-app (3000)
   super-app (3000)  --provision-->    school-app DBs (PostgreSQL)
```

Les frontends ne parlent qu'a l'API Gateway. Elle :

- verifie le JWT et **ecrase** tout `x-tenant-id` / `x-user-*` envoye par le client ;
- injecte `x-tenant-id` (organisation du JWT) vers school-app ;
- refuse (403) les ecoles suspendues sur les routes ecole (la SUPER APP reste accessible pour payer) ;
- refuse (426) une `x-app-version` inferieure a `APP_MIN_VERSION` ;
- n'expose que les routes declarees dans `apps/api-gateway/src/route-table.ts` (404 sinon).

---

## Swagger API Docs

| Service    | URL Swagger                    |
| ---------- | ------------------------------ |
| super-app  | http://localhost:3000/api/docs |
| school-app | http://localhost:3001/api/docs |

---

## Commandes de demarrage

### Backends (depuis la racine du projet)

```bash
# Super App (backend admin) - port 3000
npm run start:super-app

# School App (backend ecole) - port 3001
npm run start:school-app
```

### Frontends (depuis leur dossier respectif)

```bash
# Super Admin Web - port 5173
cd apps/super-admin-web && npm run dev

# School Web - port 5174
cd apps/school-web && npm run dev
```

### Tout demarrer (4 terminaux)

| Terminal | Commande                           | URL   |
| -------- | ---------------------------------- | ----- |
| 1        | npm run start:super-app (racine)   | :3000 |
| 2        | npm run start:school-app (racine)  | :3001 |
| 3        | npm run dev (apps/super-admin-web) | :5173 |
| 4        | npm run dev (apps/school-web)      | :5174 |

---

## Configuration des ports

Les ports sont definis dans UN SEUL endroit : le fichier .env a la racine.

```env
# Backends NestJS
SUPER_APP_PORT=3000
SCHOOL_APP_PORT=3001

# Frontends Vite
VITE_SUPER_ADMIN_PORT=5173
VITE_SCHOOL_WEB_PORT=5174
```

> REGLE : Ne jamais definir un port dans un .env local d une app.
> Modifiez toujours le .env racine.

---

## Regles a respecter

1. Un seul .env racine pour les ports - pas de duplication dans les sous-dossiers
2. strictPort: true dans les configs Vite - evite les ports aleatoires silencieux
3. Variables d env dans les main.ts - jamais de port code en dur
4. Scripts npm nommes clairement : start:super-app, start:school-app
