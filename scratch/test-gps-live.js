const axios = require('axios');

async function testGpsLive() {
  const hash = '$2y$10$O3UKDU8Lnn/NJeSg3.sDH.D1RPrdjZ7qFi4hLwMf/xgrHB0kkdGNi';
  const today = new Date().toISOString().split('T')[0];
  const url = `https://libellule.sudcontractors.com/api/get_history?device_id=3076&from_date=${today}&to_date=${today}&from_time=00:00:00&to_time=23:59:59&user_api_hash=${hash}`;
  
  console.log("Fetching URL:", url);
  try {
    const res = await axios.get(url);
    const data = res.data;
    
    let latestPosition = null;
    if (Array.isArray(data) && data.length > 0) {
      console.log("Data is array. Length:", data.length);
      const items = data[0].items || [];
      if (items.length > 0) {
        latestPosition = items[items.length - 1];
      }
    } else if (data && data.items && data.items.length > 0) {
      console.log("Data is object with items. Length:", data.items.length);
      latestPosition = data.items[data.items.length - 1];
    } else {
      console.log("No valid items found. Data structure:", JSON.stringify(data).substring(0, 200));
    }

    if (latestPosition) {
      console.log("Latest position:", latestPosition.lat || latestPosition.latitude, latestPosition.lng || latestPosition.longitude);
    } else {
      console.log("NO LATEST POSITION EXTRACTED");
    }

  } catch(e) {
    console.error("Error:", e.message);
  }
}

testGpsLive();
