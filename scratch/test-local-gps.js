const axios = require('axios');

async function testLocalGps() {
  try {
    const res = await axios.get('http://localhost:3001/api/v1/gps/live');
    console.log('Response:', JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.error('Error calling local API:', e.message);
  }
}

testLocalGps();
