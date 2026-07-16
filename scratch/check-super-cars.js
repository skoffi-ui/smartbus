const { Pool } = require('pg');
const p = new Pool({user:'postgres', password:'postgres', port:5432, database:'smartbus_super'});
p.query("SELECT * FROM cars LIMIT 1").then(res => {
  console.log(res.rows);
  p.end();
});
