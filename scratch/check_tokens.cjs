const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf-8');
const line = envContent.split('\n').find(l => l.startsWith('FIREBASE_SERVICE_ACCOUNT='));
const jsonStr = line.substring('FIREBASE_SERVICE_ACCOUNT='.length).trim();
const cleanJsonStr = jsonStr.replace(/^['"]|['"]$/g, '');

const serviceAccount = JSON.parse(cleanJsonStr);
const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Pass custom database ID
const db = getFirestore(app, 'ai-studio-5844f605-5e90-4316-99c4-a7078ad935b7');

async function check() {
  const membersSnap = await db.collection('members').get();
  console.log('--- Members ---');
  membersSnap.forEach(doc => {
    const data = doc.data();
    console.log(`Email: ${data.email}, Name: ${data.name}, Role: ${data.role}, Tokens Count: ${data.fcmTokens ? data.fcmTokens.length : 0}`);
    if (data.fcmTokens && data.fcmTokens.length > 0) {
      console.log(`Tokens: ${JSON.stringify(data.fcmTokens)}`);
    }
  });

  const usersSnap = await db.collection('users').get();
  console.log('--- Users ---');
  usersSnap.forEach(doc => {
    const data = doc.data();
    console.log(`Email: ${data.email}, Role: ${data.role}, Tokens Count: ${data.fcmTokens ? data.fcmTokens.length : 0}`);
    if (data.fcmTokens && data.fcmTokens.length > 0) {
      console.log(`Tokens: ${JSON.stringify(data.fcmTokens)}`);
    }
  });
}

check().catch(console.error);
