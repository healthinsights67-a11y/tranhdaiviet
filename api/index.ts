import express from "express";
import path from "path";
import fs from "fs";
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { 
  getFirestore as getClientFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  setDoc,
  deleteDoc,
  query, 
  where, 
  onSnapshot 
} from 'firebase/firestore';
import cron from 'node-cron';


const timestampSchema = z.any().transform((val) => {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    if (typeof val.toDate === 'function') {
      try {
        return val.toDate().toISOString();
      } catch (e) {
        return new Date().toISOString();
      }
    }
    if ('seconds' in val && 'nanoseconds' in val) {
       return new Date(val.seconds * 1000).toISOString();
    }
  }
  return new Date().toISOString();
});

const SalesRouteSchema = z.object({
  id: z.string(),
  memberId: z.string(),
  memberName: z.string(),
  zaloUserId: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
  timestamp: timestampSchema,
  note: z.string().optional(),
  address: z.string().optional(),
});

let isFirebaseInitialized = false;

let clientDbInstance: any = null;
let clientAuthInstance: any = null;

async function getAuthenticatedClientDb() {
  if (clientDbInstance) return clientDbInstance;

  initializeFirebaseAdmin();
  
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error('firebase-applet-config.json not found');
  }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const dbId = config.firestoreDatabaseId;

  const customToken = await admin.auth().createCustomToken('server-system-bot');

  let firebaseApp;
  if (getApps().length === 0) {
    firebaseApp = initializeApp(config);
  } else {
    firebaseApp = getApp();
  }

  const auth = getAuth(firebaseApp);
  await signInWithCustomToken(auth, customToken);
  
  clientAuthInstance = auth;
  clientDbInstance = getClientFirestore(firebaseApp, dbId);
  return clientDbInstance;
}


function initializeFirebaseAdmin() {
  if (isFirebaseInitialized || admin.apps.length > 0) {
    isFirebaseInitialized = true;
    return;
  }

  let storageBucket = "tranh-dai-viet.firebasestorage.app";
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.storageBucket) {
        storageBucket = config.storageBucket;
      }
    }
  } catch (e) {
    console.warn("Could not read firebase-applet-config.json in server, using fallback bucket");
  }

  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccount && serviceAccount !== "undefined" && serviceAccount.trim() !== "") {
      try {
        admin.initializeApp({
          credential: admin.credential.cert(JSON.parse(serviceAccount)),
          storageBucket
        });
      } catch (jsonErr) {
        console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT env var, falling back to applicationDefault", jsonErr);
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          storageBucket
        });
      }
    } else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        storageBucket
      });
    }
    isFirebaseInitialized = true;
    console.log("Firebase Admin successfully initialized with bucket:", storageBucket);
  } catch (error) {
    console.error("Firebase Admin initialization failed:", error);
  }
}

let fcm: admin.messaging.Messaging | null = null;

function getFCM() {
  if (fcm) return fcm;
  
  try {
    initializeFirebaseAdmin();
    fcm = admin.messaging();
    return fcm;
  } catch (error) {
    console.warn("Firebase Admin messaging failed to get instance:", error);
    return null;
  }
}

export const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Serve uploads folder statically for fallback storage
app.use("/uploads", express.static(path.join(process.cwd(), 'uploads')));

  // API Routes
  app.post("/api/send-notification", async (req, res) => {
    const { tokens, title, body, data } = req.body;

    if (!tokens || !tokens.length) {
      return res.status(400).json({ error: "No tokens provided" });
    }

    const messaging = getFCM();
    if (!messaging) {
      return res.status(503).json({ error: "Push notification service is not configured" });
    }

    try {
      const response = await messaging.sendEachForMulticast({
        tokens,
        notification: {
          title,
          body,
        },
        data: data || {},
      });

      res.json({ success: true, results: response });
    } catch (error) {
      console.error("Error sending notification:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  // Store recent webhooks in memory for debugging
  const recentWebhooks: any[] = [];

  async function saveWebhookLog(logItem: any) {
    recentWebhooks.unshift(logItem);
    if (recentWebhooks.length > 30) recentWebhooks.pop();

    try {
      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(configPath)) {
        const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (cfg.apiKey && cfg.projectId) {
          const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents/webhook_logs?key=${cfg.apiKey}`;
          await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fields: {
                time: { stringValue: logItem.time || new Date().toISOString() },
                senderId: { stringValue: String(logItem.body?.sender?.id || logItem.body?.message?.from?.id || '') },
                chatId: { stringValue: String(logItem.body?.message?.chat?.id || logItem.body?.recipient?.id || logItem.body?.chat_id || logItem.body?.sender?.id || '') },
                text: { stringValue: String(logItem.body?.message?.text || logItem.body?.text || '') },
                eventName: { stringValue: String(logItem.body?.event_name || '') },
                raw: { stringValue: JSON.stringify(logItem.body || {}) }
              }
            })
          });
        }
      }
    } catch (err) {
      console.warn("Could not persist webhook to Firestore REST:", err);
    }
  }

  async function getPersistentWebhookLogs() {
    try {
      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(configPath)) {
        const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (cfg.apiKey && cfg.projectId) {
          const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents/webhook_logs?key=${cfg.apiKey}&pageSize=30`;
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            if (data.documents && data.documents.length > 0) {
              return data.documents.map((d: any) => {
                const f = d.fields || {};
                return {
                  time: f.time?.stringValue || d.createTime,
                  chatId: f.chatId?.stringValue || '',
                  senderId: f.senderId?.stringValue || '',
                  text: f.text?.stringValue || '',
                  eventName: f.eventName?.stringValue || '',
                  body: f.raw?.stringValue ? JSON.parse(f.raw.stringValue) : {}
                };
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn("Could not read webhook_logs via REST:", err);
    }
    return recentWebhooks;
  }

  function renderWebhookDashboard(logs: any[]) {
    const listHtml = logs.length === 0 ? `
      <div style="background:#fff;padding:24px;border-radius:12px;border:1px dashed #cbd5e1;text-align:center;color:#64748b;">
        <p style="font-size:16px;font-weight:600;margin:0 0 8px 0;color:#334155;">Chưa nhận được tin nhắn hoặc sự kiện nào từ Zalo!</p>
        <p style="font-size:14px;margin:0;">👉 Hãy vào nhóm Zalo <b>Tranh Đại Việt - Quản Lý</b>, tag bot: <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;color:#0284c7;">@Bot Tranh Đại Việt /id</code> hoặc nhắn một tin nhắn bất kỳ, sau đó bấm <b>Tải lại trang</b>.</p>
      </div>
    ` : logs.map((item, idx) => {
      const chatId = item.chatId || item.body?.message?.chat?.id || item.body?.sender?.id || item.body?.recipient?.id || '';
      const senderId = item.senderId || item.body?.sender?.id || item.body?.message?.from?.id || '';
      const text = item.text || item.body?.message?.text || item.body?.text || '';
      const eventName = item.eventName || item.body?.event_name || 'user_send_text';
      const timeStr = item.time ? new Date(item.time).toLocaleTimeString('vi-VN') + ' ' + new Date(item.time).toLocaleDateString('vi-VN') : 'Vừa xong';

      return `
        <div style="background:#fff;border-radius:14px;padding:20px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06);border:1px solid #e2e8f0;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
            <span style="background:#e0f2fe;color:#0369a1;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:700;">#${idx + 1} Sự kiện: ${eventName}</span>
            <span style="font-size:13px;color:#94a3b8;font-weight:500;">⏱️ ${timeStr}</span>
          </div>

          ${chatId ? `
            <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:12px 16px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
              <div>
                <span style="font-size:12px;font-weight:700;color:#166534;display:block;text-transform:uppercase;letter-spacing:0.5px;">MÃ CHAT ID / GROUP ID CẦN LẤY:</span>
                <code style="font-size:18px;font-weight:900;color:#15803d;font-family:monospace;letter-spacing:1px;">${chatId}</code>
              </div>
              <button onclick="navigator.clipboard.writeText('${chatId}');alert('Đã sao chép mã ID: ${chatId}');" style="background:#16a34a;color:#fff;border:none;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">📋 Sao chép ID</button>
            </div>
          ` : ''}

          <div style="font-size:13px;color:#475569;line-height:1.6;background:#f8fafc;padding:12px;border-radius:8px;">
            <div><b>👤 Người gửi (Sender ID):</b> <code style="color:#0284c7;">${senderId || 'N/A'}</code></div>
            <div><b>💬 Nội dung tin nhắn:</b> <span style="color:#0f172a;font-weight:600;">${text || '*(Không có chữ)*'}</span></div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Zalo Webhook & Chat ID Inspector - Tranh Đại Việt</title>
        <style>
          * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          body { background: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }
          .container { max-width: 800px; margin: 0 auto; }
          .header { background: #fff; border-radius: 16px; padding: 24px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
          .btn-reload { background: #2563eb; color: #fff; border: none; padding: 10px 20px; border-radius: 10px; font-weight: 700; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
          .btn-reload:hover { background: #1d4ed8; }
        </style>
        <script>
          // Tự động tải lại sau mỗi 6 giây để cập nhật tin nhắn mới
          setTimeout(() => { window.location.reload(); }, 6000);
        </script>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
              <div>
                <h1 style="margin:0 0 6px 0;font-size:22px;color:#0f172a;">Trình Bắt Mã ID Zalo Bot - Tranh Đại Việt</h1>
                <p style="margin:0;font-size:13px;color:#64748b;">Trang tự động làm mới sau mỗi 6 giây để hiển thị tin nhắn mới nhất.</p>
              </div>
              <button onclick="window.location.reload();" class="btn-reload">🔄 Tải lại ngay</button>
            </div>
          </div>
          <div>${listHtml}</div>
        </div>
      </body>
      </html>
    `;
  }
  
  // Robust middleware for Vercel Serverless Function rewrites
  app.use(async (req, res, next) => {
    const rawUrl = req.originalUrl || req.url || '';
    if (rawUrl.includes('webhook-logs') || rawUrl.includes('webhook_logs')) {
      const logs = await getPersistentWebhookLogs();
      const wantsJson = req.headers.accept?.includes('application/json') || req.query.json === 'true';
      if (wantsJson) {
        return res.json(logs);
      }
      return res.send(renderWebhookDashboard(logs));
    }
    if (rawUrl.includes('webhooks/zalo') || rawUrl.includes('/zalo')) {
      if (req.method === 'GET') {
        const logs = await getPersistentWebhookLogs();
        const wantsJson = req.headers.accept?.includes('application/json') || req.query.json === 'true';
        if (wantsJson) {
          return res.status(200).send("OK");
        }
        return res.send(renderWebhookDashboard(logs));
      }
    }
    next();
  });

  app.get(["/api/webhook-logs", "/api/webhook_logs", "/webhook-logs", "/webhook_logs"], async (req, res) => {
    const logs = await getPersistentWebhookLogs();
    const wantsJson = req.headers.accept?.includes('application/json') || req.query.json === 'true';
    if (wantsJson) {
      return res.json(logs);
    }
    res.send(renderWebhookDashboard(logs));
  });

  // Helper to send bot notification from Express server
  async function sendSystemNotificationFromServer(message: string) {
    let botToken = "1034247126900485411:nDxvsJtCZFncnHpElkOlHjulbpTSIbXiucsPfObaGSDKhJaVgUHTBobFvINoJXKk";
    let chatId = "zgr-8e80cc49912678782137";
    let isZaloActive = true;

    try {
      const clientDb = await getAuthenticatedClientDb();
      const docSnap = await getDoc(doc(clientDb, 'configs', 'notifications'));
      if (docSnap.exists()) {
        const config = docSnap.data();
        if (config?.zalo) {
          botToken = config.zalo.botToken || botToken;
          chatId = config.zalo.chatId || chatId;
          isZaloActive = config.zalo.isActive !== false;
        }
      }
    } catch (err) {
      console.warn("Could not fetch remote notifications config, using default Tranh Dai Viet bot credentials:", err);
    }

    if (isZaloActive && botToken && chatId) {
      const chatIds = chatId.split(',').map((id: string) => id.trim()).filter((id: string) => !!id);
      for (const id of chatIds) {
        try {
          await fetch(`https://bot-api.zaloplatforms.com/bot${botToken.trim()}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: id, text: message })
          });
          console.log(`Server sent Zalo notification to ${id} successfully`);
        } catch (err: any) {
          console.error(`Failed to send Zalo notification to ${id}:`, err.message);
        }
      }
    }
  }

  // Core logic to generate and send daily report
  async function runDailyReport() {
    console.log('Running daily report...');
    try {
      const clientDb = await getAuthenticatedClientDb();
      
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      const startOfDayStr = startOfDay.toISOString();
      const endOfDayStr = endOfDay.toISOString();

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      const startOfMonthStr = startOfMonth.toISOString();
      const endOfMonthStr = endOfMonth.toISOString();
      
      // 1. Khách hàng mới
      const custQuery = query(
        collection(clientDb, 'customers'),
        where('createdAt', '>=', startOfDayStr),
        where('createdAt', '<=', endOfDayStr)
      );
      const custSnap = await getDocs(custQuery);
      const newCustomers = custSnap.size;
      
      // 2. Nhiệm vụ
      const tasksQuery = query(collection(clientDb, 'tasks'));
      const tasksSnap = await getDocs(tasksQuery);
      
      let completedTasksCount = 0;
      let newTasksCount = 0;
      let completedInstalls = 0;
      let newDesigns = 0;
      let completedDesigns = 0;
      
      tasksSnap.forEach((doc: any) => {
        const task = doc.data();
        
        if (task.completedAt && task.completedAt >= startOfDayStr && task.completedAt <= endOfDayStr) {
          completedTasksCount++;
          if (task.type === 'production') completedInstalls++;
          if (task.type === 'design') completedDesigns++;
        }
        
        if (task.createdAt && task.createdAt >= startOfDayStr && task.createdAt <= endOfDayStr) {
          newTasksCount++;
          if (task.type === 'design') newDesigns++;
        }
      });

      // 3. Báo giá & Doanh thu
      const quoteQuery = query(collection(clientDb, 'quotations'));
      const quoteSnap = await getDocs(quoteQuery);
      let acceptedQuotes = 0;
      let newQuotes = 0;
      let acceptedRevenue = 0;
      let actualRevenue = 0;
      let expectedRevenue = 0;
      
      const allQuotes: any[] = [];
      quoteSnap.forEach((doc: any) => {
         const q = doc.data();
         allQuotes.push(q);
         if (q.createdAt && q.createdAt >= startOfDayStr && q.createdAt <= endOfDayStr) {
           newQuotes++;
         }
         if (q.status === 'accepted' || q.status === 'deposit') {
           if (q.updatedAt && q.updatedAt >= startOfDayStr && q.updatedAt <= endOfDayStr) {
              acceptedQuotes++;
              acceptedRevenue += q.totalAmount || 0;
           }
         }
      });

      // Doanh thu thực tế và dự kiến trong tháng (đồng bộ logic với web dashboard)
      const custUpdatedQuery = query(collection(clientDb, 'customers'));
      const custAllSnap = await getDocs(custUpdatedQuery);
      custAllSnap.forEach((doc: any) => {
        const c = doc.data();
         if (c.createdAt && c.createdAt >= startOfMonthStr && c.createdAt <= endOfMonthStr) {
           if (c.stage === 'completed') {
             actualRevenue += (c.orderValue || 0);
           } else if (['contracted', 'production', 'installation'].includes(c.stage)) {
             const q = allQuotes.find((quot: any) => quot.customerId === c.id || (quot.customerName === c.name && quot.phone === c.phone));
             const deposit = (q?.status === 'deposit' || q?.depositAmount) ? (q.depositAmount || 0) : 0;
             actualRevenue += deposit;
           }

           if (['contracted', 'production', 'installation', 'completed'].includes(c.stage)) {
             expectedRevenue += (c.orderValue || 0);
           }
         }
      });

      const dateStr = now.toLocaleDateString('vi-VN');
      
      let reportText = `📊 BÁO CÁO TỔNG QUAN NGÀY ${dateStr}\n`;
      reportText += `\n👤 Khách hàng mới: ${newCustomers}`;
      reportText += `\n📝 Báo giá mới tạo: ${newQuotes}`;
      reportText += `\n💰 Báo giá chốt mới: ${acceptedQuotes} (${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(acceptedRevenue)})`;
      reportText += `\n💵 Doanh thu thực tế (Tháng này): ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(actualRevenue)}`;
      reportText += `\n💳 Doanh thu dự kiến (Tháng này): ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(expectedRevenue)}`;
      reportText += `\n----------------------`;
      reportText += `\n🎨 Thiết kế: ${newDesigns} mới / ${completedDesigns} xong`;
      reportText += `\n🔨 Thi công: ${completedInstalls} hạng mục xong`;
      reportText += `\n✅ Tổng tác vụ đã xong: ${completedTasksCount}`;
      reportText += `\n\nChúc mọi người buổi tối vui vẻ!`;
      
      await sendSystemNotificationFromServer(reportText);
      return { success: true, message: "Daily report sent successfully" };
    } catch (err: any) {
      console.error('Error in runDailyReport:', err);
      throw err;
    }
  }

  // Core logic to send Zalo follow-up reminders to Sales
  async function runZaloReminders() {
    console.log('Running Zalo reminders...');
    try {
      const clientDb = await getAuthenticatedClientDb();
      
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(now.getDate() - 3);

      // Get Members for Zalo mappings
      const membersSnap = await getDocs(collection(clientDb, 'members'));
      const membersMap: Record<string, any> = {};
      membersSnap.forEach((doc: any) => {
        membersMap[doc.id] = doc.data();
      });

      // Get Customers
      const custSnap = await getDocs(collection(clientDb, 'customers'));
      let remindersSent = 0;

      // Helper to send DM
      const sendZaloDM = async (zaloUserId: string, message: string) => {
        try {
          const docSnap = await getDoc(doc(clientDb, 'configs', 'notifications'));
          if (!docSnap.exists()) return;
          const config = docSnap.data();
          if (config?.zalo?.isActive !== false && config.zalo.botToken) {
            await fetch(`https://bot-api.zaloplatforms.com/bot${config.zalo.botToken.trim()}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: zaloUserId, text: message })
            });
          }
        } catch (err) {
          console.error("Error sending Zalo DM:", err);
        }
      };

      const customersData = custSnap.docs.map((d: any) => d.data());
      
      for (const c of customersData) {
        const saleMember = membersMap[c.assignedSaleId];
        if (!saleMember || !saleMember.zaloUserId) continue;

        let shouldRemind = false;
        let reminderType = '';

        // Condition 1: nextContactDate
        if (c.nextContactDate && c.nextContactDate <= todayStr) {
          shouldRemind = true;
          reminderType = 'lịch hẹn gọi lại hôm nay (hoặc đã quá hạn)';
        } else if (c.stage === 'consulting') {
          // Condition 2: > 3 days no care log
          let lastCareDateStr = c.createdAt;
          if (c.careLogs && c.careLogs.length > 0) {
            const dates = c.careLogs.map((l: any) => l.date);
            lastCareDateStr = dates.reduce((a: string, b: string) => a > b ? a : b);
          }

          const lastCareDate = new Date(lastCareDateStr);
          if (lastCareDate < threeDaysAgo) {
            shouldRemind = true;
            reminderType = 'chưa được chăm sóc / cập nhật hơn 3 ngày qua';
          }
        }

        if (shouldRemind) {
          const msg = `🔔 NHẮC NHỞ CSKH\nKhách hàng: ${c.name}\nSĐT: ${c.phone}\nLý do: Khách hàng có ${reminderType}.\nSale phụ trách hãy liên hệ và cập nhật tình trạng nhé!`;
          await sendZaloDM(saleMember.zaloUserId, msg);
          remindersSent++;
        }
      }
      
      console.log(`Zalo reminders sent: ${remindersSent}`);
      return { success: true, count: remindersSent };
    } catch (err: any) {
      console.error('Error in runZaloReminders:', err);
      throw err;
    }
  }

  // Core logic to auto push 10 photos or 1 video from Dropbox to Zalo group
  async function runZaloPushMedia() {
    console.log('Running Zalo Auto Push Media from Dropbox...');
    try {
      const clientDb = await getAuthenticatedClientDb();

      // 1. Get Zalo Bot configurations
      const notifSnap = await getDoc(doc(clientDb, 'configs', 'notifications'));
      if (!notifSnap.exists()) {
        console.log('Zalo notifications config not found.');
        return { success: false, reason: 'Notifications config not found' };
      }
      const notifConfig = notifSnap.data();
      if (!notifConfig?.zalo?.isActive || !notifConfig.zalo.botToken || !notifConfig.zalo.chatId) {
        console.log('Zalo bot is not active or missing configurations.');
        return { success: false, reason: 'Zalo bot config inactive or missing' };
      }

      const zaloBotToken = notifConfig.zalo.botToken.trim();
      const zaloChatIds = notifConfig.zalo.chatId.split(',').map((id: string) => id.trim()).filter((id: string) => !!id);

      if (zaloChatIds.length === 0) {
        console.log('No Zalo chat IDs configured.');
        return { success: false, reason: 'No active chat IDs' };
      }

      // 2. Get Dropbox configurations
      const dbSnap = await getDoc(doc(clientDb, 'configs', 'dropbox'));
      if (!dbSnap.exists()) {
        console.log('Dropbox config not found in Firestore.');
        return { success: false, reason: 'Dropbox config not found' };
      }
      const dbConfig = dbSnap.data();
      if (!dbConfig?.appKey || !dbConfig.appSecret || !dbConfig.refreshToken) {
        console.log('Dropbox config is incomplete.');
        return { success: false, reason: 'Dropbox config incomplete' };
      }

      const dropboxFolder = dbConfig.folderPath || '/kho_anh_video';

      // 3. Get Dropbox Access Token
      const tokenParams = new URLSearchParams();
      tokenParams.append('grant_type', 'refresh_token');
      tokenParams.append('refresh_token', dbConfig.refreshToken.trim());
      tokenParams.append('client_id', dbConfig.appKey.trim());
      tokenParams.append('client_secret', dbConfig.appSecret.trim());

      const tokenRes = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams
      });

      if (!tokenRes.ok) {
        const errData = await tokenRes.json().catch(() => ({}));
        throw new Error(errData.error_description || 'Failed to refresh Dropbox access token');
      }
      const tokenData = await tokenRes.json();
      const dbAccessToken = tokenData.access_token;

      // 4. List files in Dropbox folder
      const listRes = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${dbAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          path: dropboxFolder,
          recursive: false,
          include_media_info: true
        })
      });

      if (!listRes.ok) {
        const errData = await listRes.json().catch(() => ({}));
        throw new Error(errData.error_summary || 'Failed to list Dropbox folder');
      }

      const listData = await listRes.json();
      const files = (listData.entries || [])
        .filter((entry: any) => entry['.tag'] === 'file')
        .map((entry: any) => ({
          name: entry.name,
          path: entry.path_display || entry.path_lower,
          lowerPath: entry.path_lower
        }))
        .sort((a: any, b: any) => a.lowerPath.localeCompare(b.lowerPath));

      if (files.length === 0) {
        console.log('No files found in Dropbox folder:', dropboxFolder);
        return { success: true, count: 0, message: 'No files found in folder' };
      }

      // 5. Get Sent Files State from Firestore
      const stateRef = doc(clientDb, 'configs', 'zalo_push_state');
      const stateSnap = await getDoc(stateRef);
      let sentFilePaths: string[] = [];
      if (stateSnap.exists()) {
        sentFilePaths = stateSnap.data().sentFilePaths || [];
      }

      // Filter out files that have already been sent
      const unsentFiles = files.filter((f: any) => !sentFilePaths.includes(f.path));

      if (unsentFiles.length === 0) {
        console.log('All files in Dropbox folder have been sent.');
        return { success: true, count: 0, message: 'All files sent' };
      }

      // 6. Select files to send
      const firstUnsent = unsentFiles[0];
      const isVideo = (pathStr: string) => {
        const ext = pathStr.split('.').pop()?.toLowerCase() || '';
        return ['mp4', 'mov', 'avi', 'mkv', '3gp'].includes(ext);
      };
      const isImage = (pathStr: string) => {
        const ext = pathStr.split('.').pop()?.toLowerCase() || '';
        return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(ext);
      };

      let filesToSend: any[] = [];
      let isVideoMessage = false;

      if (isVideo(firstUnsent.path)) {
        // If the first unsent item is a video, send it
        filesToSend = [firstUnsent];
        isVideoMessage = true;
      } else {
        // Otherwise, send up to 10 images sequentially
        for (const file of unsentFiles) {
          if (isImage(file.path)) {
            filesToSend.push(file);
            if (filesToSend.length >= 10) break;
          } else {
            // Stop collecting if we hit a video or other file type
            break;
          }
        }
        // If we found no images, fallback to just the first item
        if (filesToSend.length === 0) {
          filesToSend = [firstUnsent];
          isVideoMessage = isVideo(firstUnsent.path);
        }
      }

      console.log(`Selecting ${filesToSend.length} files to send. Video: ${isVideoMessage}`);

      // 7. Process sharing links for the selected files
      const sentFiles: string[] = [];
      const mediaUrls: string[] = [];

      for (const file of filesToSend) {
        try {
          // Try to create a shared link
          const shareRes = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${dbAccessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ path: file.path })
          });

          let sharedUrl = '';
          if (shareRes.ok) {
            const shareData = await shareRes.json();
            sharedUrl = shareData.url;
          } else {
            const errorData = await shareRes.json().catch(() => ({}));
            if (errorData.error?.['.tag'] === 'shared_link_already_exists') {
              const listLinksRes = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${dbAccessToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ path: file.path, direct_only: true })
              });
              if (listLinksRes.ok) {
                const listData = await listLinksRes.json();
                if (listData.links && listData.links.length > 0) {
                  sharedUrl = listData.links[0].url;
                }
              }
            }
          }

          if (sharedUrl) {
            // Convert to direct download url by replacing ?dl=0 with ?raw=1
            const directUrl = sharedUrl.replace(/\?dl=0$/, '?raw=1');
            mediaUrls.push(directUrl);
            sentFiles.push(file.path);
          } else {
            console.warn(`Could not generate shared link for ${file.path}`);
          }
        } catch (linkErr) {
          console.error(`Error generating link for ${file.path}:`, linkErr);
        }
      }

      if (sentFiles.length === 0) {
        console.log('No valid sharing links generated.');
        return { success: false, reason: 'Failed to generate sharing links' };
      }

      // 8. Send to Zalo Bot
      for (const chatId of zaloChatIds) {
        try {
          if (isVideoMessage) {
            // Send video sharing link via sendMessage
            const videoUrl = mediaUrls[0];
            const textMsg = `🎬 [I NỘI THẤT] Gửi nhóm video thiết kế mẫu hôm nay:\n👉 ${videoUrl}`;
            
            await fetch(`https://bot-api.zaloplatforms.com/bot${zaloBotToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: chatId, text: textMsg })
            });
            console.log(`Video link sent successfully to ${chatId}`);
          } else {
            // Send images sequentially via sendPhoto
            let imgCount = 1;
            for (const imgUrl of mediaUrls) {
              const captionText = imgCount === 1 ? `📸 [I NỘI THẤT] Gửi nhóm bộ ảnh thiết kế mẫu hôm nay:` : undefined;
              await fetch(`https://bot-api.zaloplatforms.com/bot${zaloBotToken}/sendPhoto`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: chatId,
                  photo: imgUrl,
                  caption: captionText
                })
              });
              imgCount++;
              // Sleep a bit to avoid flooding rate limits
              await new Promise(resolve => setTimeout(resolve, 500));
            }
            console.log(`Sent ${mediaUrls.length} photos successfully to ${chatId}`);
          }
        } catch (sendErr) {
          console.error(`Failed to send to Zalo chat ID ${chatId}:`, sendErr);
        }
      }

      // 9. Update push state in Firestore
      const updatedSentFilePaths = Array.from(new Set([...sentFilePaths, ...sentFiles]));
      await setDoc(stateRef, {
        sentFilePaths: updatedSentFilePaths,
        lastPushAt: new Date().toISOString(),
        lastPushFilesCount: sentFiles.length,
        lastPushType: isVideoMessage ? 'video' : 'images'
      }, { merge: true });

      console.log(`State updated in Firestore. Total files tracked: ${updatedSentFilePaths.length}`);
      return {
        success: true,
        type: isVideoMessage ? 'video' : 'images',
        sentFiles: sentFiles,
        chatsTargeted: zaloChatIds.length
      };

    } catch (err: any) {
      console.error('Error in runZaloPushMedia:', err);
      throw err;
    }
  }

  // Schedule Zalo Push Media at 08:00 Asia/Ho_Chi_Minh
  async function scheduleZaloPushMedia() {
    try {
      cron.schedule('0 8 * * *', async () => {
        try {
          await runZaloPushMedia();
        } catch (e) {
          console.error("Local Zalo push media failed:", e);
        }
      }, {
        scheduled: true,
        timezone: "Asia/Ho_Chi_Minh"
      } as any);
      console.log("Zalo Push Media scheduler initialized (08:00 Asia/Ho_Chi_Minh).");
    } catch (err) {
      console.error("Could not initialize node-cron for zalo push media:", err);
    }
  }

  // Schedule daily overview report at 18:00
  async function scheduleDailyReport() {
    try {
      cron.schedule('0 18 * * *', async () => {
        try {
          await runDailyReport();
        } catch (e) {
          console.error("Local daily report failed:", e);
        }
      }, {
        scheduled: true,
        timezone: "Asia/Ho_Chi_Minh"
      } as any);
      console.log("Daily report scheduler initialized (18:00 Asia/Ho_Chi_Minh).");
    } catch (err) {
      console.error("Could not initialize node-cron:", err);
    }
  }

  // Schedule Follow-up Reminders at 08:30
  async function scheduleZaloReminders() {
    try {
      cron.schedule('30 8 * * *', async () => {
        try {
          await runZaloReminders();
        } catch (e) {
          console.error("Local Zalo reminders failed:", e);
        }
      }, {
        scheduled: true,
        timezone: "Asia/Ho_Chi_Minh"
      } as any);
      console.log("Zalo Reminders scheduler initialized (08:30 Asia/Ho_Chi_Minh).");
    } catch (err) {
      console.error("Could not initialize node-cron for reminders:", err);
    }
  }

  // GET endpoints for Vercel Cron Jobs
  app.get("/api/cron/daily-report", async (req, res) => {
    try {
      const result = await runDailyReport();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to generate report", details: err.message });
    }
  });

  app.get("/api/cron/zalo-reminders", async (req, res) => {
    try {
      const result = await runZaloReminders();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to send reminders", details: err.message });
    }
  });

  app.get("/api/cron/zalo-push-media", async (req, res) => {
    try {
      const result = await runZaloPushMedia();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to push media", details: err.message });
    }
  });

  // Listen to sales_routes additions and notify Zalo
  async function listenToSalesRoutes() {
    try {
      const clientDb = await getAuthenticatedClientDb();
      
      const serverStartTime = new Date().toISOString();
      console.log(`Starting Firestore listener for sales_routes created after ${serverStartTime}`);
      
      const q = query(
        collection(clientDb, 'sales_routes'),
        where('timestamp', '>=', serverStartTime)
      );
      
      onSnapshot(q, (snapshot: any) => {
        snapshot.docChanges().forEach(async (change: any) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            console.log("New sales route check-in detected on server:", data);
            
            const note = data.note || '';
            // If check-in note is from Zalo webhook location, skip it to avoid duplicate notification
            if (note === 'Check-in qua Zalo' || note.includes('Check-in qua Zalo')) {
              console.log("Skipping Zalo webhook check-in to avoid duplicate notification");
              return;
            }
            
            const memberName = data.memberName || 'Nhân viên';
            const address = data.address || 'Không rõ địa điểm';
            const customerName = data.customerName || 'Không chọn';
            const customerPhone = data.customerPhone || '';
            
            const messageText = 
              `📍 Check-in Lịch trình Sale!\n` +
              `👤 Nhân viên: ${memberName}\n` +
              `🏠 Địa điểm: ${address}\n` +
              `👥 Khách hàng: ${customerName}` + (customerPhone ? ` - SĐT: ${customerPhone}\n` : `\n`) +
              `📝 Ghi chú: ${note || 'Check-in trực tiếp trên Web'}`;
              
            await sendSystemNotificationFromServer(messageText);
          }
        });
      }, (error: any) => {
        console.error("Error in sales_routes listener:", error);
      });
    } catch (err) {
      console.error("Failed to start sales_routes listener:", err);
    }
  }

  // Khởi tạo các lịch trình cron và listener (Chỉ chạy khi chạy local hoặc VPS độc lập, không chạy trên Serverless Vercel)
  if (!process.env.VERCEL) {
    scheduleDailyReport();
    scheduleZaloReminders();
    scheduleZaloPushMedia();
    listenToSalesRoutes();
  }

  app.post(["/webhooks/zalo", "/api/webhooks/zalo"], async (req, res) => {
    const body = req.body;
    console.log("Received Zalo Webhook:", JSON.stringify(body, null, 2));
    
    const logItem = { 
      time: new Date().toISOString(), 
      headers: req.headers,
      body 
    };
    await saveWebhookLog(logItem);

    // We should ideally use a secret token from env or database
    const WEBHOOK_SECRET_TOKEN = process.env.ZALO_WEBHOOK_SECRET || 'your-secret-token';
    const secretToken = req.headers["x-bot-api-secret-token"];
    
    // Only check if secret is configured in environment, otherwise allow for easy testing
    if (process.env.ZALO_WEBHOOK_SECRET && secretToken !== WEBHOOK_SECRET_TOKEN) {
      console.warn("Zalo webhook unauthorized access attempt");
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      let event_name = body.event_name;
      let message = body.message;
      let senderId = body.sender?.id;

      // Handle the nested 'result' structure if it exists
      if (body.result) {
        event_name = body.result.event_name || event_name;
        message = body.result.message || message;
      }

      // Handle text messages (message.text.received, user_send_text, or any message with text)
      const text = message?.text || (typeof body.text === 'string' ? body.text : undefined);
      if (text) {
        senderId = message?.from?.id || body.sender?.id || senderId;
        console.log(`Received text message from ${senderId}: ${text}`);
        
        // Auto-reply to get Zalo User ID & Group Chat ID
        const trimmedText = text?.trim()?.toLowerCase();
        if (trimmedText === '/id' || trimmedText === 'id' || trimmedText === '/myid' || trimmedText === 'mã id' || trimmedText === '/groupid' || trimmedText === 'group id') {
          try {
            const clientDb = await getAuthenticatedClientDb();
            const docSnap = await getDoc(doc(clientDb, 'configs', 'notifications'));
            const configData = docSnap.data();
            const botToken = configData?.zalo?.botToken;
            
            if (botToken && senderId) {
              const replyText = `🆔 THÔNG TIN ZALO BOT\n\n👤 Mã Zalo User ID của bạn:\n${senderId}\n\n👉 Hãy sao chép mã User ID ở trên và dán vào ô "Chat ID" trong phần Cấu hình Bot Thông Báo.`;

              await fetch(`https://bot-api.zaloplatforms.com/bot${botToken.trim()}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  chat_id: senderId, 
                  text: replyText 
                })
              });
              console.log(`Replied with ID to user ${senderId} successfully`);
            }
          } catch (replyErr) {
            console.error("Failed to auto-reply Zalo ID:", replyErr);
          }
        }
      }

      if (event_name === 'message.image.received' && message) {
        senderId = message.from?.id || senderId;
        const photoUrl = message.photo;
        console.log(`Received image message from ${senderId}: ${photoUrl}`);
      } else if ((event_name === 'user_send_location' || event_name === 'message.location.received') && message) {
        senderId = message.from?.id || body.sender?.id || senderId;
        let lat: number | undefined;
        let lng: number | undefined;
        
        if (message.attachments && Array.isArray(message.attachments)) {
          const locationAttachment = message.attachments.find((a: any) => a.type === 'location');
          if (locationAttachment && locationAttachment.payload && locationAttachment.payload.coordinates) {
            const coords = locationAttachment.payload.coordinates;
            lat = parseFloat(coords.latitude || coords.lat);
            lng = parseFloat(coords.longitude || coords.long || coords.lng);
          }
        } else if (message.location) {
          lat = parseFloat(message.location.latitude || message.location.lat);
          lng = parseFloat(message.location.longitude || message.location.lng || message.location.long);
        } else {
          lat = parseFloat(message.lat || message.latitude);
          lng = parseFloat(message.long || message.lng || message.longitude);
        }

        if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
          console.log(`Received location from ${senderId}: ${lat}, ${lng}`);
          
          try {
            const now = new Date().toISOString();
            const routeData = {
              memberId: senderId || 'unknown',
              memberName: 'Zalo User',
              zaloUserId: senderId || 'unknown',
              latitude: lat,
              longitude: lng,
              timestamp: now,
              note: 'Check-in qua Zalo'
            };

            // Validate data structure using Zod before writing
            const validatedData = SalesRouteSchema.omit({ id: true }).parse(routeData);

            let dbId = undefined;
            const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
            if (fs.existsSync(configPath)) {
              try {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                dbId = config.firestoreDatabaseId;
              } catch (e) {
                console.error("Failed to parse firebase-applet-config.json", e);
              }
            }

            let writeSucceeded = false;
            if (isFirebaseInitialized) {
              try {
                const db = getFirestore(dbId);
                await db.collection('sales_routes').add(validatedData);
                console.log(`Saved location for Zalo User ${senderId} using Firebase Admin SDK`);
                writeSucceeded = true;
              } catch (adminErr) {
                console.warn(`Failed to write using Firebase Admin SDK, trying Client SDK fallback:`, adminErr instanceof Error ? adminErr.message : String(adminErr));
              }
            }

            if (!writeSucceeded) {
              // Fallback to Client SDK
              let firebaseApp;
              if (getApps().length === 0) {
                if (fs.existsSync(configPath)) {
                  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                  firebaseApp = initializeApp(config);
                } else {
                  throw new Error('firebase-applet-config.json not found');
                }
              } else {
                firebaseApp = getApp();
              }
              const db = getClientFirestore(firebaseApp, dbId);
              await addDoc(collection(db, 'sales_routes'), validatedData);
              console.log(`Saved location for Zalo User ${senderId} using Firebase Client SDK fallback`);
            }

            // Trigger check-in notification from server using authenticated Client SDK
            let memberName = 'Nhân viên Zalo';
            try {
              const clientDb = await getAuthenticatedClientDb();
              const q = query(collection(clientDb, 'members'), where('zaloUserId', '==', senderId));
              const memberSnap = await getDocs(q);
              if (memberSnap && !memberSnap.empty) {
                memberName = memberSnap.docs[0].data().name || memberName;
              }
            } catch (e) {
              console.error("Error fetching member name in Zalo webhook:", e);
            }

            const messageText = 
              `📍 Check-in Lịch trình Sale (qua Zalo)!\n` +
              `👤 Nhân viên: ${memberName}\n` +
              `🏠 Tọa độ: ${lat}, ${lng}\n` +
              `📝 Ghi chú: Check-in qua Zalo`;
            sendSystemNotificationFromServer(messageText).catch(e => console.error("Notification server error:", e));
          } catch (dbErr) {
            console.error("Failed to validate or save location to Firestore:", dbErr);
          }
        }
      }

      // Always return Success for Zalo to stop retrying
      res.json({ message: "Success" });
    } catch (error) {
      console.error("Zalo webhook error:", error);
      // Still return 200 OK to Zalo so it doesn't retry infinitely, but log the error
      res.json({ message: "Error processed", details: String(error) });
    }
  });

  // Proxy for Zalo Bot API to bypass CORS (supports comma-separated IDs)
  app.post("/api/test-zalo-bot", async (req, res) => {
    const { botToken, chatId, text } = req.body;
    
    if (!botToken || !chatId || !text) {
      return res.status(400).json({ error: "Missing botToken, chatId, or text" });
    }

    const cleanToken = botToken.trim();
    const chatIds = Array.from(new Set(chatId.split(',').map((id: string) => id.trim()).filter((id: string) => !!id))) as string[];

    if (chatIds.length === 0) {
      return res.status(400).json({ error: "No valid Chat ID found" });
    }

    try {
      console.log("Proxying Zalo Bot request for IDs:", chatIds, "with text:", text);
      const results = [];
      let lastError = null;
      let lastResponseStatus = 200;

      for (const id of chatIds) {
        try {
          const response = await fetch(`https://bot-api.zaloplatforms.com/bot${cleanToken}/sendMessage`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chat_id: id,
              text: text
            }),
          });

          const data = await response.json();
          console.log(`Zalo API response for ID ${id}:`, response.status, data);
          lastResponseStatus = response.status;
          results.push({ id, status: response.status, data });
          if (!response.ok || data.error || !data.ok) {
            lastError = data.message || data.description || data.error || 'Failed to send message';
          }
        } catch (err: any) {
          console.error(`Error sending Zalo message to ID ${id}:`, err);
          lastError = err.message;
          results.push({ id, error: err.message });
        }
      }

      if (lastError && chatIds.length === 1) {
        return res.status(lastResponseStatus).json({ error: lastError });
      }

      return res.json({ message: "Completed", results });
    } catch (error: any) {
      console.error("Zalo Bot proxy error:", error);
      res.status(500).json({ error: "Failed to fetch from Zalo Bot API", details: error.message });
    }
  });

  // Financial Transactions API (Admin SDK Bypass for cross-device sync)
  app.get("/api/financial-transactions", async (req, res) => {
    try {
      const clientDb = await getAuthenticatedClientDb();
      const snapshot = await getDocs(collection(clientDb, 'financial_transactions'));
      const items = snapshot.docs.map(docSnap => ({
        ...docSnap.data(),
        id: docSnap.id
      }));
      res.json(items);
    } catch (error: any) {
      console.error("API GET financial-transactions error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/financial-transactions", async (req, res) => {
    try {
      const clientDb = await getAuthenticatedClientDb();
      const transactionData = req.body;
      if (!transactionData || !transactionData.id) {
        return res.status(400).json({ error: "Missing transaction data or id" });
      }
      const docRef = doc(clientDb, 'financial_transactions', transactionData.id);
      await setDoc(docRef, transactionData, { merge: true });
      res.json({ success: true, id: transactionData.id });
    } catch (error: any) {
      console.error("API POST financial-transactions error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/financial-transactions/:id", async (req, res) => {
    try {
      const clientDb = await getAuthenticatedClientDb();
      const { id } = req.params;
      const docRef = doc(clientDb, 'financial_transactions', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        await addDoc(collection(clientDb, 'trash'), {
          originalId: id,
          collection: 'financial_transactions',
          title: data.title || id,
          data,
          deletedAt: new Date().toISOString(),
          deletedBy: 'Người dùng'
        });
        await deleteDoc(docRef);
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("API DELETE financial-transactions error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/upload-document", async (req, res) => {
    const { name, type, folderId, base64 } = req.body;
    if (!name || !folderId || !base64) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const buffer = Buffer.from(base64, 'base64');
    const uniqueId = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 9);
    const safeName = name.replace(/[^a-zA-Z0-9.-]/g, '_');

    // 1. Try Firebase Storage
    try {
      initializeFirebaseAdmin();
      const bucket = admin.storage().bucket();
      const filePath = `product_documents/${folderId}/${uniqueId}_${safeName}`;
      const file = bucket.file(filePath);

      await file.save(buffer, {
        metadata: {
          contentType: type || 'application/octet-stream',
        },
      });

      // Make the file publicly accessible
      await file.makePublic();

      const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media`;
      console.log("Uploaded successfully to Firebase Storage:", publicUrl);
      return res.json({ success: true, url: publicUrl, size: buffer.length });
    } catch (error: any) {
      console.warn("Firebase Storage upload failed, falling back to local server storage. Error:", error.message);

      // 2. Fallback to local server storage
      try {
        const uploadsDir = path.join(process.cwd(), 'uploads', 'product_documents');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const fileName = `${uniqueId}_${safeName}`;
        const localPath = path.join(uploadsDir, fileName);
        fs.writeFileSync(localPath, buffer);

        const publicUrl = `/uploads/product_documents/${fileName}`;
        console.log("Fallback storage upload successful:", publicUrl);
        return res.json({ 
          success: true, 
          url: publicUrl, 
          size: buffer.length, 
          isFallback: true, 
          warning: "Firebase Storage chưa được kích hoạt nên tệp được lưu tạm thời trên máy chủ." 
        });
      } catch (localError: any) {
        console.error("Local fallback storage upload failed:", localError);
        return res.status(500).json({ error: `Không thể tải lên: Cả Firebase Storage (${error.message}) và bộ nhớ tạm thời trên máy chủ đều gặp lỗi.` });
      }
    }
  });

  // Local Image Proxy to bypass Safari CORS canvas taint
  app.get("/api/proxy-image", async (req, res) => {
    try {
      const imageUrl = req.query.url as string;
      if (!imageUrl) {
        return res.status(400).send("Missing URL parameter");
      }
      
      const response = await fetch(imageUrl);
      if (!response.ok) {
        return res.status(response.status).send("Failed to fetch upstream image");
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
      res.send(buffer);
    } catch (err: any) {
      console.error("Proxy image error:", err.message);
      res.status(500).send("Error proxying image");
    }
  });

  // Vite middleware for development / Production static files (conditional for serverless)
  async function startServer() {
    const PORT = parseInt(process.env.PORT || "3000", 10);
    
    if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else if (process.env.NODE_ENV === "production" && !process.env.VERCEL) {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('/*any', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    if (!process.env.VERCEL) {
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
      });
    }
  }

  startServer();

  export default app;
