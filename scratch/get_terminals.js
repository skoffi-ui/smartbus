const axios = require('axios');

async function getTerminals() {
  try {
    const authRes = await axios.post('http://160.120.143.20/jwt-api-token-auth/', {
      username: 'KOMARA',
      password: 'KOMARA2222'
    });
    const token = authRes.data.token;
    
    // Try standard endpoint for terminals
    try {
        const termRes = await axios.get('http://160.120.143.20/iclock/api/terminals/', {
          headers: { Authorization: `JWT ${token}` }
        });
        console.log("SUCCESS (/iclock/api/terminals/):");
        console.log(JSON.stringify(termRes.data.data ? termRes.data.data.map(t => ({sn: t.sn, alias: t.alias, ip_address: t.ip_address})) : termRes.data, null, 2));
        return;
    } catch(e) {
        console.log("Endpoint /iclock/api/terminals/ failed. Trying /iclock/api/devices/...");
    }

    try {
        const devRes = await axios.get('http://160.120.143.20/iclock/api/devices/', {
          headers: { Authorization: `JWT ${token}` }
        });
        console.log("SUCCESS (/iclock/api/devices/):");
        // Try to map only useful fields if it's an array or has data property
        let data = devRes.data.data || devRes.data;
        if (Array.isArray(data)) {
            console.log(JSON.stringify(data.map(d => ({sn: d.sn, alias: d.alias, ip: d.ip_address})), null, 2));
        } else {
             console.log(JSON.stringify(data, null, 2));
        }
    } catch(e) {
        console.log("Both endpoints failed.");
        console.error("Error:", e.message);
        if(e.response) console.error(e.response.data);
    }
  } catch(e) {
    console.error("Auth Error:", e.message);
  }
}
getTerminals();
