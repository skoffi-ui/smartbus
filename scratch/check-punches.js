const { Pool } = require('pg');

async function checkPunches() {
  const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'smartbus_super',
    password: 'postgres',
    port: 5432,
  });

  try {
    const res = await pool.query(`
      SELECT gps_device_id FROM cars WHERE gps_device_id IS NOT NULL;
    `);
    console.log("Cars with GPS:", res.rows);
    
    // Also let's check the logic in BiotimeService that transforms states into "MONTÉE" or "DESCENTE"
    // Because the state might just be 1 or 5 or whatever.
    const res2 = await pool.query(`
      SELECT 
        child_id, 
        punch_state,
        punch_time
      FROM super_app_punches
      WHERE DATE(punch_time) = '2026-07-10'
      ORDER BY child_id, punch_time;
    `);
    
    // console.log("Raw punches:", res2.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkPunches();
