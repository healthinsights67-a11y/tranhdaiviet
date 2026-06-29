const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let storageBucket = "gen-lang-client-0686745109.firebasestorage.app";
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
if (fs.existsSync(configPath)) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (config.storageBucket) {
    storageBucket = config.storageBucket;
  }
}

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
if (serviceAccount && serviceAccount !== "undefined" && serviceAccount.trim() !== "") {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(serviceAccount)),
    storageBucket
  });
} else {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    storageBucket
  });
}

const db = admin.firestore();

async function run() {
  console.log("=== TRASH ===");
  const trashSnap = await db.collection('trash').get();
  trashSnap.forEach(doc => {
    if (doc.data().title.includes("KH023") || doc.data().collection === 'customers') {
      console.log(doc.id, "=>", JSON.stringify(doc.data(), null, 2));
    }
  });
}

run().catch(console.error);
