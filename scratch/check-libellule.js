const axios = require('axios');
async function test() {
  const url = `https://libellule.sudcontractors.com/api/get_devices?user_api_hash=$2y$10$O3UKDU8Lnn/NJeSg3.sDH.D1RPrdjZ7qFi4hLwMf/xgrHB0kkdGNi`;
  try {
    const res = await axios.get(url);
    console.log("Found devices:", res.data ? res.data.length || Object.keys(res.data).length : 0);
    // Find one with speed > 0
    let moving = [];
    if (Array.isArray(res.data)) {
      moving = res.data.filter(d => d.speed > 0);
    } else if (res.data && res.data.items) {
      const items = Array.isArray(res.data.items) ? res.data.items : Object.values(res.data.items);
      moving = items.filter(d => d.speed > 0);
    }
    console.log("Moving devices:", moving.map(d => ({id: d.id, name: d.name, speed: d.speed})));
  } catch(e) {
    console.log("Error:", e.message);
  }
}
test();
