const { Client } = require('pg');

// Connexion à la base smartbus_super pour trouver la liste des écoles
async function run() {
  const superClient = new Client({
    host: 'localhost',
    port: 5432,
    database: 'smartbus_super',
    user: 'postgres',
    password: 'postgres',
  });

  try {
    await superClient.connect();

    // Trouver toutes les bases école
    const orgsResult = await superClient.query(`
      SELECT id, name, db_name FROM organisations WHERE db_name IS NOT NULL AND db_provisioned = true
    `);
    console.log(
      `${orgsResult.rows.length} école(s) trouvée(s):`,
      orgsResult.rows.map((r) => r.name),
    );

    await superClient.end();

    // Pour chaque école, corriger les URLs dans la table children
    for (const org of orgsResult.rows) {
      const schoolClient = new Client({
        host: 'localhost',
        port: 5432,
        database: org.db_name,
        user: 'postgres',
        password: 'postgres',
      });

      try {
        await schoolClient.connect();

        // 1. Corriger les URLs sans port
        const fixResult = await schoolClient.query(`
          UPDATE children 
          SET photo_url = REPLACE(photo_url, 'http://160.120.143.20/', 'http://160.120.143.20:8080/')
          WHERE photo_url LIKE 'http://160.120.143.20/%'
          AND photo_url NOT LIKE 'http://160.120.143.20:8080/%'
          RETURNING id, photo_url
        `);
        console.log(
          `[${org.name}] URLs corrigées (port 8080): ${fixResult.rowCount}`,
        );

        // 2. Voir les enfants sans photo mais avec empCode
        const noPhotoResult = await schoolClient.query(`
          SELECT id, emp_code, first_name, last_name FROM children 
          WHERE (photo_url IS NULL OR photo_url = '') AND emp_code IS NOT NULL
        `);
        console.log(
          `[${org.name}] Enfants sans photo (mais avec empCode): ${noPhotoResult.rowCount}`,
        );

        // 3. Directement injecter l'URL photo depuis BioTime pour ceux qui n'en ont pas
        for (const child of noPhotoResult.rows) {
          const photoUrl = `http://160.120.143.20:8080/auth_files/photo/${child.emp_code}.jpg`;
          await schoolClient.query(
            `UPDATE children SET photo_url = $1 WHERE id = $2`,
            [photoUrl, child.id],
          );
        }
        if (noPhotoResult.rowCount > 0) {
          console.log(
            `[${org.name}] ✅ ${noPhotoResult.rowCount} photos injectées directement`,
          );
        }
      } catch (err) {
        console.error(`Erreur pour l'école ${org.name}:`, err.message);
      } finally {
        await schoolClient.end();
      }
    }

    console.log(
      '\n✅ Correction terminée ! Rechargez la page /children dans votre navigateur.',
    );
  } catch (err) {
    console.error('Erreur connexion super DB:', err.message);
  }
}

run();
