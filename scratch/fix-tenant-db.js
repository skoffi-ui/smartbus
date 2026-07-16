const { Pool } = require('pg');

async function fixTenantDb() {
  const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'smartbus_school_clt_9730',
    password: 'postgres',
    port: 5432,
  });

  try {
    // 1. Update the car to match the real terminal SN
    await pool.query(`UPDATE cars SET biotime_terminal_sn = 'CKPM223460449' WHERE plate_number = '1013KA01'`);
    console.log("✅ Terminal du bus mis à jour à CKPM223460449");

    // 2. Insert dummy children with the empCodes we use in the simulation
    const childrenToInsert = [
      { id: '11111111-1111-1111-1111-111111111111', empCode: '1', fn: 'Kofi', ln: 'A.' },
      { id: '22222222-2222-2222-2222-222222222222', empCode: '10', fn: 'Awa', ln: 'B.' },
      { id: '33333333-3333-3333-3333-333333333333', empCode: '11', fn: 'Moussa', ln: 'C.' },
      { id: '44444444-4444-4444-4444-444444444444', empCode: '12', fn: 'Fatim', ln: 'D.' },
      { id: '55555555-5555-5555-5555-555555555555', empCode: '13', fn: 'Jean', ln: 'E.' }
    ];

    for (const c of childrenToInsert) {
      // Check if exists
      const res = await pool.query(`SELECT id FROM children WHERE emp_code = $1`, [c.empCode]);
      if (res.rows.length === 0) {
        await pool.query(
          `INSERT INTO children (id, emp_code, first_name, last_name, date_of_birth, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, '2015-01-01', NOW(), NOW())`,
          [c.id, c.empCode, c.fn, c.ln]
        );
      }
    }
    console.log("✅ Élèves tests ajoutés dans la base de données de l'école");
  } catch(e) {
    console.error("Erreur:", e.message);
  } finally {
    pool.end();
  }
}

fixTenantDb();
