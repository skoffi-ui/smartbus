const axios = require('axios');
const { Client } = require('pg');

async function test() {
  const schoolEmail = `direction_test_uuid_${Date.now()}@ecole.com`;
  const schoolPassword = 'password123';
  const schoolName = `Ecole Test UUID ${Date.now()}`;

  try {
    // 1. Enregistrer une nouvelle école
    console.log(`📝 Inscription de l'école : ${schoolName}...`);
    const regRes = await axios.post('http://localhost:3000/api/v1/auth/register-school', {
      schoolName: schoolName,
      adminFirstName: 'Jean',
      adminLastName: 'Dupont',
      adminEmail: schoolEmail,
      adminPassword: schoolPassword
    });
    console.log('✅ École enregistrée et provisionnée !');

    // 2. Récupérer le dbName depuis la base centrale
    console.log('🔌 Résolution du nom de base de données depuis smartbus_super...');
    const superClient = new Client({
      host: 'localhost',
      port: 5432,
      database: 'smartbus_super',
      user: 'postgres',
      password: 'postgres'
    });
    await superClient.connect();
    const orgRes = await superClient.query('SELECT db_name FROM organisations WHERE name = $1', [schoolName]);
    if (orgRes.rows.length === 0) {
      throw new Error(`Organisation introuvable pour le nom : ${schoolName}`);
    }
    const dbName = orgRes.rows[0].db_name;
    await superClient.end();
    console.log(`✅ Base résolue : ${dbName}`);

    // 3. Se connecter à la base école pour insérer un véhicule et un chauffeur
    console.log(`🔌 Connexion directe à ${dbName} pour ajouter des données de test...`);
    const client = new Client({
      host: 'localhost',
      port: 5432,
      database: dbName,
      user: 'postgres',
      password: 'postgres'
    });
    await client.connect();

    // Insérer un véhicule
    const carId = '77777777-7777-4777-a777-777777777777';
    await client.query(`
      INSERT INTO cars (id, plate_number, brand, model, capacity, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO NOTHING
    `, [carId, 'BUS-UUID-123', 'Toyota', 'Coaster', 30, true]);

    // Insérer un chauffeur
    const driverId = '88888888-8888-4888-b888-888888888888';
    await client.query(`
      INSERT INTO drivers (id, first_name, last_name, phone, license_number)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO NOTHING
    `, [driverId, 'Jean', 'Dupont', '0102030405', 'LIC-123']);

    await client.end();
    console.log('✅ Véhicule et Chauffeur insérés en base école !');

    // 4. Connexion (Login) pour récupérer le token JWT
    console.log('🔑 Connexion...');
    const loginRes = await axios.post('http://localhost:3000/api/v1/auth/login', {
      email: schoolEmail,
      password: schoolPassword
    });
    const token = loginRes.data.tokens.accessToken;
    console.log('✅ Connecté ! Token reçu.');

    const headers = { Authorization: `Bearer ${token}` };

    // 5. Récupérer les véhicules via school-app (3001)
    console.log('🚍 Récupération de la flotte...');
    const carsRes = await axios.get('http://localhost:3001/api/v1/cars', { headers });
    const cars = carsRes.data;
    console.log(`- ${cars.length} véhicules trouvés.`);
    cars.forEach(c => console.log(`  * ${c.plateNumber} -> ID: ${c.id}`));
    
    // 6. Récupérer les chauffeurs via school-app (3001)
    console.log('👤 Récupération des chauffeurs...');
    const driversRes = await axios.get('http://localhost:3001/api/v1/drivers', { headers });
    const drivers = driversRes.data;
    console.log(`- ${drivers.length} chauffeurs trouvés.`);
    drivers.forEach(d => console.log(`  * ${d.firstName} ${d.lastName} -> ID: ${d.id}`));

    // 7. Créer une nouvelle course avec nos UUIDs réels
    console.log('📝 Création de la course via POST /api/v1/transport/courses...');
    const coursePayload = {
      nom: 'Tournée Express Test UUID',
      description: 'Test de l\'action 2 - Validation du typage UUID',
      statut: 'active',
      couleurCarte: '#EC4899',
      heureDepart: '08:00',
      heureArrivee: '08:45',
      joursExecution: ['L', 'M', 'J', 'V'],
      carId: carId,        // UUID valide
      driverId: driverId,  // UUID valide
      chauffeur: 'Jean Dupont',
      route: [],
      markers: []
    };

    const createRes = await axios.post('http://localhost:3001/api/v1/transport/courses', coursePayload, { headers });
    console.log('🎉 Course créée avec succès !');
    console.log('Payload de réponse :', JSON.stringify(createRes.data, null, 2));

    // 8. Vérifier la lecture de la course
    console.log('🔍 Lecture de la course créée depuis le serveur...');
    const getRes = await axios.get(`http://localhost:3001/api/v1/transport/courses/${createRes.data.id}`, { headers });
    console.log('Données lues :', JSON.stringify(getRes.data, null, 2));

  } catch (err) {
    if (err.response) {
      console.error('❌ Erreur HTTP :', err.response.status, JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('❌ Erreur complète :', err);
    }
  }
}

test();
