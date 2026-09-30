const axios = require('axios');

async function testGpsLive() {
  const hash = '$2y$10$O3UKDU8Lnn/NJeSg3.sDH.D1RPrdjZ7qFi4hLwMf/xgrHB0kkdGNi';
  const today = new Date().toISOString().split('T')[0];
  const url = `https://libellule.sudcontractors.com/api/get_history?device_id=3076&from_date=${today}&to_date=${today}&from_time=00:00:00&to_time=23:59:59&user_api_hash=${hash}`;

  try {
    const res = await axios.get(url);
    const data = res.data;

    console.log('Is array?', Array.isArray(data.items));
    if (data.items) {
      console.log('Keys of items:', Object.keys(data.items).slice(-3));
      const keys = Object.keys(data.items);
      const lastKey = keys[keys.length - 1];
      console.log('Last item:', data.items[lastKey]);
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

testGpsLive();
