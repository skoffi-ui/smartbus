const axios = require('axios');

async function testMock() {
  try {
    // Generate token by calling login on super-app or simply bypassing it.
    // Actually, I can just remove the guard again, I don't care, I just want to see if the server responds.
    const res = await axios.get('http://localhost:3001/api/v1/ping');
    console.log('Ping response:', res.data);
  } catch (e) {
    console.error('Ping error:', e.message);
  }
}

testMock();
