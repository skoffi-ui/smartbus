const { Client } = require('pg');
const bcrypt = require('bcrypt');

async function main() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'smartbus_super',
    user: 'postgres',
    password: 'postgres'
  });

  try {
    await client.connect();
    const hash = await bcrypt.hash('password123', 12);
    
    console.log('🔄 Mise à jour des mots de passe en base centrale...');
    
    // Mettre à jour john.doe@smartbus.com (Super Admin)
    await client.query('UPDATE users SET password = $1 WHERE email = $2', [hash, 'john.doe@smartbus.com']);
    console.log('✅ john.doe@smartbus.com mis à jour.');
    
    // Mettre à jour direction@ecole.com (School Admin)
    await client.query('UPDATE users SET password = $1 WHERE email = $2', [hash, 'direction@ecole.com']);
    console.log('✅ direction@ecole.com mis à jour.');

    // Mettre à jour direction@sainte-marie.sn (School Admin)
    await client.query('UPDATE users SET password = $1 WHERE email = $2', [hash, 'direction@sainte-marie.sn']);
    console.log('✅ direction@sainte-marie.sn mis à jour.');

    console.log('🎉 Terminé ! Tous ces comptes ont désormais le mot de passe : password123');
  } catch (err) {
    console.error('❌ Erreur :', err);
  } finally {
    await client.end();
  }
}

main();
