// Serveur BioTime CENTRAL fictif — remplace temporairement le vrai serveur
// (actuellement HS) pour que l'application fonctionne de bout en bout comme
// elle le fera une fois le vrai serveur rétabli : aucun code applicatif n'est
// changé, seule l'URL cible (BIOTIME_CENTRAL_URL) pointe ici en attendant.
//
// Implémente exactement les endpoints appelés par
// apps/super-app/src/modules/biotime/biotime-central.service.ts :
//   POST /personnel/api/departments/         créer un département (1 école = 1 département)
//   GET  /personnel/api/departments/         lister les départements
//   GET  /iclock/api/terminals/              lister les badgeuses
//   POST /personnel/api/employees/           créer un élève
//   GET  /personnel/api/employees/?emp_code= chercher un élève par matricule
//   PUT  /personnel/api/employees/:id/       mettre à jour un élève
//   GET  /iclock/api/transactions/           lister les pointages (vide pour l'instant)
//
// État persisté dans un fichier JSON local (pas en base) : un simple redémarrage
// de ce script ne doit pas invalider les biotimeDepartmentId déjà attribués et
// stockés, eux, dans la vraie base centrale.
//
// Pour revenir au vrai serveur une fois rétabli : changer BIOTIME_CENTRAL_URL
// (et BIOTIME_CENTRAL_TOKEN) dans .env, puis redémarrer super-app. Rien
// d'autre à toucher.
const path = require('path');
const fs = require('fs');
const R = path.resolve(__dirname, '../..');
require(path.join(R, 'node_modules/dotenv')).config({ path: path.join(R, '.env') });
const express = require(path.join(R, 'node_modules/express'));

const PORT = Number(process.env.BIOTIME_FICTIF_PORT || 4010);
const ETAT_PATH = path.join(__dirname, '.biotime-fictif-etat.json');

// Démarre à 9501, au-delà de la plage 9001/9101-9103 déjà utilisée en dur par
// scripts/demo/peupler-biotime-demo.js (qui écrit directement en base, sans
// passer par ce serveur) — sinon une école peuplée par ce script et une autre
// dont le département est créé ici pourraient se retrouver avec le même
// identifiant fictif, malgré deux origines indépendantes.
function chargerEtat() {
  try {
    return JSON.parse(fs.readFileSync(ETAT_PATH, 'utf8'));
  } catch {
    return { prochainDeptId: 9501, prochainEmpId: 9501, departments: [], employees: [], terminals: [
      { id: 9601, sn: 'DEMO-FICTIF-TERM-001', alias: 'Badgeuse Bus 1 (Démo)', ip_address: '10.0.0.101', state: 1, terminal_name: 'ZKTeco F18' },
      { id: 9602, sn: 'DEMO-FICTIF-TERM-002', alias: 'Badgeuse Bus 2 (Démo)', ip_address: '10.0.0.102', state: 1, terminal_name: 'ZKTeco F18' },
      { id: 9603, sn: 'DEMO-FICTIF-TERM-003', alias: 'Badgeuse Portail École (Démo)', ip_address: '10.0.0.103', state: 1, terminal_name: 'SpeedFace-V5L' },
    ] };
  }
}

let etat = chargerEtat();
function sauvegarder() {
  // Une écriture disque ratée (droits, disque plein...) ne doit pas faire
  // planter le serveur : au pire l'état en mémoire continue de répondre
  // jusqu'au prochain redémarrage, plutôt que de tout arrêter en pleine démo.
  try {
    fs.writeFileSync(ETAT_PATH, JSON.stringify(etat, null, 2));
  } catch (err) {
    console.error('[BioTime FICTIF] Échec d\'écriture de l\'état (ignoré) :', err.message);
  }
}

// Filet de sécurité : une erreur inattendue dans un handler ne doit jamais
// arrêter silencieusement le processus — on la journalise et on continue.
// Sans ça, "ne répond plus" ne laisserait aucune trace pour comprendre pourquoi.
process.on('uncaughtException', (err) => {
  console.error('[BioTime FICTIF] Erreur non interceptée (le serveur continue) :', err);
});
process.on('unhandledRejection', (err) => {
  console.error('[BioTime FICTIF] Rejet de promesse non intercepté (le serveur continue) :', err);
});

const app = express();
app.use(express.json());

// Log simple : voir passer chaque appel pendant la démo.
app.use((req, _res, next) => {
  console.log(`[BioTime FICTIF] ${req.method} ${req.originalUrl}`);
  next();
});

// Pour vérifier vite qu'il tourne (voir DEMO.md, section dépannage).
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', departments: etat.departments.length, employees: etat.employees.length });
});

// ==================== DÉPARTEMENTS (1 par école) ====================

app.post('/personnel/api/departments/', (req, res) => {
  const { dept_name, dept_code } = req.body || {};
  const dept = { id: etat.prochainDeptId++, dept_name: dept_name || '[DÉMO] École', dept_code: dept_code || null, parent: null };
  etat.departments.push(dept);
  sauvegarder();
  res.status(201).json(dept);
});

app.get('/personnel/api/departments/', (_req, res) => {
  res.json({ count: etat.departments.length, data: etat.departments });
});

// ==================== BADGEUSES ====================

app.get('/iclock/api/terminals/', (_req, res) => {
  res.json({ count: etat.terminals.length, data: etat.terminals });
});

// ==================== ÉLÈVES (employés BioTime) ====================

app.post('/personnel/api/employees/', (req, res) => {
  const donnees = req.body || {};
  const existant = etat.employees.find((e) => e.emp_code === donnees.emp_code);
  if (existant) {
    // Reproduit le comportement réel attendu par BiotimeCentralService.syncEmployeeToBiotime :
    // 400 + `emp_code` dans le corps déclenche sa bascule automatique vers la mise à jour.
    return res.status(400).json({ emp_code: ['employee with this emp code already exists.'] });
  }
  const employe = {
    id: etat.prochainEmpId++,
    emp_code: donnees.emp_code,
    first_name: donnees.first_name,
    last_name: donnees.last_name,
    department: donnees.department ?? null,
    mobile: donnees.mobile || '',
    email: donnees.email || '',
  };
  etat.employees.push(employe);
  sauvegarder();
  res.status(201).json(employe);
});

app.get('/personnel/api/employees/', (req, res) => {
  const { emp_code } = req.query;
  const resultats = emp_code ? etat.employees.filter((e) => e.emp_code === emp_code) : etat.employees;
  res.json({ count: resultats.length, data: resultats });
});

app.put('/personnel/api/employees/:id/', (req, res) => {
  const id = Number(req.params.id);
  const employe = etat.employees.find((e) => e.id === id);
  if (!employe) return res.status(404).json({ detail: 'Not found.' });
  Object.assign(employe, req.body || {});
  sauvegarder();
  res.json(employe);
});

// ==================== POINTAGES ====================
// Vide pour l'instant : aucune vraie badgeuse ne pousse de pointage vers ce
// serveur fictif. Le format est correct pour que le code applicatif (qui
// attend `{ data: [...] }`) fonctionne sans erreur en attendant.
app.get('/iclock/api/transactions/', (_req, res) => {
  res.json({ count: 0, data: [] });
});

app.listen(PORT, () => {
  console.log(`\n🏷️  Serveur BioTime FICTIF démarré sur http://localhost:${PORT}`);
  console.log(`   Fait tourner l'application comme si le vrai serveur répondait — aucune`);
  console.log(`   donnée réelle, tout est préfixé [DÉMO] côté départements/terminaux.`);
  console.log(`   Vérifie que .env a bien :`);
  console.log(`     BIOTIME_CENTRAL_URL=http://localhost:${PORT}`);
  console.log(`     BIOTIME_CENTRAL_TOKEN=demo-token-fictif\n`);
});
