const http = require('http');

// Le resync-photos nécessite un token school_admin, pas super_admin
// On va directement corriger les URLs en base via une requête SQL via le script Node.js
// En attendant, vérifions d'abord si les photos BioTime sont accessibles sans auth

const BIOTIME_HOST = '160.120.143.20';
const BIOTIME_PORT = 8080;

// Test: la photo est-elle accessible sans token JWT ?
const photoReq = http.request(
  { hostname: BIOTIME_HOST, port: BIOTIME_PORT, path: '/auth_files/photo/1.jpg', method: 'GET' },
  (res) => {
    console.log(`GET /auth_files/photo/1.jpg → Status: ${res.statusCode}`);
    console.log('Content-Type:', res.headers['content-type']);
    if (res.statusCode === 200) {
      console.log('✅ La photo est accessible PUBLIQUEMENT - problème côté frontend (CORS ou URL stockée incorrecte)');
    } else if (res.statusCode === 401 || res.statusCode === 403) {
      console.log('❌ La photo NÉCESSITE un token JWT - il faut un proxy backend');
    } else {
      console.log('⚠️  Autre réponse:', res.statusCode);
    }
  }
);
photoReq.on('error', e => console.error('Erreur réseau:', e.message));
photoReq.end();
