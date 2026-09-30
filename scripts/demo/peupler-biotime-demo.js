// Peuple des données BioTime FICTIVES pour l'école ciblée, en attendant que le
// vrai serveur BioTime central soit joignable.
//
// Aucun appel réseau vers BioTime n'est fait ici : tout est écrit directement
// en base (département, terminaux, statut de synchro des élèves), pour que
// les écrans (Réglages côté école, Gestion BioTime centralisée côté Super
// Admin) montrent à quoi ça ressemblera une fois le serveur réel branché.
//
// Tout ce qui est créé est préfixé "[DÉMO]" / "DEMO-" pour qu'on ne le
// confonde jamais avec de vraies données BioTime :
//  - le département BioTime de l'organisation ;
//  - 3 badgeuses (biotime_terminals) assignées à l'école ;
//  - le statut de synchro des élèves déjà créés par `demo:peupler`
//    (la plupart passent à SYNCED, un reste PENDING pour rester réaliste —
//    une vraie synchro n'est jamais parfaite à 100%).
//
// Idempotent : relancer ce script ne duplique rien (le département n'est
// réassigné que s'il ne l'est pas déjà, les terminaux utilisent
// `on conflict (serial_number) do nothing`).
const path = require('path');
const R = path.resolve(__dirname, '../..');
require(path.join(R, 'node_modules/dotenv')).config({
  path: path.join(R, '.env'),
});
const { Client } = require(path.join(R, 'node_modules/pg'));

// Plage d'identifiants volontairement improbable côté vrai serveur BioTime,
// pour qu'un ID fictif ne soit jamais confondu avec un vrai.
const DEPARTMENT_ID_DEMO = 9001;

const TERMINAUX_DEMO = [
  {
    serial: 'DEMO-TERM-001',
    nom: 'Badgeuse Bus 1 (Démo)',
    biotimeId: 9101,
    modele: 'ZKTeco F18',
  },
  {
    serial: 'DEMO-TERM-002',
    nom: 'Badgeuse Bus 2 (Démo)',
    biotimeId: 9102,
    modele: 'ZKTeco F18',
  },
  {
    serial: 'DEMO-TERM-003',
    nom: 'Badgeuse Portail École (Démo)',
    biotimeId: 9103,
    modele: 'SpeedFace-V5L',
  },
];

const base = {
  host: process.env.SUPER_DB_HOST || 'localhost',
  port: Number(process.env.SUPER_DB_PORT || 5432),
  user: process.env.SUPER_DB_USER,
  password: process.env.SUPER_DB_PASSWORD,
};

/** Organisation ciblée (id, nom, code, base école, département déjà assigné ?), lue en base centrale. */
async function organisationCiblee() {
  const central = new Client({
    ...base,
    database: process.env.SUPER_DB_NAME || 'smartbus_super',
  });
  await central.connect();
  const cible = process.env.DEMO_ORG_CODE;
  const r = await central.query(
    cible
      ? 'select id, name, code, db_name, biotime_department_id from organisations where code = $1'
      : 'select id, name, code, db_name, biotime_department_id from organisations order by created_at limit 1',
    cible ? [cible] : [],
  );
  if (!r.rows.length) {
    await central.end();
    throw new Error(
      cible ? `Aucune école de code ${cible}` : 'Aucune école en base centrale',
    );
  }
  return { central, org: r.rows[0] };
}

(async () => {
  const { central, org } = await organisationCiblee();

  try {
    // ---- Département BioTime de l'école -----------------------------------
    if (org.biotime_department_id) {
      console.log(
        `Département BioTime déjà assigné à ${org.name} (id ${org.biotime_department_id}) — inchangé.`,
      );
    } else {
      await central.query(
        `update organisations set biotime_department_id = $1, biotime_department_name = $2 where id = $3`,
        [DEPARTMENT_ID_DEMO, `[DÉMO] ${org.name}`, org.id],
      );
      console.log(
        `Département BioTime fictif assigné à ${org.name} (id ${DEPARTMENT_ID_DEMO}).`,
      );
    }

    // ---- Badgeuses (terminaux) assignées à l'école -------------------------
    for (const t of TERMINAUX_DEMO) {
      await central.query(
        `insert into biotime_terminals (serial_number, terminal_name, biotime_terminal_id, model, status, last_sync_at, organisation_id)
         values ($1, $2, $3, $4, 'ACTIVE', now() - interval '3 minutes', $5)
         on conflict (serial_number) do nothing`,
        [t.serial, t.nom, t.biotimeId, t.modele, org.id],
      );
    }
    const nbTerminaux = (
      await central.query(
        'select count(*)::int n from biotime_terminals where organisation_id = $1',
        [org.id],
      )
    ).rows[0].n;
    console.log(`${nbTerminaux} badgeuse(s) assignée(s) à ${org.name}.`);

    // ---- Statut de synchro des élèves (base de l'école) --------------------
    const ecole = new Client({ ...base, database: org.db_name });
    await ecole.connect();
    try {
      const enfants = (
        await ecole.query(
          `select id, emp_code from children where deleted_at is null and last_modified_source = 'demo' order by created_at`,
        )
      ).rows;

      if (enfants.length === 0) {
        console.log(
          "Aucun élève de démonstration trouvé — lancez d'abord `npm run demo:peupler`.",
        );
      } else {
        let biotimeId = 9200;
        for (let i = 0; i < enfants.length; i++) {
          const e = enfants[i];
          // Un élève sur six reste PENDING : une vraie synchro n'est jamais
          // parfaite à 100 %, ça reste crédible dans une démonstration.
          const enAttente = i % 6 === 5;
          if (enAttente) {
            await ecole.query(
              `update children set biotime_sync_status = 'PENDING', biotime_department_id = $1 where id = $2`,
              [DEPARTMENT_ID_DEMO, e.id],
            );
          } else {
            biotimeId++;
            await ecole.query(
              `update children
                 set biotime_id = $1, biotime_emp_code = $2, biotime_department_id = $3,
                     biotime_sync_status = 'SYNCED', biotime_sync_error = null
               where id = $4`,
              [biotimeId, e.emp_code, DEPARTMENT_ID_DEMO, e.id],
            );
          }
        }
        const repartition = (
          await ecole.query(
            `select biotime_sync_status, count(*)::int n from children where deleted_at is null group by biotime_sync_status`,
          )
        ).rows;
        console.log('\n=== statut de synchro BioTime (fictif) ===');
        for (const r of repartition)
          console.log(`  ${String(r.biotime_sync_status).padEnd(15)} ${r.n}`);
      }
    } finally {
      await ecole.end();
    }

    console.log(
      "\nRappel : ces données sont 100% fictives, aucun appel n'a été fait à un vrai serveur BioTime.",
    );
  } catch (e) {
    console.error('ECHEC :', e.message);
    process.exitCode = 1;
  } finally {
    await central.end();
  }
})();
