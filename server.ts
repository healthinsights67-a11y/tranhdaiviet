import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { SalesRouteSchema } from './src/schemas';

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

  const { initializeApp, getApp, getApps } = require('firebase/app');
  const { getAuth, signInWithCustomToken } = require('firebase/auth');
  const { getFirestore: getClientFirestore } = require('firebase/firestore');

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

  let storageBucket = "gen-lang-client-0686745109.firebasestorage.app";
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

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

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
  
  app.get(["/api/webhook-logs", "/api/webhook_logs"], (req, res) => {
    res.json(recentWebhooks);
  });

  // Helper to send bot notification from Express server using authenticated Client SDK
  async function sendSystemNotificationFromServer(message: string) {
    try {
      const { doc, getDoc } = require('firebase/firestore');
      const clientDb = await getAuthenticatedClientDb();
      const docSnap = await getDoc(doc(clientDb, 'configs', 'notifications'));
      if (!docSnap.exists()) return;
      const config = docSnap.data();
      if (!config) return;

      // Send to Zalo if enabled
      if (config.zalo?.isActive && config.zalo.botToken && config.zalo.chatId) {
        const chatIds = config.zalo.chatId.split(',').map((id: string) => id.trim()).filter((id: string) => !!id);
        for (const id of chatIds) {
          try {
            await fetch(`https://bot-api.zaloplatforms.com/bot${config.zalo.botToken.trim()}/sendMessage`, {
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
    } catch (err) {
      console.error("Error sending bot notification from server:", err);
    }
  }

  // Schedule daily overview report at 18:00
  async function scheduleDailyReport() {
    try {
      const cron = require('node-cron');
      
      // Run every day at 18:00 (Vietnam time)
      cron.schedule('0 18 * * *', async () => {
        console.log('Running scheduled daily report at 18:00...');
        try {
          const { collection, getDocs, query, where } = require('firebase/firestore');
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
          let acceptedRevenue = 0; // expected revenue
          let actualRevenue = 0; // actual money collected
          
          const allQuotes: any[] = [];
          quoteSnap.forEach((doc: any) => {
             const q = doc.data();
             allQuotes.push(q);
             if (q.createdAt && q.createdAt >= startOfDayStr && q.createdAt <= endOfDayStr) {
               newQuotes++;
             }
             if (q.status === 'accepted' || q.status === 'deposit') {
               // Fallback: if we don't have acceptedAt, we use updatedAt
               if (q.updatedAt && q.updatedAt >= startOfDayStr && q.updatedAt <= endOfDayStr) {
                  acceptedQuotes++;
                  acceptedRevenue += q.totalAmount || 0;
               }
             }
          });

          // Doanh thu thực tế trong tháng (đồng bộ logic với web dashboard)
          const custUpdatedQuery = query(
            collection(clientDb, 'customers')
          );
          const custAllSnap = await getDocs(custUpdatedQuery);
          custAllSnap.forEach((doc: any) => {
            const c = doc.data();
             // Đồng bộ logic: nhóm theo createdAt của tháng hiện tại
             if (c.createdAt && c.createdAt >= startOfMonthStr && c.createdAt <= endOfMonthStr) {
               if (c.stage === 'completed') {
                 actualRevenue += (c.orderValue || 0);
               } else if (['contracted', 'production', 'installation'].includes(c.stage)) {
                 const q = allQuotes.find((quot: any) => quot.customerId === c.id || (quot.customerName === c.name && quot.phone === c.phone));
                 const deposit = (q?.status === 'deposit' || q?.depositAmount) ? (q.depositAmount || 0) : 0;
                 actualRevenue += deposit;
               }
             }
          });

          const dateStr = now.toLocaleDateString('vi-VN');
          
          let reportText = `📊 BÁO CÁO TỔNG QUAN NGÀY ${dateStr}\n`;
          reportText += `\n👤 Khách hàng mới: ${newCustomers}`;
          reportText += `\n📝 Báo giá mới tạo: ${newQuotes}`;
          reportText += `\n💰 Báo giá chốt mới: ${acceptedQuotes} (${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(acceptedRevenue)})`;
          reportText += `\n💵 Doanh thu thực tế (Tháng này): ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(actualRevenue)}`;
          reportText += `\n----------------------`;
          reportText += `\n🎨 Thiết kế: ${newDesigns} mới / ${completedDesigns} xong`;
          reportText += `\n🔨 Thi công: ${completedInstalls} hạng mục xong`;
          reportText += `\n✅ Tổng tác vụ đã xong: ${completedTasksCount}`;
          reportText += `\n\nChúc mọi người buổi tối vui vẻ!`;
          
          await sendSystemNotificationFromServer(reportText);
        } catch (err) {
          console.error('Error generating daily report:', err);
        }
      }, {
        scheduled: true,
        timezone: "Asia/Ho_Chi_Minh"
      });
      
      console.log("Daily report scheduler initialized (18:00 Asia/Ho_Chi_Minh).");
    } catch (err) {
      console.error("Could not initialize node-cron:", err);
    }
  }

  // Schedule Follow-up Reminders at 08:30
  async function scheduleZaloReminders() {
    try {
      const cron = require('node-cron');
      
      cron.schedule('30 8 * * *', async () => {
        console.log('Running scheduled Zalo reminders at 08:30...');
        try {
          const { collection, getDocs } = require('firebase/firestore');
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
              const { doc, getDoc } = require('firebase/firestore');
              const docSnap = await getDoc(doc(clientDb, 'configs', 'notifications'));
              if (!docSnap.exists()) return;
              const config = docSnap.data();
              if (config?.zalo?.isActive && config.zalo.botToken) {
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
            if (!saleMember || !saleMember.zaloUserId) continue; // Skip if no sale or no zalo ID

            let shouldRemind = false;
            let reminderType = '';

            // Condition 1: nextContactDate
            if (c.nextContactDate && c.nextContactDate <= todayStr) {
              shouldRemind = true;
              reminderType = 'lịch hẹn gọi lại hôm nay (hoặc đã quá hạn)';
            } else if (c.stage === 'consulting') {
              // Condition 2: > 3 days no care log
              let lastCareDateStr = c.createdAt; // default to created at
              if (c.careLogs && c.careLogs.length > 0) {
                // assume sorted or just find max
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
        } catch (err) {
          console.error('Error generating Zalo reminders:', err);
        }
      }, {
        scheduled: true,
        timezone: "Asia/Ho_Chi_Minh"
      });
      console.log("Zalo Reminders scheduler initialized (08:30 Asia/Ho_Chi_Minh).");
    } catch (err) {
      console.error("Could not initialize node-cron for reminders:", err);
    }
  }

  // Khởi tạo các lịch trình cron
  scheduleDailyReport();
  scheduleZaloReminders();

  // Zalo Webhook Endpoint
  app.post("/webhooks/zalo", async (req, res) => {
    const body = req.body;
    console.log("Received Zalo Webhook:", JSON.stringify(body, null, 2));
    
    recentWebhooks.unshift({ 
      time: new Date().toISOString(), 
      headers: req.headers,
      body 
    });
    if (recentWebhooks.length > 20) recentWebhooks.pop();

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

      // Handle the event
      if (event_name === 'message.text.received' && message) {
        senderId = message.from?.id || senderId;
        const text = message.text;
        console.log(`Received text message from ${senderId}: ${text}`);
        // Handle your logic here (e.g., save to Firestore, auto-reply, etc.)
      } else if (event_name === 'message.image.received' && message) {
        senderId = message.from?.id || senderId;
        const photoUrl = message.photo;
        console.log(`Received image message from ${senderId}: ${photoUrl}`);
      } else if ((event_name === 'user_send_location' || event_name === 'user_send_text' || event_name === 'message.location.received') && message) {
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
              const { initializeApp, getApp, getApps } = require('firebase/app');
              const { getFirestore: getClientFirestore, collection, addDoc } = require('firebase/firestore');
              
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
              const { collection, query, where, getDocs } = require('firebase/firestore');
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

  // Proxy for Zalo Bot API to bypass CORS
  app.post("/api/test-zalo-bot", async (req, res) => {
    const { botToken, chatId, text } = req.body;
    
    if (!botToken || !chatId || !text) {
      return res.status(400).json({ error: "Missing botToken, chatId, or text" });
    }

    const cleanToken = botToken.trim();
    const cleanChatId = chatId.trim();

    try {
      const response = await fetch(`https://bot-api.zaloplatforms.com/bot${cleanToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: cleanChatId,
          text: text
        }),
      });

      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error: any) {
      console.error("Zalo Bot proxy error:", error);
      res.status(500).json({ error: "Failed to fetch from Zalo Bot API", details: error.message });
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('/*any', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
