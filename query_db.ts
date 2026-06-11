import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

let storageBucket = "gen-lang-client-0686745109.firebasestorage.app";
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
if (fs.existsSync(configPath)) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (config.storageBucket) {
    storageBucket = config.storageBucket;
  }
}

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
if (serviceAccount) {
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
  console.log("=== MEMBERS IN FIRESTORE ===");
  const membersSnap = await db.collection('members').get();
  membersSnap.forEach(doc => {
    console.log(doc.id, "=>", doc.data());
  });

  console.log("\n=== USERS IN FIRESTORE ===");
  const usersSnap = await db.collection('users').get();
  usersSnap.forEach(doc => {
    console.log(doc.id, "=>", doc.data());
  });
}

run().catch(console.error);
