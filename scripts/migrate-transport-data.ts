import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config();

const superDbConfig = {
  host: process.env.SUPER_DB_HOST || 'localhost',
  port: parseInt(process.env.SUPER_DB_PORT || '5432'),
  database: process.env.SUPER_DB_NAME || 'smartbus_super',
  user: process.env.SUPER_DB_USER || 'postgres',
  password: process.env.SUPER_DB_PASSWORD || 'postgres',
};

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isSyncSchema = args.includes('--sync-schema');
const isCleanup = args.includes('--cleanup');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isUuid(str: string): boolean {
  return UUID_REGEX.test(str);
}

async function main() {
  console.log('=== DÉBUT DU SCRIPT DE MIGRATION TRANSPORT ===');
  console.log(`Configuration centrale : Host=${superDbConfig.host}, DB=${superDbConfig.database}`);
  console.log(`Mode : ${isDryRun ? 'DRY-RUN (Simulation)' : isSyncSchema ? 'SYNC-SCHEMA' : isCleanup ? 'CLEANUP' : 'RÉEL'}`);

  const superClient = new Client(superDbConfig);
  try {
    await superClient.connect();
  } catch (err: any) {
    console.error('❌ Impossible de se connecter à la base centrale :', err.message);
    process.exit(1);
  }

  // 1. Récupérer toutes les écoles provisionnées
  let schools: any[] = [];
  try {
    const res = await superClient.query(`
      SELECT id, name, code, db_name, db_host, db_port, db_user, db_password 
      FROM organisations 
      WHERE db_provisioned = true
    `);
    schools = res.rows;
    console.log(`ℹ️ Nombre d'écoles provisionnées trouvées : ${schools.length}`);
  } catch (err: any) {
    console.error('❌ Erreur lors de la lecture des organisations :', err.message);
    await superClient.end();
    process.exit(1);
  }

  // Si on est en mode SYNC-SCHEMA uniquement
  if (isSyncSchema) {
    await runSyncSchema(schools);
    await superClient.end();
    return;
  }

  // Si on est en mode CLEANUP uniquement
  if (isCleanup) {
    await runCleanup(superClient);
    await superClient.end();
    return;
  }

  // 2. Récupérer les données de transport de la base centrale
  console.log('🔍 Lecture des données de transport centrales...');
  let courses: any[] = [];
  let trajets: any[] = [];
  let points: any[] = [];
  let affectations: any[] = [];
  let montees: any[] = [];
  let alertes: any[] = [];

  try {
    courses = (await superClient.query('SELECT * FROM courses')).rows;
    trajets = (await superClient.query('SELECT * FROM trajets')).rows;
    points = (await superClient.query('SELECT * FROM points_recuperation')).rows;
    affectations = (await superClient.query('SELECT * FROM affectations')).rows;
    montees = (await superClient.query('SELECT * FROM montees')).rows;
    alertes = (await superClient.query('SELECT * FROM alertes')).rows;

    console.log(`- Courses : ${courses.length}`);
    console.log(`- Trajets : ${trajets.length}`);
    console.log(`- Points : ${points.length}`);
    console.log(`- Affectations : ${affectations.length}`);
    console.log(`- Montées : ${montees.length}`);
    console.log(`- Alertes : ${alertes.length}`);
  } catch (err: any) {
    console.error('❌ Erreur lors de la lecture des tables centrales :', err.message);
    await superClient.end();
    process.exit(1);
  }

  const orphanCourses: any[] = [];
  const schoolDataGroups: { [schoolId: string]: any } = {};

  // Initialiser les groupes pour chaque école
  for (const school of schools) {
    schoolDataGroups[school.id] = {
      school,
      courses: [],
      trajets: [],
      points: [],
      affectations: [],
      montees: [],
      alertes: [],
      resolvedCarUuids: {} // course.id -> car.id (UUID)
    };
  }

  // 3. Résolution multi-tenant stricte
  console.log('🧠 Résolution du tenant pour chaque course...');
  for (const course of courses) {
    let targetSchoolId: string | null = null;
    let resolvedCarUuid: string | null = null;

    const cTrajet = trajets.find(t => t.course_id === course.id);
    const cPoints = cTrajet ? points.filter(p => p.trajet_id === cTrajet.id) : [];
    const cPointsIds = cPoints.map(p => p.id);
    const cAffectations = affectations.filter(a => cPointsIds.includes(a.point_id));
    const cMontees = montees.filter(m => m.course_id === course.id);
    const cAlertes = alertes.filter(al => al.course_id === course.id);

    const relations = {
      course,
      trajet: cTrajet || null,
      points: cPoints,
      affectations: cAffectations,
      montees: cMontees,
      alertes: cAlertes
    };

    // Règle 1 : par Véhicule (match plaque d'immatriculation dans les bases écoles)
    if (course.car_id) {
      const match = await findSchoolAndCarUuidByPlate(schools, course.car_id);
      if (match) {
        targetSchoolId = match.schoolId;
        resolvedCarUuid = match.carUuid;

        // Phase 1.5 : Vérifier si l'UUID résolu est valide
        if (!resolvedCarUuid || !isUuid(resolvedCarUuid)) {
          console.error(`❌ Course "${course.nom}" : Véhicule "${course.car_id}" trouvé mais UUID manquant ou invalide : "${resolvedCarUuid}"`);
          orphanCourses.push({
            ...relations,
            error: "Véhicule trouvé mais UUID manquant"
          });
          continue;
        }
      }
    }

    // Règle 2 : par Chauffeur (match nom dans les bases écoles)
    if (!targetSchoolId && course.chauffeur) {
      targetSchoolId = await findSchoolByDriverName(schools, course.chauffeur);
    }

    // Règle 3 : Gestion orphelin
    if (!targetSchoolId) {
      console.warn(`⚠️ Course "${course.nom}" (ID: ${course.id}) déclarée ORPHELINE. Aucun véhicule ou chauffeur correspondant trouvé.`);
      orphanCourses.push({
        ...relations,
        error: "Aucune école correspondante trouvée"
      });
      continue;
    }

    // Classer les données par école résolue
    const group = schoolDataGroups[targetSchoolId];
    group.courses.push(course);
    if (resolvedCarUuid) {
      group.resolvedCarUuids[course.id] = resolvedCarUuid;
    }
    
    if (cTrajet) {
      group.trajets.push(cTrajet);
      group.points.push(...cPoints);
      group.affectations.push(...cAffectations);
    }

    group.montees.push(...cMontees);
    group.alertes.push(...cAlertes);
  }

  // 4. Écrire le fichier des orphelins si nécessaire
  if (orphanCourses.length > 0) {
    const orphanPath = path.join(process.cwd(), 'orphan_courses.json');
    fs.writeFileSync(orphanPath, JSON.stringify(orphanCourses, null, 2));
    console.error(`🔴 ${orphanCourses.length} courses orphelines exportées dans : ${orphanPath}`);
  } else {
    // Nettoyer l'ancien fichier orphelin s'il n'y en a plus
    const orphanPath = path.join(process.cwd(), 'orphan_courses.json');
    if (fs.existsSync(orphanPath)) fs.unlinkSync(orphanPath);
  }

  // 5. Exécution de la copie dans les bases écoles
  for (const schoolId of Object.keys(schoolDataGroups)) {
    const group = schoolDataGroups[schoolId];
    if (group.courses.length === 0) continue;

    console.log(`⚙️ Migration vers l'école "${group.school.name}" (${group.courses.length} courses)...`);
    
    const schoolClient = new Client({
      host: group.school.db_host || superDbConfig.host,
      port: group.school.db_port || superDbConfig.port,
      database: group.school.db_name,
      user: group.school.db_user || superDbConfig.user,
      password: group.school.db_password || superDbConfig.password,
    });

    try {
      await schoolClient.connect();
    } catch (err: any) {
      console.error(`❌ Impossible de se connecter à la base de ${group.school.name} :`, err.message);
      continue;
    }

    try {
      if (isDryRun) {
        console.log(`[DRY-RUN] Simulation de l'insertion de ${group.courses.length} courses dans ${group.school.db_name}`);
        for (const course of group.courses) {
          const resolvedCarUuid = group.resolvedCarUuids[course.id];
          console.log(`[DRY-RUN] -> Course "${course.nom}" liée au véhicule UUID : ${resolvedCarUuid || 'Aucun'}`);
        }
        continue;
      }

      await schoolClient.query('BEGIN');

      // Ajouter temporairement la colonne old_central_id si elle n'existe pas
      await schoolClient.query(`
        ALTER TABLE courses ADD COLUMN IF NOT EXISTS old_central_id VARCHAR(50);
      `);

      for (const course of group.courses) {
        // Résolution du véhicule UUID via notre mapping pré-résolu
        const realCarId = group.resolvedCarUuids[course.id] || null;

        // Résolution ID Chauffeur réel si possible
        let realDriverId: string | null = null;
        if (course.chauffeur) {
          const dRes = await schoolClient.query(
            "SELECT id FROM drivers WHERE first_name || ' ' || last_name = $1 OR last_name = $1 LIMIT 1",
            [course.chauffeur]
          );
          if (dRes.rows.length > 0) realDriverId = dRes.rows[0].id;
        }

        // Insérer ou mettre à jour la Course
        const courseRes = await schoolClient.query(`
          INSERT INTO courses (
            id, nom, description, car_id, chauffeur, ecole, heure_depart, heure_arrivee, 
            "joursExecution", statut, couleur_carte, route, markers, old_central_id, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $1, $14, $15)
          ON CONFLICT (id) DO UPDATE SET 
            nom = EXCLUDED.nom, 
            description = EXCLUDED.description,
            car_id = EXCLUDED.car_id,
            chauffeur = EXCLUDED.chauffeur,
            heure_depart = EXCLUDED.heure_depart,
            heure_arrivee = EXCLUDED.heure_arrivee,
            "joursExecution" = EXCLUDED."joursExecution",
            statut = EXCLUDED.statut,
            route = EXCLUDED.route,
            markers = EXCLUDED.markers,
            updated_at = NOW()
          RETURNING id
        `, [
          course.id, course.nom, course.description, realCarId, course.chauffeur, course.ecole, 
          course.heure_depart, course.heure_arrivee, JSON.stringify(course.joursExecution), 
          course.statut, course.couleur_carte, JSON.stringify(course.route), 
          JSON.stringify(course.markers), course.created_at, course.updated_at
        ]);

        const newCourseId = courseRes.rows[0].id;

        // Récupérer le trajet lié
        const trajet = group.trajets.find((t: any) => t.course_id === course.id);
        if (trajet) {
          await schoolClient.query(`
            INSERT INTO trajets (id, course_id, "geoJson", created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (id) DO UPDATE SET "geoJson" = EXCLUDED."geoJson"
          `, [trajet.id, newCourseId, JSON.stringify(trajet.geoJson), trajet.created_at, trajet.updated_at]);

          // Récupérer les arrêts liés
          const pts = group.points.filter((p: any) => p.trajet_id === trajet.id);
          for (const pt of pts) {
            await schoolClient.query(`
              INSERT INTO points_recuperation (
                id, trajet_id, nom, latitude, longitude, ordre_passage, temps_arret, commentaire, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              ON CONFLICT (id) DO UPDATE SET 
                nom = EXCLUDED.nom, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
                ordre_passage = EXCLUDED.ordre_passage, temps_arret = EXCLUDED.temps_arret
            `, [
              pt.id, pt.trajet_id, pt.nom, pt.latitude, pt.longitude, pt.ordre_passage, 
              pt.temps_arret, pt.commentaire, pt.created_at, pt.updated_at
            ]);

            // Récupérer les affectations
            const affs = group.affectations.filter((a: any) => a.point_id === pt.id);
            for (const aff of affs) {
              await schoolClient.query(`
                INSERT INTO affectations (id, point_id, child_id, ordre_montee, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (id) DO NOTHING
              `, [aff.id, aff.point_id, aff.child_id, aff.ordre_montee, aff.created_at, aff.updated_at]);
            }
          }
        }

        // Récupérer les montées liées
        const mnts = group.montees.filter((m: any) => m.course_id === course.id);
        for (const mnt of mnts) {
          await schoolClient.query(`
            INSERT INTO montees (
              id, child_id, course_id, car_id, point_id, date, heure, distance_gps, statut, "validationMessage", created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (id) DO NOTHING
          `, [
            mnt.id, mnt.child_id, newCourseId, realCarId, mnt.point_id, mnt.date, 
            mnt.heure, mnt.distance_gps, mnt.statut, mnt.validationMessage, mnt.created_at, mnt.updated_at
          ]);
        }

        // Récupérer les alertes liées
        const alts = group.alertes.filter((al: any) => al.course_id === course.id);
        for (const alt of alts) {
          await schoolClient.query(`
            INSERT INTO alertes (
              id, type, description, date, heure, child_id, car_id, course_id, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO NOTHING
          `, [
            alt.id, alt.type, alt.description, alt.date, alt.heure, alt.child_id, 
            realCarId, newCourseId, alt.created_at, alt.updated_at
          ]);
        }
      }

      // 6. Migration des BiometricEvent Historiques
      console.log(`📈 Migration des pointages biométriques historiques pour ${group.school.name}...`);
      
      // Vérifier si la table biometric_events contient la colonne trip_id
      const colCheck = await schoolClient.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'biometric_events' AND column_name = 'trip_id'
      `);

      if (colCheck.rows.length > 0) {
        // Récupérer tous les événements biométriques
        const events = (await schoolClient.query('SELECT * FROM biometric_events WHERE trip_id IS NOT NULL')).rows;
        console.log(`- Pointages biométriques trouvés : ${events.length}`);

        for (const evt of events) {
          // Rechercher le Trip associé
          const tripRes = await schoolClient.query('SELECT route_id FROM trips WHERE id = $1', [evt.trip_id]);
          let matchingCourseId: string | null = null;

          if (tripRes.rows.length > 0) {
            const routeId = tripRes.rows[0].route_id;
            // Trouver la Route pour obtenir le nom
            const routeRes = await schoolClient.query('SELECT name FROM routes WHERE id = $1', [routeId]);
            if (routeRes.rows.length > 0) {
              const routeName = routeRes.rows[0].name;
              // Chercher une nouvelle Course migrée avec le même nom (ou approchant)
              const matchCourse = await schoolClient.query('SELECT id FROM courses WHERE nom = $1 LIMIT 1', [routeName]);
              if (matchCourse.rows.length > 0) {
                matchingCourseId = matchCourse.rows[0].id;
              }
            }
          }

          if (matchingCourseId) {
            // Associer l'événement à la nouvelle course
            await schoolClient.query('UPDATE biometric_events SET course_id = $1, trip_id = NULL WHERE id = $2', [matchingCourseId, evt.id]);
          } else {
            // Archiver l'événement orphelin
            await schoolClient.query(`
              INSERT INTO archived_biometric_events (
                id, old_trip_id, child_id, type, occurred_at, latitude, longitude, stop_name, notification_sent, confidence_score
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              ON CONFLICT (id) DO NOTHING
            `, [
              evt.id, evt.trip_id, evt.child_id, evt.type, evt.occurred_at, evt.latitude, 
              evt.longitude, evt.stop_name, evt.notification_sent, evt.confidence_score
            ]);
            await schoolClient.query('DELETE FROM biometric_events WHERE id = $1', [evt.id]);
          }
        }
      }

      await schoolClient.query('COMMIT');
      console.log(`✅ Migration réussie pour l'école "${group.school.name}"`);
    } catch (err: any) {
      await schoolClient.query('ROLLBACK');
      console.error(`❌ Échec de la transaction pour ${group.school.name} :`, err.message);
    } finally {
      await schoolClient.end();
    }
  }

  await superClient.end();
  console.log('=== FIN DU SCRIPT DE MIGRATION ===');
}

// Fonction pour synchroniser le schéma de toutes les écoles
async function runSyncSchema(schools: any[]) {
  console.log('🔄 DÉBUT DE LA SYNCHRONISATION DU SCHÉMA SUR TOUS LES TENANTS...');
  
  for (const school of schools) {
    console.log(`⚙️ Synchronisation de la base : ${school.db_name}...`);

    const client = new Client({
      host: school.db_host || superDbConfig.host,
      port: school.db_port || superDbConfig.port,
      database: school.db_name,
      user: school.db_user || superDbConfig.user,
      password: school.db_password || superDbConfig.password,
    });

    try {
      await client.connect();

      // 1. Créer les nouvelles tables en français si elles n'existent pas
      // Courses
      await client.query(`
        CREATE TABLE IF NOT EXISTS courses (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          nom VARCHAR(255) NOT NULL,
          description TEXT,
          car_id UUID,
          chauffeur VARCHAR(255),
          ecole VARCHAR(255),
          heure_depart TIME,
          heure_arrivee TIME,
          "joursExecution" JSONB,
          statut VARCHAR(50) DEFAULT 'active',
          couleur_carte VARCHAR(50),
          route JSONB,
          markers JSONB,
          old_central_id VARCHAR(50),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // Trajets
      await client.query(`
        CREATE TABLE IF NOT EXISTS trajets (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
          "geoJson" JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // Points Récupération
      await client.query(`
        CREATE TABLE IF NOT EXISTS points_recuperation (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          trajet_id UUID REFERENCES trajets(id) ON DELETE CASCADE,
          nom VARCHAR(255) NOT NULL,
          latitude NUMERIC(10, 7) NOT NULL,
          longitude NUMERIC(10, 7) NOT NULL,
          ordre_passage INT DEFAULT 0,
          temps_arret VARCHAR(50),
          commentaire TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // Affectations
      await client.query(`
        CREATE TABLE IF NOT EXISTS affectations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          point_id UUID REFERENCES points_recuperation(id) ON DELETE CASCADE,
          child_id UUID NOT NULL, -- Sera lié localement à children(id)
          ordre_montee INT DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // Montées
      await client.query(`
        CREATE TABLE IF NOT EXISTS montees (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          child_id UUID NOT NULL,
          course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
          car_id UUID,
          point_id UUID REFERENCES points_recuperation(id) ON DELETE SET NULL,
          date DATE NOT NULL,
          heure TIME NOT NULL,
          distance_gps NUMERIC(8, 2),
          statut VARCHAR(50) DEFAULT 'valide',
          "validationMessage" TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // Alertes
      await client.query(`
        CREATE TABLE IF NOT EXISTS alertes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          type VARCHAR(100) NOT NULL,
          description TEXT,
          date DATE NOT NULL,
          heure TIME NOT NULL,
          child_id UUID,
          car_id UUID,
          course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // Table d'archivage des événements biométriques
      await client.query(`
        CREATE TABLE IF NOT EXISTS archived_biometric_events (
          id UUID PRIMARY KEY,
          old_trip_id UUID,
          child_id UUID,
          type VARCHAR(50),
          occurred_at TIMESTAMPTZ,
          latitude NUMERIC(10, 7),
          longitude NUMERIC(10, 7),
          stop_name VARCHAR(255),
          notification_sent BOOLEAN DEFAULT FALSE,
          confidence_score NUMERIC(5, 2),
          archived_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // 2. Préparer la transition de biometric_events (ajouter course_id)
      await client.query(`
        ALTER TABLE biometric_events ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE CASCADE;
      `);

      console.log(`✅ Base ${school.db_name} synchronisée avec succès.`);
    } catch (err: any) {
      console.error(`❌ Échec de la synchronisation de ${school.db_name} :`, err.message);
    } finally {
      await client.end();
    }
  }
}

// Fonction de nettoyage
async function runCleanup(superClient: Client) {
  console.log('🧹 DÉBUT DU NETTOYAGE CENTRAL (SUPPRESSION DES TABLES DANS SUPER DB)...');
  try {
    await superClient.query('DROP TABLE IF EXISTS alertes CASCADE');
    await superClient.query('DROP TABLE IF EXISTS montees CASCADE');
    await superClient.query('DROP TABLE IF EXISTS affectations CASCADE');
    await superClient.query('DROP TABLE IF EXISTS points_recuperation CASCADE');
    await superClient.query('DROP TABLE IF EXISTS trajets CASCADE');
    await superClient.query('DROP TABLE IF EXISTS courses CASCADE');
    console.log('✅ Nettoyage central effectué avec succès.');
  } catch (err: any) {
    console.error('❌ Erreur lors du nettoyage central :', err.message);
  }
}

// Helpers de résolution
async function findSchoolAndCarUuidByPlate(schools: any[], carPlate: string): Promise<{ schoolId: string, carUuid: string } | null> {
  for (const school of schools) {
    const client = new Client({
      host: school.db_host || superDbConfig.host,
      port: school.db_port || superDbConfig.port,
      database: school.db_name,
      user: school.db_user || superDbConfig.user,
      password: school.db_password || superDbConfig.password,
    });
    try {
      await client.connect();
      const res = await client.query('SELECT id FROM cars WHERE plate_number = $1 LIMIT 1', [carPlate]);
      if (res.rows.length > 0) {
        return { schoolId: school.id, carUuid: res.rows[0].id };
      }
    } catch (err) {
      // Ignorer
    } finally {
      await client.end();
    }
  }
  return null;
}

async function findSchoolByDriverName(schools: any[], driverName: string): Promise<string | null> {
  for (const school of schools) {
    const client = new Client({
      host: school.db_host || superDbConfig.host,
      port: school.db_port || superDbConfig.port,
      database: school.db_name,
      user: school.db_user || superDbConfig.user,
      password: school.db_password || superDbConfig.password,
    });
    try {
      await client.connect();
      const res = await client.query(
        "SELECT id FROM drivers WHERE first_name || ' ' || last_name = $1 OR last_name = $1 LIMIT 1",
        [driverName]
      );
      if (res.rows.length > 0) {
        return school.id;
      }
    } catch (err) {
      // Ignorer
    } finally {
      await client.end();
    }
  }
  return null;
}

main().catch(err => {
  console.error('Fatal error in migration script:', err);
  process.exit(1);
});
