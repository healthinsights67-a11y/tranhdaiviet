import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import admin from 'firebase-admin';

let isFirebaseInitialized = false;

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

  // Zalo Webhook Endpoint
  app.post("/webhooks/zalo", async (req, res) => {
    // We should ideally use a secret token from env or database
    const WEBHOOK_SECRET_TOKEN = process.env.ZALO_WEBHOOK_SECRET || 'your-secret-token';
    const secretToken = req.headers["x-bot-api-secret-token"];
    
    // Only check if secret is configured in environment, otherwise allow for easy testing
    if (process.env.ZALO_WEBHOOK_SECRET && secretToken !== WEBHOOK_SECRET_TOKEN) {
      console.warn("Zalo webhook unauthorized access attempt");
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      const body = req.body;
      console.log("Received Zalo Webhook:", JSON.stringify(body, null, 2));

      // Zalo Webhook structure usually has `event_name` directly or inside `result`.
      // According to the new docs, it's inside `req.body` or sometimes wrapped.
      // Based on the provided sample response image:
      // { "ok": true, "result": { "message": { ... }, "event_name": "message.text.received" } }
      // Or in some API versions it might just be the root level payload depending on the type of webhook.
      
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
      }

      // Always return Success for Zalo to stop retrying
      res.json({ message: "Success" });
    } catch (error) {
      console.error("Zalo webhook error:", error);
      // Still return 200 OK to Zalo so it doesn't retry infinitely, but log the error
      res.json({ message: "Error processed", details: String(error) });
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
