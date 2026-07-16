const axios = require('axios');

async function findActiveDevice() {
  const hash = '$2y$10$O3UKDU8Lnn/NJeSg3.sDH.D1RPrdjZ7qFi4hLwMf/xgrHB0kkdGNi';
  const url = `https://libellule.sudcontractors.com/api/devices?user_api_hash=${hash}`;
  
  try {
    const res = await axios.get(url);
    const devices = res.data.data || [];
    
    const today = new Date().toISOString().split('T')[0];
    console.log(`Checking history for ${today} on ${devices.length} devices...`);
    
    // Test the first 50 devices to not spam the API too much
    for (let i = 0; i < Math.min(50, devices.length); i++) {
       const d = devices[i];
       const historyUrl = `https://libellule.sudcontractors.com/api/get_history?device_id=${d.id}&from_date=${today}&to_date=${today}&from_time=00:00:00&to_time=23:59:59&user_api_hash=${hash}`;
       try {
         const hRes = await axios.get(historyUrl);
         const data = hRes.data;
         let items = [];
         if (Array.isArray(data) && data.length > 0) items = data[0].items || [];
         else if (data && data.items) items = data.items;
         
         if (items && items.length > 0) {
            console.log(`BINGO! Device ${d.id} (${d.name}) has ${items.length} positions today!`);
            console.log("Latest position:", JSON.stringify(items[items.length - 1], null, 2));
            return;
         }
       } catch (e) {
         // ignore
       }
    }
    console.log("No device has history for today.");
  } catch (e) {
    console.error(e.message);
  }
}

findActiveDevice();
