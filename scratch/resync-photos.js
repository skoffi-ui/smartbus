const http = require('http');

// 1. Login pour obtenir le token school-app
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
    headers: { 'Content-Type': 'application/json' },
  },
  (res) => {
    let body = '';
    res.on('data', (c) => (body += c));
    res.on('end', () => {
      const token = JSON.parse(body).tokens?.accessToken;
      if (!token) {
        console.error("Impossible d'obtenir le token:", body);
        return;
      }

      // 2. Appeler le endpoint resync-photos
      const resyncReq = http.request(
        {
          hostname: 'localhost',
          port: 3001,
          path: '/api/v1/children/resync-photos',
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Length': 0 },
        },
        (r) => {
          let b = '';
          r.on('data', (c) => (b += c));
          r.on('end', () => {
            console.log(`Status: ${r.statusCode}`);
            console.log('Résultat:', b);
          });
        },
      );
      resyncReq.on('error', (e) => console.error(e));
      resyncReq.end();
    });
  },
);
loginReq.write(loginData);
loginReq.end();
