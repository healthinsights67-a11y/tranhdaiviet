const https = require('https');

function testCron() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'i-noi-that.vercel.app',
      port: 443,
      path: '/api/cron/daily-report',
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ status: res.statusCode, data: data });
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.end();
  });
}

async function run() {
  try {
    console.log("Calling live Vercel daily-report cron endpoint...");
    const res = await testCron();
    console.log("Response status:", res.status);
    console.log("Response data:", res.data);
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
