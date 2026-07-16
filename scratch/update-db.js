const { Client } = require('pg');

async function updateDb() {
  const superClient = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'smartbus_super',
  });

  await superClient.connect();
  const orgRes = await superClient.query('SELECT db_name FROM organisations LIMIT 1');
  await superClient.end();

  if (orgRes.rows.length === 0) {
    console.log("Aucune organisation trouvée");
    return;
  }

  const dbName = orgRes.rows[0].db_name;
  console.log(`Connexion au tenant: ${dbName}`);

  const tenantClient = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: dbName,
  });

  await tenantClient.connect();
  
  // Create columns if they don't exist
  await tenantClient.query('ALTER TABLE cars ADD COLUMN IF NOT EXISTS gps_device_id VARCHAR(255)');
  await tenantClient.query('ALTER TABLE cars ADD COLUMN IF NOT EXISTS biotime_terminal_sn VARCHAR(255)');

  // Assign the GPS device ID 3076 and the Terminal SN BUS-TEST-001 to the first car
  const res = await tenantClient.query("UPDATE cars SET plate_number = '1013KA01', gps_device_id = '3076', biotime_terminal_sn = 'BUS-TEST-001' WHERE id = (SELECT id FROM cars LIMIT 1) RETURNING *");
  
  if (res.rows.length > 0) {
    console.log("Voiture mise à jour :", res.rows[0]);
  } else {
    // Insert a dummy car if no car exists
    console.log("Aucune voiture trouvée. Création d'une voiture...");
    const insertRes = await tenantClient.query(`
      INSERT INTO cars (plate_number, brand, model, capacity, gps_device_id, biotime_terminal_sn) 
      VALUES ('AB-123-CD', 'Mercedes', 'Sprinter', 30, '125', 'BUS-TEST-001') RETURNING *
    `);
    console.log("Voiture créée :", insertRes.rows[0]);
  }
  
  await tenantClient.end();
}

updateDb().catch(console.error);
