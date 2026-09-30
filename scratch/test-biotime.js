const http = require('http');

const authData = JSON.stringify({
  username: 'KOMARA',
  password: 'KOMARA2222',
});

const authOptions = {
  hostname: '160.120.143.20',
  port: 8080,
  path: '/jwt-api-token-auth/',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': authData.length,
  },
};

const req = http.request(authOptions, (res) => {
  let body = '';
  res.on('data', (chunk) => (body += chunk));
  res.on('end', () => {
    if (res.statusCode !== 200) {
      console.error('Erreur authentification:', body);
      return;
    }
    const token = JSON.parse(body).token;
    console.log('Token BioTime obtenu avec succès.');

    // Récupérer les employés
    const getOptions = {
      hostname: '160.120.143.20',
      port: 8080,
      path: '/personnel/api/employees/?page_size=5', // juste les 5 premiers pour voir
      method: 'GET',
      headers: {
        Authorization: `JWT ${token}`,
      },
    };

    const getReq = http.request(getOptions, (getRes) => {
      let getBody = '';
      getRes.on('data', (chunk) => (getBody += chunk));
      getRes.on('end', () => {
        console.log('--- DONNÉES ENFANTS (ÉCHANTILLON) ---');
        console.log(getBody);
      });
    });
    getReq.on('error', (e) => console.error(e));
    getReq.end();
  });
});

req.on('error', (e) => console.error(e));
req.write(authData);
req.end();
