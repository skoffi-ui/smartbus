const { Pool } = require('pg');
async function getDevices() {
  const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'smartbus_tenant_1', // School database where cars are
    password: 'postgres',
    port: 5432,
  });
  try {
    const res = await pool.query(
      `SELECT id, gps_device_id, plate_number FROM cars WHERE gps_device_id IS NOT NULL`,
    );
    console.log('Cars:', res.rows);
  } finally {
    pool.end();
  }
}
getDevices();
