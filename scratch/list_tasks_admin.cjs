const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');

// Find FIREBASE_SERVICE_ACCOUNT='...'
const startIdx = envContent.indexOf("FIREBASE_SERVICE_ACCOUNT='");
if (startIdx === -1) {
  console.error("Could not find start of FIREBASE_SERVICE_ACCOUNT in .env");
  process.exit(1);
}

const valueStart = startIdx + "FIREBASE_SERVICE_ACCOUNT='".length;
const endIdx = envContent.indexOf("'", valueStart);
if (endIdx === -1) {
  console.error("Could not find end of FIREBASE_SERVICE_ACCOUNT in .env");
  process.exit(1);
}

const serviceAccountStr = envContent.substring(valueStart, endIdx);
const serviceAccount = JSON.parse(serviceAccountStr);

const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Use getFirestore(app, databaseId)
const db = getFirestore(app, "ai-studio-5844f605-5e90-4316-99c4-a7078ad935b7");

async function main() {
  console.log("=== TASKS ===");
  const tasksSnap = await db.collection('tasks').get();
  console.log(`Total tasks in DB: ${tasksSnap.size}`);
  tasksSnap.forEach(doc => {
    const data = doc.data();
    console.log(`- ID: ${doc.id} | Title: "${data.title}" | Type: ${data.type} | Status: ${data.status} | Workshop: ${data.workshop} | Assignee: ${data.assigneeId} | CustomerId: ${data.customerId} | CreatedAt: ${data.createdAt}`);
  });

  console.log("\n=== CUSTOMERS ===");
  const customersSnap = await db.collection('customers').get();
  console.log(`Total customers in DB: ${customersSnap.size}`);
  customersSnap.forEach(doc => {
    const data = doc.data();
    console.log(`- ID: ${doc.id} | Code: "${data.code}" | Name: "${data.name}" | Stage: ${data.stage} | Workshop: ${data.workshop} | AssignedSale: ${data.assignedSaleId} | OrderValue: ${data.orderValue} | CreatedAt: ${data.createdAt}`);
  });

  console.log("\n=== MEMBERS ===");
  const membersSnap = await db.collection('members').get();
  membersSnap.forEach(doc => {
    const data = doc.data();
    console.log(`- ID: ${doc.id} | Name: "${data.name}" | Role: "${data.role}" | Email: "${data.email}" | Workshop: "${data.workshop}"`);
  });
}

main().catch(console.error);
