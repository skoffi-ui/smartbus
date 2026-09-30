const axios = require('axios');

async function fetchGps() {
  const url =
    'https://libellule.sudcontractors.com/api/get_history?device_id=125&from_date=2026-07-07&to_date=2026-07-07&from_time=00:00:00&to_time=23:00:00&user_api_hash=$2y$10$O3UKDU8Lnn/NJeSg3.sDH.D1RPrdjZ7qFi4hLwMf/xgrHB0kkdGNi';

  try {
    const res = await axios.get(url);
    const data = res.data;

    if (Array.isArray(data)) {
      console.log(`Received ${data.length} records.`);
      console.log('First record:', JSON.stringify(data[0], null, 2));
      console.log('Second record:', JSON.stringify(data[1], null, 2));
    } else if (data && data.items) {
      console.log(`Received ${data.items.length} records.`);
      console.log('First record:', JSON.stringify(data.items[0], null, 2));
    } else {
      console.log('Response structure:', Object.keys(data));
      console.log('Sample:', JSON.stringify(data).substring(0, 500));
    }
  } catch (err) {
    console.error('Error fetching GPS data:', err.message);
  }
}

fetchGps();
