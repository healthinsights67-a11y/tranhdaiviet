const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, doc, deleteDoc } = require('firebase/firestore');

const workspaceRoot = path.join(__dirname, '..');
const configPath = path.join(workspaceRoot, 'firebase-applet-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const dbId = config.firestoreDatabaseId;

const firebaseApp = initializeApp(config);
const db = getFirestore(firebaseApp, dbId);

async function run() {
  console.log("Writing to sales_routes using Client SDK (unauthenticated)...");
  try {
    const docRef = await addDoc(collection(db, 'sales_routes'), {
      memberId: 'test_zalo_client_temp',
      memberName: 'Zalo Client Temp',
      zaloUserId: 'test_zalo_client_temp',
      latitude: 21.028,
      longitude: 105.834,
      timestamp: new Date().toISOString(),
      note: 'Test client write'
    });
    console.log("Written doc ID:", docRef.id);
    console.log("Success!");

    // Clean up
    await deleteDoc(doc(db, 'sales_routes', docRef.id));
    console.log("Cleanup success!");
  } catch (err) {
    console.error("Client SDK write failed:", err);
  }
}

run();
