const { Pool } = require('pg');
const p = new Pool({
  user: 'postgres',
  password: 'postgres',
  port: 5432,
  database: 'smartbus_super',
});
p.query(
  "SELECT column_name FROM information_schema.columns WHERE table_name = 'super_app_children'",
).then((res) => {
  console.log(res.rows);
  p.end();
});
