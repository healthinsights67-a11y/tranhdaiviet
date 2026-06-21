const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

// Load environment variables from .env manually
const workspaceRoot = 'c:/Users/NCPC/Downloads/i-nội-thất-v2';
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

// Initialize Admin SDK to verify the database afterwards
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
let storageBucket = "gen-lang-client-0686745109.firebasestorage.app";
let dbId = undefined;
const configPath = path.join(workspaceRoot, 'firebase-applet-config.json');
if (fs.existsSync(configPath)) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (config.storageBucket) storageBucket = config.storageBucket;
  dbId = config.firestoreDatabaseId;
}

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
const db = getFirestore(dbId);

async function test() {
  console.log("Starting Zalo webhook verification...");
  
  // Payloads
  const payloadDirect = {
    event_name: "user_send_location",
    sender: { id: "test_zalo_user_direct" },
    message: {
      lat: 10.776,
      long: 106.701,
      msg_id: "msg_direct_123"
    },
    timestamp: "154390853474"
  };

  const payloadAttachments = {
    event_name: "user_send_location",
    sender: { id: "test_zalo_user_attachments" },
    message: {
      msg_id: "msg_attachments_123",
      attachments: [
        {
          type: "location",
          payload: {
            coordinates: {
              lat: 21.028,
              long: 105.834
            },
            address: "Hanoi, Vietnam",
            name: "Hoan Kiem Lake"
          }
        }
      ]
    },
    timestamp: "154390853475"
  };

  // Send requests to local server (use 127.0.0.1 to avoid Windows localhost ipv6 delay)
  const url = "http://127.0.0.1:3000/webhooks/zalo";
  
  console.log("Sending payload 1 (direct format)...");
  try {
    const res1 = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadDirect)
    });
    console.log("Payload 1 response:", await res1.json());
  } catch (err) {
    console.error("Failed to send Payload 1:", err.message);
  }

  console.log("Sending payload 2 (attachments format)...");
  try {
    const res2 = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadAttachments)
    });
    console.log("Payload 2 response:", await res2.json());
  } catch (err) {
    console.error("Failed to send Payload 2:", err.message);
  }

  // Wait a short moment for DB writes to complete
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Query database to see if the entries exist
  console.log("\n=== Checking sales_routes in Firestore ===");
  const routesSnap = await db.collection('sales_routes')
    .where('zaloUserId', 'in', ['test_zalo_user_direct', 'test_zalo_user_attachments'])
    .get();
  
  console.log(`Found ${routesSnap.size} matching routes:`);
  routesSnap.forEach(doc => {
    console.log(doc.id, "=>", doc.data());
  });

  // Clean up test entries
  console.log("\nCleaning up test entries...");
  const batch = db.batch();
  routesSnap.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  console.log("Cleanup completed.");
}

test().catch(console.error);
