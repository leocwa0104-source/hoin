const axios = require('axios');

async function testLogin() {
  try {
    console.log('Testing login API...');
    const res = await axios.post('https://hoin-ten.vercel.app/api/users', { 
      name: 'TestUser' 
    });
    console.log('Success:', res.data);
  } catch (err) {
    console.error('Error:', err.response ? err.response.data : err.message);
    if (err.response && err.response.status === 500) {
        console.log('Got 500 error as expected. Now we need server logs.');
    }
  }
}

testLogin();
