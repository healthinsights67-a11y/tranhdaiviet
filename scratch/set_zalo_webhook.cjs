const fs = require('fs');
const path = require('path');

// Allow passing the token directly via CLI arguments
const cliToken = process.argv[2];

async function run() {
  let botToken = cliToken;

  if (!botToken) {
    console.log("Không nhận được Token qua tham số dòng lệnh. Đang thử đọc từ Firestore...");
    try {
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
      const configSnap = await db.doc('configs/notifications').get();
      if (configSnap.exists()) {
        botToken = configSnap.data().zalo?.botToken;
      }
    } catch (e) {
      console.warn("Không thể đọc cấu hình từ Firestore: " + e.message);
    }
  }

  if (!botToken) {
    console.error("\nLỗi: Thiếu Zalo Bot Token. Vui lòng chạy lệnh theo cú pháp:");
    console.error("node scratch/set_zalo_webhook.cjs <YOUR_BOT_TOKEN>\n");
    process.exit(1);
  }

  const cleanToken = botToken.trim();
  const webhookUrl = "https://i-noi-that.onrender.com/webhooks/zalo";
  const secretToken = process.env.ZALO_WEBHOOK_SECRET || "your-secret-token";

  console.log(`Đang đăng ký Webhook với Zalo Bot API...`);
  console.log(`Token Bot: ${cleanToken.substring(0, 10)}...`);
  console.log(`Webhook URL: ${webhookUrl}`);

  try {
    const response = await fetch(`https://bot-api.zaloplatforms.com/bot${cleanToken}/setWebhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: secretToken
      })
    });

    const data = await response.json();
    console.log("\n=== Kết quả phản hồi từ Zalo API ===");
    console.log(JSON.stringify(data, null, 2));
    
    if (data.ok || data.error === 0 || data.message === "Success") {
      console.log("\nChúc mừng! Đã kích hoạt Webhook Zalo Bot thành công.");
    } else {
      console.error("\nLỗi kích hoạt webhook từ Zalo.");
    }
  } catch (err) {
    console.error("Không thể kết nối đến Zalo API:", err.message);
  }
}

run().catch(console.error);
