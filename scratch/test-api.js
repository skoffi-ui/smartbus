const axios = require('axios');

async function test() {
  try {
    // 1. Login to get token
    const loginRes = await axios.post(
      'http://localhost:3000/api/v1/auth/login',
      {
        email: 'direction@ecole.com',
        password: 'password123',
      },
    );
    const token = loginRes.data.tokens.accessToken;
    console.log('Got token!');

    // 2. Fetch children
    const childrenRes = await axios.get(
      'http://localhost:3001/api/v1/children',
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const children = childrenRes.data;
    console.log('Children:', children.length);

    if (children.length > 0) {
      const childId = children[0].id;
      // 3. Fetch child profile
      const profileRes = await axios.get(
        `http://localhost:3001/api/v1/children/${childId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      console.log('Profile:', Object.keys(profileRes.data));

      // 4. Fetch punches
      const punchesRes = await axios.get(
        `http://localhost:3001/api/v1/children/${childId}/punches`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      console.log('Punches:', punchesRes.data.length);
    }
  } catch (err) {
    console.error('Error:', err.response ? err.response.data : err.message);
  }
}

test();
