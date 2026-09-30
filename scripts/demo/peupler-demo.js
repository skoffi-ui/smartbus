// Peuple l'école nangui abrogua avec un jeu de démonstration cohérent.
//
// Les données existantes de l'utilisateur (3 véhicules, 1 chauffeur, 1 parent,
// 1 enfant) sont conservées : on ajoute autour d'elles. Tout est inséré dans une
// transaction, et chaque ligne créée porte `last_modified_source = 'demo'` pour
// pouvoir être retirée d'un seul coup si besoin.
const path = require('path');
const R = path.resolve(__dirname, '../..');
require(path.join(R, 'node_modules/dotenv')).config({
  path: path.join(R, '.env'),
});
const { Client } = require(path.join(R, 'node_modules/pg'));

const MARQUE = 'demo';

/** Distance en km entre deux points (formule de Haversine). */
function haversine(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const Rt = 6371;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * Rt * Math.asin(Math.sqrt(h));
}

/** Longueur cumulée d'une suite de points, majorée de 30 % (le trajet routier n'est pas à vol d'oiseau). */
function longueurRoute(pts) {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += haversine(pts[i - 1], pts[i]);
  return Math.round(d * 1.3 * 100) / 100;
}

// L'école : campus de Nangui Abrogoua, Abobo.
const ECOLE = { nom: 'École Nangui Abrogua', lat: 5.4028, lng: -4.0169 };

const TRAJETS = [
  {
    nom: 'Aller Matin — Riviera / Cocody',
    description: "Ramassage matinal depuis la Riviera et Cocody vers l'école.",
    sens: 'aller',
    points: [
      {
        nom: 'Riviera Palmeraie',
        lat: 5.3556,
        lng: -3.9636,
        type: 'depart',
        temps: '06:15',
      },
      {
        nom: 'Riviera 2 — Carrefour',
        lat: 5.3489,
        lng: -3.9861,
        type: 'arret',
        temps: '06:30',
      },
      {
        nom: 'Cocody Angré 7e Tranche',
        lat: 5.3897,
        lng: -3.9758,
        type: 'arret',
        temps: '06:45',
      },
      {
        nom: 'Deux Plateaux Vallon',
        lat: 5.3722,
        lng: -3.9944,
        type: 'arret',
        temps: '07:00',
      },
      {
        nom: 'Cocody Danga',
        lat: 5.3417,
        lng: -4.0028,
        type: 'arret',
        temps: '07:15',
      },
      {
        nom: ECOLE.nom,
        lat: ECOLE.lat,
        lng: ECOLE.lng,
        type: 'arrivee',
        temps: '07:40',
      },
    ],
  },
  {
    nom: 'Aller Matin — Abobo / Adjamé',
    description: "Ramassage matinal depuis Abobo et Adjamé vers l'école.",
    sens: 'aller',
    points: [
      {
        nom: 'Abobo Gare',
        lat: 5.4231,
        lng: -4.0197,
        type: 'depart',
        temps: '06:20',
      },
      {
        nom: 'Abobo Avocatier',
        lat: 5.4156,
        lng: -4.0289,
        type: 'arret',
        temps: '06:35',
      },
      {
        nom: 'Adjamé Liberté',
        lat: 5.3564,
        lng: -4.0247,
        type: 'arret',
        temps: '06:55',
      },
      {
        nom: 'Adjamé 220 Logements',
        lat: 5.3639,
        lng: -4.0311,
        type: 'arret',
        temps: '07:10',
      },
      {
        nom: ECOLE.nom,
        lat: ECOLE.lat,
        lng: ECOLE.lng,
        type: 'arrivee',
        temps: '07:35',
      },
    ],
  },
  {
    nom: 'Retour Soir — Riviera / Cocody',
    description: "Dépose du soir de l'école vers la Riviera et Cocody.",
    sens: 'retour',
    points: [
      {
        nom: ECOLE.nom,
        lat: ECOLE.lat,
        lng: ECOLE.lng,
        type: 'depart',
        temps: '16:30',
      },
      {
        nom: 'Cocody Danga',
        lat: 5.3417,
        lng: -4.0028,
        type: 'arret',
        temps: '16:55',
      },
      {
        nom: 'Deux Plateaux Vallon',
        lat: 5.3722,
        lng: -3.9944,
        type: 'arret',
        temps: '17:10',
      },
      {
        nom: 'Cocody Angré 7e Tranche',
        lat: 5.3897,
        lng: -3.9758,
        type: 'arret',
        temps: '17:25',
      },
      {
        nom: 'Riviera 2 — Carrefour',
        lat: 5.3489,
        lng: -3.9861,
        type: 'arret',
        temps: '17:45',
      },
      {
        nom: 'Riviera Palmeraie',
        lat: 5.3556,
        lng: -3.9636,
        type: 'arrivee',
        temps: '18:00',
      },
    ],
  },
];

const PARENTS = [
  ['Aya', 'Koffi', '+225 07 08 12 34 56'],
  ['Mamadou', 'Traoré', '+225 05 46 78 90 12'],
  ['Fatou', 'Bamba', '+225 01 23 45 67 89'],
  ['Kouassi', "N'Guessan", '+225 07 77 88 99 00'],
  ['Adjoua', 'Yao', '+225 05 11 22 33 44'],
  ['Ibrahim', 'Cissé', '+225 01 55 66 77 88'],
  ['Mariam', 'Ouattara', '+225 07 99 00 11 22'],
  ['Serge', 'Kouamé', '+225 05 33 44 55 66'],
  ['Akissi', 'Diabaté', '+225 01 77 88 99 11'],
];

const ENFANTS = [
  ['Awa', 'Koffi', 'F', 'CM2', 2014],
  ['Yacouba', 'Traoré', 'M', 'CM1', 2015],
  ['Aminata', 'Bamba', 'F', 'CE2', 2016],
  ['Jean-Marc', "N'Guessan", 'M', 'CM2', 2014],
  ['Affoué', 'Yao', 'F', '6e', 2013],
  ['Souleymane', 'Cissé', 'M', 'CE1', 2017],
  ['Hawa', 'Ouattara', 'F', 'CM1', 2015],
  ['Emmanuel', 'Kouamé', 'M', '5e', 2012],
  ['Rokia', 'Diabaté', 'F', 'CP2', 2018],
  ['Bakary', 'Traoré', 'M', 'CE2', 2016],
  ['Nadège', 'Koffi', 'F', '6e', 2013],
];

const CHAUFFEURS = [
  ['Ousmane', 'Sangaré', '+225 07 44 55 66 77', 'CI-PL-449201', '2027-08-31'],
  ['Désiré', 'Gnamien', '+225 05 88 99 00 11', 'CI-PL-518874', '2028-03-15'],
];

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
  await cl.query('BEGIN');

  try {
    // ---- Chauffeurs ------------------------------------------------------
    for (const [p, n, tel, permis, exp] of CHAUFFEURS) {
      await cl.query(
        `insert into drivers (first_name, last_name, phone, license_number, license_expiry, status, active, last_modified_source)
         values ($1,$2,$3,$4,$5,'active',true,$6)
         on conflict do nothing`,
        [p, n, tel, permis, exp, MARQUE],
      );
    }
    const chauffeurs = (
      await cl.query(
        'select id, first_name, last_name from drivers order by created_at',
      )
    ).rows;

    // ---- Véhicules : compléter à 4 ---------------------------------------
    const nbCars = (
      await cl.query(
        'select count(*)::int n from cars where deleted_at is null',
      )
    ).rows[0].n;
    if (nbCars < 4) {
      await cl.query(
        `insert into cars (plate_number, brand, model, year, capacity, is_active, gps_device_id, biotime_terminal_sn, last_modified_source)
         values ('4521 KA 01','Toyota','Coaster',2019,30,true,'GPS-NNG-004','ZK-NNG-004',$1)`,
        [MARQUE],
      );
    }
    const cars = (
      await cl.query(
        'select id, plate_number from cars where deleted_at is null order by created_at',
      )
    ).rows;

    // ---- Parents ---------------------------------------------------------
    for (const [p, n, tel] of PARENTS) {
      await cl.query(
        `insert into parents (first_name, last_name, phone, email, active, last_modified_source)
         values ($1,$2,$3,$4,true,$5) on conflict do nothing`,
        [
          p,
          n,
          tel,
          `${p}.${n}`
            .toLowerCase()
            .normalize('NFD')
            .replace(/[^a-z.]/g, '') + '@exemple.ci',
          MARQUE,
        ],
      );
    }
    const parents = (
      await cl.query(
        'select id, first_name, last_name from parents where deleted_at is null order by created_at',
      )
    ).rows;

    // ---- Enfants ---------------------------------------------------------
    let matricule = 1000;
    for (const [p, n, sexe, classe, annee] of ENFANTS) {
      matricule++;
      const parent = parents.find((x) => x.last_name === n) || parents[0];
      await cl.query(
        `insert into children (parent_id, first_name, last_name, date_of_birth, gender, student_id, emp_code,
                               class_name, biometric_enrolled, is_active, last_modified_source)
         values ($1,$2,$3,$4,$5,$6,$7,$8,true,true,$9) on conflict do nothing`,
        [
          parent.id,
          p,
          n,
          `${annee}-0${(matricule % 9) + 1}-1${matricule % 9}`,
          sexe,
          `NNG-${matricule}`,
          String(matricule),
          classe,
          MARQUE,
        ],
      );
    }
    const enfants = (
      await cl.query(
        'select id, first_name, last_name, emp_code from children where deleted_at is null order by created_at',
      )
    ).rows;

    // ---- Trajets, points, affectations, courses --------------------------
    let iEnfant = 0;
    const coursesCreees = [];

    for (let t = 0; t < TRAJETS.length; t++) {
      const tr = TRAJETS[t];
      const coords = tr.points.map((p) => ({ lat: p.lat, lng: p.lng }));
      const km = longueurRoute(coords);
      const minutes = Math.round((km / 22) * 60); // 22 km/h de moyenne dans Abidjan

      const trajet = (
        await cl.query(
          `insert into trajets (nom, description, sens, distance_km, duree_estimative, waypoints, "geoJson", last_modified_source)
           values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
          [
            tr.nom,
            tr.description,
            tr.sens,
            km,
            minutes,
            JSON.stringify(coords),
            JSON.stringify({
              type: 'LineString',
              coordinates: coords.map((c) => [c.lng, c.lat]),
            }),
            MARQUE,
          ],
        )
      ).rows[0];

      const pointsIds = [];
      for (let i = 0; i < tr.points.length; i++) {
        const p = tr.points[i];
        const r = await cl.query(
          `insert into points_recuperation (trajet_id, nom, latitude, longitude, ordre_passage,
                                            temps_arret, type, rayon_detection, last_modified_source)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
          [
            trajet.id,
            p.nom,
            p.lat,
            p.lng,
            i,
            p.temps,
            p.type,
            p.type === 'arrivee' ? 150 : 100,
            MARQUE,
          ],
        );
        pointsIds.push({ id: r.rows[0].id, type: p.type, nom: p.nom });
      }

      // Affecter des enfants aux arrêts intermédiaires (ni le départ ni l'arrivée à l'école)
      const arrets = pointsIds.filter((p) => p.type === 'arret');
      if (tr.sens === 'aller') {
        for (const arret of arrets) {
          for (let k = 0; k < 2 && iEnfant < enfants.length; k++, iEnfant++) {
            await cl.query(
              `insert into affectations (point_id, child_id, ordre_montee, last_modified_source)
               values ($1,$2,$3,$4) on conflict do nothing`,
              [arret.id, enfants[iEnfant].id, k, MARQUE],
            );
          }
        }
      }

      const car = cars[t % cars.length];
      const ch = chauffeurs[t % chauffeurs.length];
      const course = (
        await cl.query(
          `insert into courses (nom, description, trajet_id, type, heure_depart, heure_arrivee,
                                "joursExecution", statut, couleur_carte, car_id, driver_id, chauffeur, ecole, last_modified_source)
           values ($1,$2,$3,$4,$5,$6,$7,'active',$8,$9,$10,$11,$12,$13) returning id`,
          [
            tr.sens === 'retour'
              ? 'Course Soir — ' + tr.nom.split('— ')[1]
              : 'Course Matin — ' + tr.nom.split('— ')[1],
            `Exécution quotidienne du trajet « ${tr.nom} ».`,
            trajet.id,
            tr.sens === 'retour' ? 'soir' : 'matin',
            tr.points[0].temps + ':00',
            tr.points[tr.points.length - 1].temps + ':00',
            JSON.stringify(['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi']),
            ['#2563eb', '#16a34a', '#d97706'][t % 3],
            car.id,
            ch.id,
            `${ch.first_name} ${ch.last_name}`,
            ECOLE.nom,
            MARQUE,
          ],
        )
      ).rows[0];

      coursesCreees.push({
        id: course.id,
        carId: car.id,
        points: pointsIds,
        sens: tr.sens,
        trajetId: trajet.id,
      });
    }

    // ---- Historique de montées sur les 7 derniers jours -------------------
    const affectations = (
      await cl.query(
        `select a.child_id, a.point_id, p.trajet_id, p.nom point_nom
           from affectations a join points_recuperation p on p.id = a.point_id`,
      )
    ).rows;

    let nbMontees = 0;
    for (let jour = 7; jour >= 1; jour--) {
      const d = new Date();
      d.setDate(d.getDate() - jour);
      if (d.getDay() === 0 || d.getDay() === 6) continue; // pas d'école le week-end
      const date = d.toISOString().slice(0, 10);

      for (const a of affectations) {
        const course = coursesCreees.find((c) => c.trajetId === a.trajet_id);
        if (!course) continue;
        // 8 % d'absences, pour que l'historique ne soit pas artificiellement parfait
        if (Math.random() < 0.08) continue;
        const refuse = Math.random() < 0.05;

        for (const sens of ['montee', 'descente']) {
          const h =
            sens === 'montee'
              ? 6 + Math.floor(Math.random() * 2)
              : 16 + Math.floor(Math.random() * 2);
          await cl.query(
            `insert into montees (child_id, course_id, car_id, point_id, date, heure, distance_gps, statut, sens, "validationMessage", last_modified_source)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [
              a.child_id,
              course.id,
              course.carId,
              a.point_id,
              date,
              `${String(h).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00`,
              Math.round(Math.random() * 80),
              refuse && sens === 'montee' ? 'refuse' : 'valide',
              sens,
              refuse && sens === 'montee'
                ? `Badge hors du rayon de l'arrêt ${a.point_nom}.`
                : null,
              MARQUE,
            ],
          );
          nbMontees++;
        }
      }
    }

    // ---- Exécutions du jour : une course en cours pour l'écran de suivi ----
    const aujourdhui = new Date().toISOString().slice(0, 10);
    for (let i = 0; i < coursesCreees.length; i++) {
      const c = coursesCreees[i];
      const ch = chauffeurs[i % chauffeurs.length];
      await cl.query(
        `insert into course_executions (course_id, car_id, driver_id, execution_date, status, started_at, ended_at, last_modified_source)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          c.id,
          c.carId,
          ch.id,
          aujourdhui,
          i === 0 ? 'IN_PROGRESS' : i === 1 ? 'COMPLETED' : 'PLANNED',
          i <= 1 ? new Date(Date.now() - 3600e3) : null,
          i === 1 ? new Date(Date.now() - 1800e3) : null,
          MARQUE,
        ],
      );
    }

    // ---- Alertes critiques ------------------------------------------------
    const alertes = [
      [
        'mauvais_arret',
        'MEDIUM',
        "a badgé à « Cocody Danga » alors qu'il est affecté à « Deux Plateaux Vallon ».",
        false,
      ],
      [
        'mauvais_car',
        'HIGH',
        'a badgé dans le véhicule 4521 KA 01 au lieu de son véhicule habituel.',
        false,
      ],
      [
        'badge_hors_horaire',
        'LOW',
        'a badgé à 19h12, en dehors des horaires de la course du soir.',
        true,
      ],
    ];
    for (let i = 0; i < alertes.length; i++) {
      const [type, sev, msg, resolue] = alertes[i];
      const e = enfants[i % enfants.length];
      const car = cars[i % cars.length];
      await cl.query(
        `insert into alertes_critiques (type, severity, message, child_id, child_name, child_emp_code,
                                        detected_car_id, detected_car_plate, punch_time, resolved, resolved_at,
                                        resolved_by, resolution_note, last_modified_source)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          type,
          sev,
          `${e.first_name} ${e.last_name} ${msg}`,
          e.id,
          `${e.first_name} ${e.last_name}`,
          e.emp_code,
          car.id,
          car.plate_number,
          new Date(Date.now() - (i + 1) * 7200e3),
          resolue,
          resolue ? new Date(Date.now() - 3600e3) : null,
          resolue ? 'Direction' : null,
          resolue
            ? 'Vérifié auprès du parent : sortie exceptionnelle autorisée.'
            : null,
          MARQUE,
        ],
      );
    }

    await cl.query('COMMIT');

    console.log('\n=== jeu de démonstration créé ===');
    for (const t of [
      'cars',
      'drivers',
      'parents',
      'children',
      'trajets',
      'points_recuperation',
      'courses',
      'affectations',
      'montees',
      'course_executions',
      'alertes_critiques',
    ]) {
      const n = (await cl.query(`select count(*)::int n from ${t}`)).rows[0].n;
      console.log(`  ${t.padEnd(20)} ${n}`);
    }
    console.log(
      `\n  (${nbMontees} montées/descentes réparties sur les 7 derniers jours ouvrés)`,
    );
  } catch (e) {
    await cl.query('ROLLBACK');
    console.error('ECHEC, transaction annulée :', e.message);
    process.exitCode = 1;
  } finally {
    await cl.end();
  }
})();
