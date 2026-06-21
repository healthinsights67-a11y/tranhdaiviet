const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

const workspaceRoot = path.join(__dirname, '..');
const envPath = path.join(workspaceRoot, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value;
    }
  });
}

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
const configPath = path.join(workspaceRoot, 'firebase-applet-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const dbId = config.firestoreDatabaseId;

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(serviceAccount)),
  storageBucket: config.storageBucket
});

const db = getFirestore(dbId);

async function run() {
  console.log("Writing to sales_routes...");
  const docRef = await db.collection('sales_routes').add({
    memberId: 'test_zalo_user_temp',
    memberName: 'Zalo User Temp',
    zaloUserId: 'test_zalo_user_temp',
    latitude: 10.776,
    longitude: 106.701,
    timestamp: new Date().toISOString(),
    note: 'Test write'
  });
  console.log("Written doc ID:", docRef.id);
  console.log("Success!");
  
  // Clean up
  await docRef.delete();
  console.log("Cleanup success!");
}

run().catch(console.error);
