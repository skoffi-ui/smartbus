const { Pool } = require('pg');
const p = new Pool({user:'postgres', password:'postgres', port:5432, database:'smartbus_school_gtl_2748'});
p.query("UPDATE cars SET biotime_terminal_sn = 'CKPM223460449', gps_device_id = 'B6A1', is_active = true WHERE plate_number = 'FR-7645-GJ'").then(res => {
  console.log('Updated rows:', res.rowCount);
  p.end();
});
