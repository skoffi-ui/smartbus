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
  
  // Set all cars to inactive
  await tenantClient.query("UPDATE cars SET is_active = false");
  
  // Set only car 3076 to active
  const res = await tenantClient.query("UPDATE cars SET is_active = true WHERE gps_device_id = '3076' RETURNING *");
  
  console.log(`Vehicles active: ${res.rows.length}`);
  if (res.rows.length > 0) {
    console.log("Active vehicle:", res.rows[0].plate_number);
  }
  
  await tenantClient.end();
}

updateDb().catch(console.error);
