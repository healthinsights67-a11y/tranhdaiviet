const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function check() {
  try {
    const docRef = doc(db, 'configs', 'notifications');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      console.log('--- NOTIFICATIONS CONFIG ---');
      console.log(JSON.stringify(docSnap.data(), null, 2));
    } else {
      console.log('notifications config doc not found!');
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

check();
