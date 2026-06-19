import { db, doc, getDoc, setDoc, serverTimestamp } from '@/src/lib/firebase';
import { BotNotificationConfigSchema } from '@/src/schemas';
import { z } from 'zod';

export type BotNotificationConfig = z.infer<typeof BotNotificationConfigSchema>;

const CONFIG_DOC_PATH = 'configs/notifications';

/**
 * Fetch the current bot notification configurations.
 */
export async function getBotNotificationConfig(): Promise<BotNotificationConfig | null> {
  try {
    const docRef = doc(db, CONFIG_DOC_PATH);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as BotNotificationConfig;
    }
    return null;
  } catch (error) {
    console.error('Error fetching bot config:', error);
    throw error;
  }
}

/**
 * Update the bot notification configurations.
 */
export async function updateBotNotificationConfig(config: Partial<BotNotificationConfig>, userEmail?: string) {
  try {
    const docRef = doc(db, CONFIG_DOC_PATH);
    await setDoc(docRef, {
      ...config,
      updatedAt: serverTimestamp(),
      updatedBy: userEmail || 'unknown',
    }, { merge: true });
  } catch (error) {
    console.error('Error updating bot config:', error);
    throw error;
  }
}

/**
 * Send a test message via Telegram API
 */
export async function sendTelegramTestMessage(botToken: string, chatId: string, message: string = "Đây là tin nhắn test từ hệ thống I NỘI THẤT."): Promise<boolean> {
  if (!botToken || !chatId) {
    throw new Error('Thiếu Bot Token hoặc Chat ID');
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.description || 'Gửi tin nhắn Telegram thất bại');
    }

    return true;
  } catch (error) {
    console.error('Telegram test error:', error);
    throw error;
  }
}

/**
 * Send a test message via Zalo Bot Platform API
 */
export async function sendZaloTestMessage(botToken: string, userId: string, message: string = "Đây là tin nhắn test từ hệ thống I NỘI THẤT."): Promise<boolean> {
  if (!botToken || !userId) {
    throw new Error('Thiếu Zalo Bot Token hoặc User ID');
  }

  try {
    // Zalo Bot API endpoint (bot.zaloplatforms.com)
    // Dùng API tương tự Telegram: https://bot-api.zaloplatforms.com/bot<TOKEN>/sendMessage
    const response = await fetch(`https://bot-api.zaloplatforms.com/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: userId,
        text: message
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || errorData.description || 'Gửi tin nhắn Zalo Bot thất bại');
    }

    const data = await response.json();
    if (data.error || !data.ok) {
      throw new Error(data.message || data.description || 'Lỗi từ Zalo Bot API');
    }

    return true;
  } catch (error) {
    console.error('Zalo test error:', error);
    throw error;
  }
}
