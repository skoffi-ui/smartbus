// Inscrit les balises GPS des véhicules à l'inventaire central et les rattache à
// l'école, pour que la super-app puisse attribuer les positions reçues.
// Sans ce rattachement, tout flux entrant reste « en attente d'affectation » et
// aucune position n'arrive sur la carte de suivi.
const path = require('path');
const R = path.resolve(__dirname, '../..');
require(path.join(R, 'node_modules/dotenv')).config({ path: path.join(R, '.env') });
const { Client } = require(path.join(R, 'node_modules/pg'));

const b = {
  host: process.env.SUPER_DB_HOST || 'localhost',
  port: Number(process.env.SUPER_DB_PORT || 5432),
  user: process.env.SUPER_DB_USER,
  password: process.env.SUPER_DB_PASSWORD,
};

/** Nom de la base de l'école ciblée, lu dans la base centrale. */
async function baseEcole(base) {
  const central = new Client({ ...base, database: process.env.SUPER_DB_NAME || 'smartbus_super' });
  await central.connect();
  const cible = process.env.DEMO_ORG_CODE;
  const r = await central.query(
    cible
      ? 'select db_name, name from organisations where code = $1'
      : 'select db_name, name from organisations order by created_at limit 1',
    cible ? [cible] : [],
  );
  await central.end();
  if (!r.rows.length) throw new Error(cible ? `Aucune école de code ${cible}` : 'Aucune école en base centrale');
  return r.rows[0].db_name;
}

(async () => {
  const ecole = new Client({ ...b, database: await baseEcole(b) });
  await ecole.connect();
  const cars = (
    await ecole.query(
      'select plate_number, gps_device_id from cars where deleted_at is null and gps_device_id is not null',
    )
  ).rows;
  await ecole.end();

  const c = new Client({ ...b, database: process.env.SUPER_DB_NAME || 'smartbus_super' });
  await c.connect();
  const org = (await c.query('select id, name from organisations limit 1')).rows[0];

  for (const car of cars) {
    const serie = car.gps_device_id;
    let dev = (
      await c.query('select id from devices where serial_number = $1 and deleted_at is null', [serie])
    ).rows[0];

    if (!dev) {
      dev = (
        await c.query(
          `insert into devices (type_device, serial_number, status, last_seen_at)
           values ('GPS', $1, 'ACTIVE', now()) returning id`,
          [serie],
        )
      ).rows[0];
      console.log(`  balise ${serie} inscrite à l'inventaire`);
    }

    const lien = (
      await c.query(
        'select id from organisation_devices where device_id = $1 and released_at is null',
        [dev.id],
      )
    ).rows[0];

    if (lien) {
      console.log(`  ${car.plate_number} → balise ${serie} : déjà rattachée`);
    } else {
      await c.query(
        'insert into organisation_devices (organisation_id, device_id) values ($1, $2)',
        [org.id, dev.id],
      );
      console.log(`  ${car.plate_number} → balise ${serie} rattachée à ${org.name}`);
    }
  }

  await c.end();
})().catch((e) => { console.error('ECHEC:', e.message); process.exit(1); });
