import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import * as admin from 'firebase-admin';

let fcm: admin.messaging.Messaging | null = null;

function getFCM() {
  if (fcm) return fcm;
  
  try {
    if (!admin.apps.length) {
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (serviceAccount && serviceAccount !== "undefined" && serviceAccount.trim() !== "") {
        try {
          admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(serviceAccount))
          });
        } catch (jsonErr) {
          console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT env var", jsonErr);
          admin.initializeApp({
            credential: admin.credential.applicationDefault()
          });
        }
      } else {
        // Fallback to default or just project ID if possible
        admin.initializeApp({
          credential: admin.credential.applicationDefault()
        });
      }
    }
    fcm = admin.messaging();
    return fcm;
  } catch (error) {
    console.warn("Firebase Admin initialization failed. Notifications will not work.", error);
    return null;
  }
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

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
    app.get('/:any*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
