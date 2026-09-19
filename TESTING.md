# 🧪 Stratégie de Tests SMARTBUS

> Documentation complète de l'approche de test pour le projet SMARTBUS

---

## Table des Matières

- [Vue d'ensemble](#vue-densemble)
- [Architecture des tests](#architecture-des-tests)
- [Configuration](#configuration)
- [Types de tests](#types-de-tests)
- [Commandes](#commandes)
- [Conventions](#conventions)
- [Bonnes pratiques](#bonnes-pratiques)
- [Couverture de code](#couverture-de-code)
- [CI/CD](#cicd)
- [Dépannage](#dépannage)

---

## Vue d'ensemble

SMARTBUS utilise **Jest** comme framework de test principal pour les tests unitaires et End-to-End (E2E). L'approche de test suit la pyramide de tests :

```
           /\
          /  \    E2E Tests (10%)
         /    \   Integration Tests (20%)
        /------\  Unit Tests (70%)
       /________\
```

### Objectifs

- ✅ **Couverture minimale** : 70% (branches, functions, lines, statements)
- ✅ **Détection précoce** : Catch bugs avant production
- ✅ **Documentation vivante** : Les tests documentent le comportement
- ✅ **Refactoring sûr** : Permettre les changements sans régression
- ✅ **Qualité continue** : Intégration CI/CD

---

## Architecture des tests

```
SMARTBUS_project/
├── jest.config.ts                    # Configuration principale Jest
├── jest-e2e.config.ts                # Configuration E2E Jest
├── .env.test                         # Variables d'environnement test
├── test/
│   ├── setup.ts                      # Setup global des tests
│   ├── helpers/
│   │   ├── test-database.helper.ts   # Helpers base de données
│   │   └── test-fixtures.ts          # Fixtures et mocks réutilisables
│   ├── super-app/
│   │   ├── auth.e2e-spec.ts         # Tests E2E authentification
│   │   └── organisations.e2e-spec.ts # Tests E2E organisations
│   └── school-app/
│       ├── courses.e2e-spec.ts      # Tests E2E courses
│       └── children.e2e-spec.ts     # Tests E2E enfants
└── apps/
    ├── super-app/src/modules/
    │   └── auth/
    │       ├── auth.service.ts
    │       └── auth.service.spec.ts  # Tests unitaires
    └── school-app/src/modules/
        ├── courses/
        │   ├── courses.service.ts
        │   └── courses.service.spec.ts
        └── children/
            ├── children.service.ts
            └── children.service.spec.ts
```

---

## Configuration

### Configuration Jest Principale ([jest.config.ts](jest.config.ts))

```typescript
// Tests unitaires uniquement (*.spec.ts)
// Exclut: DTOs, entities, interfaces, modules
// Couverture: 70% minimum
// Timeout: 30 secondes
```

### Configuration E2E ([jest-e2e.config.ts](jest-e2e.config.ts))

```typescript
// Tests E2E (*.e2e-spec.ts)
// Timeout: 60 secondes
// detectOpenHandles: true
// forceExit: true
```

### Variables d'Environnement Test ([.env.test](.env.test))

```env
NODE_ENV=test
DB_DATABASE=smartbus_test
SUPER_APP_PORT=3100  # Évite conflits avec dev
SCHOOL_APP_PORT=3101
REDIS_DB=1           # DB Redis dédiée aux tests
```

⚠️ **Important** : Les tests utilisent des ports différents pour éviter les conflits avec l'environnement de développement.

---

## Types de tests

### 1. Tests Unitaires (Unit Tests)

**Objectif** : Tester les services, helpers, et logique métier en isolation.

**Caractéristiques** :
- ✅ Rapides (< 100ms par test)
- ✅ Isolés (mocks pour dépendances externes)
- ✅ Couvrent la logique métier complexe
- ✅ Pas d'I/O réseau ou base de données

**Exemple** : [courses.service.spec.ts](apps/school-app/src/modules/courses/courses.service.spec.ts)

```typescript
describe('CoursesService', () => {
  let service: CoursesService;
  let mockRepository: jest.Mocked<Repository<Course>>;

  beforeEach(async () => {
    // Setup avec mocks
    mockRepository = { find: jest.fn(), save: jest.fn() } as any;
    // ...
  });

  it('should create a course', async () => {
    mockRepository.save.mockResolvedValue(mockCourse);
    const result = await service.create(createDto);
    expect(result).toEqual(mockCourse);
  });
});
```

**Commande** :
```bash
npm run test:unit
```

### 2. Tests E2E (End-to-End)

**Objectif** : Tester les endpoints API avec une vraie base de données.

**Caractéristiques** :
- ✅ Testent le flow complet HTTP → Service → DB
- ✅ Utilisent une base de données test
- ✅ Vérifient les codes HTTP et la structure des réponses
- ✅ Plus lents mais plus réalistes

**Exemple** : [auth.e2e-spec.ts](test/super-app/auth.e2e-spec.ts)

```typescript
describe('Auth API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Créer l'app NestJS complète
    const module = await Test.createTestingModule({
      imports: [SuperAppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  it('/api/v1/auth/login (POST)', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'test@test.com', password: 'pass' })
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('accessToken');
      });
  });
});
```

**Commandes** :
```bash
npm run test:e2e           # Tous les tests E2E
npm run test:e2e:super     # E2E super-app uniquement
npm run test:e2e:school    # E2E school-app uniquement
```

### 3. Tests d'Intégration (Integration Tests)

**Objectif** : Tester l'interaction entre plusieurs modules (à implémenter).

**Exemple** :
- Course → Trajet → PointsRecuperation
- Child → Parent → Notifications
- Organisation → Provisioning → Tenant DB

---

## Commandes

### Développement

```bash
# Lancer tous les tests unitaires
npm run test

# Mode watch (re-run automatique)
npm run test:watch

# Tests unitaires seulement
npm run test:unit

# Tests E2E
npm run test:e2e

# Tous les tests (unit + E2E)
npm run test:all
```

### Couverture de code

```bash
# Générer rapport de couverture
npm run test:cov

# Voir le rapport HTML
open coverage/lcov-report/index.html
```

### CI/CD

```bash
# Tests optimisés pour CI
npm run test:ci
```

### Debug

```bash
# Debugger un test spécifique
npm run test:debug -- courses.service.spec.ts
```

---

## Conventions

### Nommage des fichiers

| Type | Pattern | Exemple |
|------|---------|---------|
| Test unitaire | `*.spec.ts` | `courses.service.spec.ts` |
| Test E2E | `*.e2e-spec.ts` | `auth.e2e-spec.ts` |
| Helper | `*.helper.ts` | `test-database.helper.ts` |
| Fixture | `test-*.ts` | `test-fixtures.ts` |

### Structure d'un test

```typescript
describe('FeatureName', () => {
  // Setup
  beforeEach(() => { /* ... */ });
  afterEach(() => { /* ... */ });

  // Tests groupés par méthode/comportement
  describe('methodName', () => {
    it('should do something when condition', () => {
      // Arrange (Given)
      const input = {};
      
      // Act (When)
      const result = service.method(input);
      
      // Assert (Then)
      expect(result).toBe(expected);
    });

    it('should throw error when invalid input', () => {
      expect(() => service.method(null)).toThrow(Error);
    });
  });
});
```

### Nommage des tests

✅ **Bon** :
```typescript
it('should return 404 when course not found')
it('should throw ConflictException when empCode already exists')
it('should auto-sync photo from super-app if missing')
```

❌ **Mauvais** :
```typescript
it('test 1')
it('works')
it('error case')
```

---

## Bonnes pratiques

### 1. Isolation des tests

✅ **Bon** : Chaque test est indépendant
```typescript
beforeEach(() => {
  mockRepo = { find: jest.fn() };
});

afterEach(() => {
  jest.clearAllMocks();
});
```

❌ **Mauvais** : Tests dépendants de l'ordre
```typescript
it('creates user', () => { userId = create(); });
it('updates user', () => { update(userId); }); // Dépend du test précédent
```

### 2. Mocking stratégique

✅ **Mock** :
- Base de données
- APIs externes (BioTime, Firebase)
- Services tiers (HttpService, EmailService)
- Date/Time (pour tests déterministes)

❌ **Ne pas mocker** :
- La logique métier à tester
- Helpers simples (formatters, validators)

### 3. Fixtures et helpers

Utiliser [test-fixtures.ts](test/helpers/test-fixtures.ts) pour créer des données réutilisables :

```typescript
import { createMockUser, createMockOrganisation } from '../helpers/test-fixtures';

const testUser = createMockUser({ role: UserRole.SUPER_ADMIN });
const testOrg = createMockOrganisation({ name: 'Test School' });
```

### 4. Tests E2E : Nettoyage

Toujours nettoyer les données créées :

```typescript
afterAll(async () => {
  if (testUserId) {
    await userRepo.delete({ id: testUserId });
  }
  await app.close();
});
```

### 5. Timeouts

Les tests E2E peuvent être lents (DB, réseau) :

```typescript
// Par test
it('slow operation', async () => { /* ... */ }, 10000); // 10s

// Global dans config
testTimeout: 60000
```

---

## Couverture de code

### Objectifs par type de fichier

| Type | Couverture cible | Justification |
|------|------------------|---------------|
| Services | 80-90% | Logique métier critique |
| Controllers | 70-80% | Flow HTTP important |
| DTOs | 0% | Validation déclarative |
| Entities | 0% | ORM configuration |
| Modules | 0% | Dependency injection |

### Exclusions (collectCoverageFrom)

```typescript
'!**/*.dto.ts',      // DTOs = validation schema
'!**/*.entity.ts',   // Entities = data model
'!**/*.interface.ts',// Interfaces = types
'!**/*.module.ts',   // Modules = DI config
'!**/main.ts',       // Bootstrap
```

### Rapport de couverture

```bash
npm run test:cov

# Résultat dans ./coverage/
# HTML report: coverage/lcov-report/index.html
```

**Seuils minimum** (jest.config.ts) :
```typescript
coverageThreshold: {
  global: {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70,
  },
}
```

---

## CI/CD

### GitHub Actions / GitLab CI

Exemple de pipeline :

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: smartbus_test
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432
      
      redis:
        image: redis:7
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Check coverage
        run: npm run test:cov
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

### Pre-commit Hook

Installer Husky pour lancer les tests avant commit :

```bash
npm install -D husky
npx husky init
```

`.husky/pre-commit` :
```bash
#!/bin/sh
npm run test:unit
npm run lint
```

---

## Dépannage

### Problème : Tests timeout

**Cause** : Base de données lente, connexions non fermées

**Solution** :
```typescript
// Augmenter timeout
testTimeout: 60000

// Fermer connexions
afterAll(async () => {
  await dataSource.destroy();
  await app.close();
});
```

### Problème : Port déjà utilisé

**Cause** : Conflit avec apps en dev

**Solution** :
- Utiliser ports différents dans `.env.test`
- Tuer les processus : `npx kill-port 3000 3001`

### Problème : "Cannot find module @app/common"

**Cause** : Path mapping non résolu

**Solution** :
```typescript
// jest.config.ts
moduleNameMapper: {
  '^@app/common(|/.*)$': '<rootDir>/libs/common/src/$1',
  '^@app/database(|/.*)$': '<rootDir>/libs/database/src/$1',
}
```

### Problème : Tests flaky (intermittents)

**Causes fréquentes** :
- Données partagées entre tests
- Ordre d'exécution non déterministe
- Race conditions async

**Solution** :
```typescript
// Isolation stricte
beforeEach(() => { /* reset state */ });

// Attendre les promises
await expect(promise).resolves.toBe(value);

// Pas de setTimeout dans les tests
```

### Problème : Mocks ne fonctionnent pas

**Solution** :
```typescript
// Clear mocks entre tests
afterEach(() => {
  jest.clearAllMocks();
});

// Vérifier spy
const spy = jest.spyOn(service, 'method');
expect(spy).toHaveBeenCalledWith(expectedArgs);
```

---

## Ressources

- [Documentation Jest](https://jestjs.io/docs/getting-started)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [Supertest API](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

---

## Prochaines étapes

- [ ] Ajouter tests pour modules manquants (Notifications, GPS, Trajets)
- [ ] Implémenter tests de charge (k6, Artillery)
- [ ] Ajouter tests de sécurité (OWASP, injection SQL)
- [ ] Mettre en place mutation testing (Stryker)
- [ ] Intégrer SonarQube pour analyse statique
- [ ] Documenter tests frontend (React Testing Library)

---

**Dernière mise à jour** : 2026-09-19  
**Mainteneur** : Équipe SMARTBUS
