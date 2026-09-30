const axios = require('axios');

async function checkDevices() {
  const hash = '$2y$10$O3UKDU8Lnn/NJeSg3.sDH.D1RPrdjZ7qFi4hLwMf/xgrHB0kkdGNi';
  const url = `https://libellule.sudcontractors.com/api/devices?user_api_hash=${hash}`;

  try {
    const res = await axios.get(url);
    const devices = res.data.data;
    if (devices && devices.length > 0) {
      console.log('Premier appareil complet :');
      console.log(JSON.stringify(devices[0], null, 2));

      const onlineDevice = devices.find((d) => d.lat && d.lng);
      if (onlineDevice) {
        console.log('Appareil en ligne avec coords :');
        console.log(JSON.stringify(onlineDevice, null, 2));
      } else {
        console.log("Aucun appareil n'a de lat/lng directement.");
      }
    }
  } catch (e) {
    console.error(e.message);
  }
}

checkDevices();
