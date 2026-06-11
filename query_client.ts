import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  console.log("=== FIRESTORE CLIENT QUERY ===");
  try {
    const snapshot = await getDocs(collection(db, 'product_library'));
    console.log("Total products in product_library:", snapshot.size);
    snapshot.forEach(doc => {
      console.log(doc.id, "=>", doc.data());
    });
  } catch (error) {
    console.error("Error fetching product_library:", error);
  }
}

run().catch(console.error);
