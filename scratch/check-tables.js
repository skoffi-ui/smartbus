const { Pool } = require('pg');
const p = new Pool({user:'postgres', password:'postgres', port:5432, database:'smartbus_super'});
p.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'").then(res => {
  console.log(res.rows);
  p.end();
});
