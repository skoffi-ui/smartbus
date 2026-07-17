const http = require('http');

const authData = JSON.stringify({
  username: 'KOMARA',
  password: 'KOMARA2222'
});

const authOptions = {
  hostname: '160.120.143.20',
  port: 8080,
  path: '/jwt-api-token-auth/',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': authData.length
  }
};

const req = http.request(authOptions, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    if (res.statusCode !== 200) {
      console.error('Erreur auth:', body);
      return;
    }
    const token = JSON.parse(body).token;

    // Récupérer les pointages (transactions) pour voir les dates
    const getOptions = {
      hostname: '160.120.143.20',
      port: 8080,
      path: '/iclock/api/transactions/?page_size=500', 
      method: 'GET',
      headers: {
        'Authorization': `JWT ${token}`
      }
    };

    const getReq = http.request(getOptions, (getRes) => {
      let getBody = '';
      getRes.on('data', (chunk) => getBody += chunk);
      getRes.on('end', () => {
        const data = JSON.parse(getBody);
        if(data.data && data.data.length > 0) {
            console.log(`Total transactions trouvées : ${data.count}`);
            // Grouper par date et par employé
            const punchesByDate = {};
            data.data.forEach(txn => {
                const date = txn.punch_time.split(' ')[0];
                const time = txn.punch_time.split(' ')[1];
                const emp = txn.emp_code;
                
                if(!punchesByDate[date]) punchesByDate[date] = {};
                if(!punchesByDate[date][emp]) punchesByDate[date][emp] = [];
                punchesByDate[date][emp].push(time);
            });
            console.log(JSON.stringify(punchesByDate, null, 2));
        } else {
            console.log('Aucune transaction trouvée.');
        }
      });
    });
    getReq.on('error', (e) => console.error(e));
    getReq.end();
  });
});
req.write(authData);
req.end();
