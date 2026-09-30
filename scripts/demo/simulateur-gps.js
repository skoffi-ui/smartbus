// Simulateur de balises GPS pour la démonstration.
//
// Fait rouler chaque véhicule de l'école le long de son trajet en envoyant des
// positions à l'endpoint Traccar de la super-app — le vrai chemin d'ingestion,
// celui qu'emprunteront les balises réelles. La carte de suivi et le flux
// WebSocket se remplissent donc exactement comme en production.
//
// Usage : node simulateur-gps.js [intervalle_secondes]
// Arrêt : Ctrl+C
const path = require('path');
const http = require('http');
const R = path.resolve(__dirname, '../..');
require(path.join(R, 'node_modules/dotenv')).config({
  path: path.join(R, '.env'),
});
const { Client } = require(path.join(R, 'node_modules/pg'));

const INTERVALLE = Number(process.argv[2] || 4) * 1000;
const SUPER_APP = {
  host: 'localhost',
  port: Number(process.env.SUPER_APP_PORT || 3000),
};

const poster = (corps) =>
  new Promise((res) => {
    const donnees = JSON.stringify(corps);
    const req = http.request(
      {
        ...SUPER_APP,
        path: '/api/v1/hardware/traccar',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(donnees),
        },
      },
      (r) => {
        let b = '';
        r.on('data', (c) => (b += c));
        r.on('end', () => res({ code: r.statusCode, corps: b }));
      },
    );
    req.on('error', (e) => res({ code: 0, corps: e.message }));
    req.write(donnees);
    req.end();
  });

/** Interpole un point à la fraction t (0→1) le long d'une polyligne. */
function surLaRoute(points, t) {
  if (points.length < 2) return points[0];
  const total = points.length - 1;
  const pos = t * total;
  const i = Math.min(Math.floor(pos), total - 1);
  const f = pos - i;
  return {
    lat: points[i].lat + (points[i + 1].lat - points[i].lat) * f,
    lng: points[i].lng + (points[i + 1].lng - points[i].lng) * f,
  };
}

const base = {
  host: process.env.SUPER_DB_HOST || 'localhost',
  port: Number(process.env.SUPER_DB_PORT || 5432),
  user: process.env.SUPER_DB_USER,
  password: process.env.SUPER_DB_PASSWORD,
};

/** Nom de la base de l'école ciblée, lu dans la base centrale. */
async function baseEcole(base) {
  const central = new Client({
    ...base,
    database: process.env.SUPER_DB_NAME || 'smartbus_super',
  });
  await central.connect();
  const cible = process.env.DEMO_ORG_CODE;
  const r = await central.query(
    cible
      ? 'select db_name, name from organisations where code = $1'
      : 'select db_name, name from organisations order by created_at limit 1',
    cible ? [cible] : [],
  );
  await central.end();
  if (!r.rows.length)
    throw new Error(
      cible ? `Aucune école de code ${cible}` : 'Aucune école en base centrale',
    );
  return r.rows[0].db_name;
}

(async () => {
  const cl = new Client({ ...base, database: await baseEcole(base) });
  await cl.connect();

  const cars = (
    await cl.query(
      'select id, plate_number, gps_device_id from cars where deleted_at is null and gps_device_id is not null order by created_at',
    )
  ).rows;

  const trajets = (
    await cl.query(
      'select id, nom from trajets where deleted_at is null order by created_at',
    )
  ).rows;
  const parcours = [];
  for (const t of trajets) {
    const pts = (
      await cl.query(
        'select latitude::float lat, longitude::float lng, nom from points_recuperation where trajet_id=$1 order by ordre_passage',
        [t.id],
      )
    ).rows;
    if (pts.length >= 2) parcours.push({ nom: t.nom, pts });
  }
  await cl.end();

  if (!parcours.length) {
    console.error('Aucun trajet avec au moins 2 points : rien à simuler.');
    process.exit(1);
  }

  const flotte = cars.map((car, i) => ({
    car,
    parcours: parcours[i % parcours.length],
    // Chaque bus démarre à un endroit différent de son trajet
    t: (i * 0.23) % 1,
    sens: 1,
  }));

  console.log(
    `\nSimulation de ${flotte.length} véhicule(s), une position toutes les ${INTERVALLE / 1000} s.`,
  );
  for (const b of flotte) {
    console.log(
      `  ${b.car.plate_number} (balise ${b.car.gps_device_id}) sur « ${b.parcours.nom} »`,
    );
  }
  console.log('\nCtrl+C pour arrêter.\n');

  let tour = 0;
  const tic = async () => {
    tour++;
    const lignes = [];
    for (const b of flotte) {
      // Avance d'environ 4 % du trajet par envoi, puis repart dans l'autre sens
      b.t += 0.04 * b.sens;
      if (b.t >= 1) {
        b.t = 1;
        b.sens = -1;
      }
      if (b.t <= 0) {
        b.t = 0;
        b.sens = 1;
      }

      const p = surLaRoute(b.parcours.pts, b.t);
      const r = await poster({
        uniqueId: b.car.gps_device_id,
        latitude: Number(p.lat.toFixed(6)),
        longitude: Number(p.lng.toFixed(6)),
        speed: Math.round(18 + Math.random() * 22),
        timestamp: new Date().toISOString(),
      });
      const etat =
        r.code === 200
          ? /pending/.test(r.corps)
            ? 'EN ATTENTE'
            : 'ok'
          : `HTTP ${r.code}`;
      lignes.push(`${b.car.plate_number}:${etat}`);
    }
    console.log(`envoi #${tour} — ${lignes.join('  ')}`);
  };

  await tic();
  setInterval(tic, INTERVALLE);
})().catch((e) => {
  console.error('ECHEC:', e.message);
  process.exit(1);
});
