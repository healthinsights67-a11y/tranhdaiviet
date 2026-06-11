const { Storage } = require('@google-cloud/storage');
const path = require('path');
const fs = require('fs');

// Load env file manually
const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT='([^']+)'/);
if (!match) {
  console.error("Could not find FIREBASE_SERVICE_ACCOUNT in .env");
  process.exit(1);
}
const serviceAccount = JSON.parse(match[1]);

const storage = new Storage({
  projectId: serviceAccount.project_id,
  credentials: serviceAccount
});

async function run() {
  try {
    console.log("Listing all buckets in project...");
    const [buckets] = await storage.getBuckets();
    console.log("Found buckets:", buckets.map(b => b.name));
  } catch (err) {
    console.error("Failed to list buckets:", err.message);
  }
}

run();
