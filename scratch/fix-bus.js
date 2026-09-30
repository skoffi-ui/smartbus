const { Pool } = require('pg');
const p = new Pool({
  user: 'postgres',
  password: 'postgres',
  port: 5432,
  database: 'smartbus_school_gtl_2748',
});
p.query(
  "UPDATE cars SET biotime_terminal_sn = 'CKPM223460449', gps_device_id = '3076' WHERE plate_number = '1013KA01'",
).then(() => {
  console.log('Bus updated!');
  p.end();
});
