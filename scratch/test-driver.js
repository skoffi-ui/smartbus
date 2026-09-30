const http = require('http');

// 1. Login pour obtenir un token de la school-app (port 3001)
// (on doit d'abord avoir un compte school_admin pour accéder aux routes protégées)
// On teste directement la création d'un chauffeur pour voir le message d'erreur

const driverData = JSON.stringify({
  firstName: 'Test',
  lastName: 'Chauffeur',
  licenseNumber: 'TEST-001',
  licenseExpiry: '2030-01-01',
  phone: '+2250101020304',
});

// D'abord récupérer un token depuis la super-app
const loginData = JSON.stringify({
  email: 'john.doe@smartbus.com',
  password: 'password123',
});
const loginReq = http.request(
  {
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': loginData.length,
    },
  },
  (res) => {
    let body = '';
    res.on('data', (c) => (body += c));
    res.on('end', () => {
      const result = JSON.parse(body);
      const token = result.tokens?.accessToken;
      if (!token) {
        console.error('Erreur login:', body);
        return;
      }

      // Test direct avec super-app (port 3000) - les routes drivers sont-elles là ?
      const req2 = http.request(
        {
          hostname: 'localhost',
          port: 3001,
          path: '/api/v1/drivers',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'Content-Length': driverData.length,
          },
        },
        (r) => {
          let b = '';
          r.on('data', (c) => (b += c));
          r.on('end', () => {
            console.log(`POST /api/v1/drivers → Status: ${r.statusCode}`);
            console.log('Réponse:', b);
          });
        },
      );
      req2.on('error', (e) => console.error('Erreur:', e));
      req2.write(driverData);
      req2.end();
    });
  },
);
loginReq.write(loginData);
loginReq.end();
