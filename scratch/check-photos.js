const { Client } = require('pg');

async function check() {
  const superClient = new Client({ host: 'localhost', port: 5432, database: 'smartbus_super', user: 'postgres', password: 'postgres' });
  await superClient.connect();
  const orgsResult = await superClient.query(`SELECT name, db_name FROM organisations WHERE db_provisioned = true LIMIT 1`);
  await superClient.end();

  const org = orgsResult.rows[0];
  console.log('Vérification de la base:', org.db_name);

  const client = new Client({ host: 'localhost', port: 5432, database: org.db_name, user: 'postgres', password: 'postgres' });
  await client.connect();
  const res = await client.query(`SELECT first_name, last_name, emp_code, photo_url FROM children ORDER BY created_at DESC LIMIT 10`);
  res.rows.forEach(row => {
    console.log(`${row.first_name} ${row.last_name} | empCode: ${row.emp_code} | photo: ${row.photo_url || 'AUCUNE'}`);
  });
  await client.end();
}

check().catch(console.error);
