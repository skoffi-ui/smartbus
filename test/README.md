# Tests SMARTBUS - Quick Start

## 🚀 Démarrage rapide

### 1. Installation

```bash
npm install
```

### 2. Configuration

Copier `.env.example` vers `.env.test` et ajuster si nécessaire :

```bash
cp .env.example .env.test
```

### 3. Lancer la base de données test

```bash
docker-compose up -d postgres redis
```

### 4. Lancer les tests

```bash
# Tests unitaires
npm run test

# Tests E2E
npm run test:e2e

# Tous les tests avec couverture
npm run test:cov
```

## 📂 Structure

```
test/
├── README.md                       # Ce fichier
├── setup.ts                        # Configuration globale
├── helpers/
│   ├── test-database.helper.ts     # Helpers DB
│   └── test-fixtures.ts            # Fixtures réutilisables
├── super-app/
│   ├── auth.e2e-spec.ts           # Tests auth super-app
│   └── organisations.e2e-spec.ts   # Tests organisations
└── school-app/
    ├── courses.e2e-spec.ts        # Tests courses
    └── children.e2e-spec.ts       # Tests enfants
```

## 🧪 Exemples de tests

### Test unitaire

```typescript
// apps/school-app/src/modules/courses/courses.service.spec.ts
it('should create a course', async () => {
  const dto = { nom: 'Test', trajetId: '...' };
  mockRepo.save.mockResolvedValue(mockCourse);

  const result = await service.create(dto);

  expect(result).toEqual(mockCourse);
  expect(mockRepo.save).toHaveBeenCalled();
});
```

### Test E2E

```typescript
// test/super-app/auth.e2e-spec.ts
it('should login with valid credentials', () => {
  return request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email: 'test@test.com', password: 'pass' })
    .expect(200)
    .expect((res) => {
      expect(res.body).toHaveProperty('accessToken');
    });
});
```

## 📊 Couverture actuelle

Lancez `npm run test:cov` pour voir la couverture détaillée.

**Objectif** : 70% minimum sur toutes les métriques.

## 🔧 Commandes utiles

```bash
# Mode watch (re-run automatique)
npm run test:watch

# Tests E2E super-app uniquement
npm run test:e2e:super

# Tests E2E school-app uniquement
npm run test:e2e:school

# Debug un test spécifique
npm run test:debug -- courses.service.spec.ts

# Tests pour CI/CD
npm run test:ci
```

## 📖 Documentation complète

Voir [TESTING.md](../TESTING.md) pour :

- Architecture détaillée
- Conventions de nommage
- Bonnes pratiques
- Guide de dépannage
- Configuration CI/CD

## 🐛 Problèmes fréquents

### Port déjà utilisé

```bash
npx kill-port 3100 3101
```

### Base de données test non accessible

```bash
# Vérifier que PostgreSQL tourne
docker-compose ps

# Recréer les containers
docker-compose down
docker-compose up -d
```

### Tests timeout

Augmenter le timeout dans `jest.config.ts` :

```typescript
testTimeout: 60000;
```

## 🎯 Prochains modules à tester

- [ ] NotificationsService
- [ ] GPSService
- [ ] TrajetsService
- [ ] ParentsService
- [ ] DriversService
- [ ] AffectationsService

## 💡 Tips

1. **Écrire les tests en même temps que le code** - TDD (Test-Driven Development)
2. **Un test = un comportement** - Pas de tests trop longs
3. **Nommer explicitement** - `should do X when Y`
4. **Isoler les tests** - Pas de dépendances entre tests
5. **Mock les dépendances externes** - APIs, DB, services tiers

## 📬 Support

Questions ? Consultez :

- [TESTING.md](../TESTING.md)
- [Jest Documentation](https://jestjs.io/)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)

---

**Happy Testing! 🧪✨**
