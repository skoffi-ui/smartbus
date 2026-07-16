const axios = require('axios');

async function testApi() {
  const hash = '$2y$10$O3UKDU8Lnn/NJeSg3.sDH.D1RPrdjZ7qFi4hLwMf/xgrHB0kkdGNi';
  const baseUrl = 'https://libellule.sudcontractors.com/api';
  
  const endpointsToTest = [
    '/get_devices',
    '/devices',
    '/api/devices',
    '/get_objects'
  ];

  for (const endpoint of endpointsToTest) {
    try {
      console.log(`Testing ${endpoint}...`);
      const url = `${baseUrl}${endpoint}?user_api_hash=${hash}`;
      const res = await axios.get(url);
      console.log(`Success on ${endpoint}! Keys:`, Object.keys(res.data));
      if (Array.isArray(res.data)) {
         console.log(`Array of ${res.data.length} items`);
         if (res.data.length > 0) console.log(JSON.stringify(res.data[0]).substring(0, 200));
      } else if (res.data && res.data[0]) {
         // Some APIs return object with numeric keys
         console.log(`First item:`, JSON.stringify(res.data[0]).substring(0, 200));
      } else {
         console.log("Data sample:", JSON.stringify(res.data).substring(0, 200));
      }
      return; // Stop if we found a working one
    } catch (e) {
      console.log(`Failed ${endpoint}: ${e.response ? e.response.status : e.message}`);
    }
  }
}

testApi();
