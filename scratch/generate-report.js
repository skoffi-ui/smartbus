const http = require('http');
const fs = require('fs');
const path = require('path');

const BIOTIME_URL = '160.120.143.20';
const BIOTIME_PORT = 8080;

const authData = JSON.stringify({
  username: 'KOMARA',
  password: 'KOMARA2222'
});

const doRequest = (options, postData = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, data: JSON.parse(body) }));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
};

async function generateReport() {
  try {
    // 1. Authentification
    const authRes = await doRequest({
      hostname: BIOTIME_URL, port: BIOTIME_PORT, path: '/jwt-api-token-auth/',
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': authData.length }
    }, authData);
    const token = authRes.data.token;

    // 2. Récupérer les employés (Enfants)
    const empRes = await doRequest({
      hostname: BIOTIME_URL, port: BIOTIME_PORT, path: '/personnel/api/employees/?page_size=5000',
      method: 'GET', headers: { 'Authorization': `JWT ${token}` }
    });
    const employees = empRes.data.data;
    const empMap = {};
    employees.forEach(e => empMap[e.emp_code] = e);

    // 3. Récupérer les transactions (pointages) pour la date 2023-11-14
    const txnRes = await doRequest({
      hostname: BIOTIME_URL, port: BIOTIME_PORT, path: encodeURI('/iclock/api/transactions/?start_time=2023-11-14 00:00:00&end_time=2023-11-14 23:59:59&page_size=5000'),
      method: 'GET', headers: { 'Authorization': `JWT ${token}` }
    });
    const transactions = txnRes.data.data;

    // 4. Grouper par enfant
    const punchesByEmp = {};
    transactions.forEach(txn => {
      const emp = txn.emp_code;
      const time = txn.punch_time.split(' ')[1]; // "HH:MM:SS"
      if (!punchesByEmp[emp]) punchesByEmp[emp] = [];
      punchesByEmp[emp].push(time);
    });

    // 5. Générer le Markdown
    let md = `# Rapport de Pointage des Enfants (14 Novembre 2023)

Voici les données de pointage récupérées depuis la badgeuse BioTime pour la date du **14 Novembre 2023** (date comportant le plus d'historique).

| Photo | Identifiant | Nom de l'Enfant | Heure de Montée (Matin) | Heure de Descente (Soir) |
|---|---|---|---|---|
`;

    for (const empCode in punchesByEmp) {
      punchesByEmp[empCode].sort(); // tri chronologique
      const times = punchesByEmp[empCode];
      const montee = times[0];
      const descente = times.length > 1 ? times[times.length - 1] : '-';
      const e = empMap[empCode];
      
      let photoUrl = e && e.photo ? `http://${BIOTIME_URL}:${BIOTIME_PORT}${e.photo}` : 'https://ui-avatars.com/api/?name=Enfant&background=random';
      let name = e ? `${e.first_name} ${e.last_name}` : `Inconnu (${empCode})`;
      
      md += `| <img src="${photoUrl}" width="50" height="50" style="border-radius: 50%" /> | ${empCode} | **${name}** | \`${montee}\` | \`${descente}\` |\n`;
    }

    const artifactPath = path.join(process.env.APPDATA || process.env.HOME || '.', '.gemini', 'antigravity-ide', 'brain', '63e20139-634c-4a16-b795-86d7242cddfd', 'rapport_pointage_enfants.md');
    fs.writeFileSync('rapport.md', md);
    console.log('Rapport généré dans rapport.md');
  } catch (err) {
    console.error('Erreur:', err);
  }
}

generateReport();
