const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

require('fs');

function parseEnv() {
  try {
    const envContent = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      if (line.startsWith('FIREBASE_SERVICE_ACCOUNT=')) {
        let val = line.substring('FIREBASE_SERVICE_ACCOUNT='.length).trim();
        if (val.startsWith("'") && val.endsWith("'")) val = val.substring(1, val.length - 1);
        if (val.startsWith('"') && val.endsWith('"')) val = val.substring(1, val.length - 1);
        process.env.FIREBASE_SERVICE_ACCOUNT = val;
      }
    }
  } catch (e) {
    console.error(e);
  }
}
parseEnv();
let storageBucket = "gen-lang-client-0686745109.firebasestorage.app";
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
if (fs.existsSync(configPath)) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (config.storageBucket) {
    storageBucket = config.storageBucket;
  }
}

const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
if (serviceAccountStr) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(serviceAccountStr)),
    storageBucket
  });
} else {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    storageBucket
  });
}

const db = admin.firestore();

async function fixQuotations() {
  console.log("Fetching customers and quotations...");
  const customersSnap = await db.collection('customers').get();
  const quotationsSnap = await db.collection('quotations').get();

  const customers = {};
  customersSnap.forEach(doc => {
    customers[doc.id] = doc.data();
  });

  let updateCount = 0;

  for (const qDoc of quotationsSnap.docs) {
    const qData = qDoc.data();
    if (!qData.customerId) continue;

    const customer = customers[qData.customerId];
    if (!customer) continue;

    let expectedStatus = qData.status;

    if (customer.stage === 'contracted' && qData.status !== 'deposit' && qData.status !== 'accepted') {
      expectedStatus = 'deposit';
    } else if (customer.stage === 'completed' && qData.status !== 'accepted') {
      expectedStatus = 'accepted';
    } else if (customer.stage === 'lost' && qData.status !== 'rejected') {
      expectedStatus = 'rejected';
    }

    if (expectedStatus !== qData.status) {
      console.log(`Updating Quotation ${qDoc.id} (Customer: ${customer.name}) from ${qData.status} to ${expectedStatus}`);
      await db.collection('quotations').doc(qDoc.id).update({ status: expectedStatus });
      updateCount++;
    }
  }

  console.log(`Fixed ${updateCount} quotations.`);
}

fixQuotations().catch(console.error);
