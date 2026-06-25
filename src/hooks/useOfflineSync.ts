import { useEffect, useState, useCallback } from 'react';
import { db, collection, addDoc } from '../lib/firebase';
import { sendSystemNotification } from '../services/botNotificationService';
import { toast } from 'sonner';

const OFFLINE_QUEUE_KEY = 'sales_checkin_offline_queue';

export interface OfflineCheckinData {
  id: string;
  isNewCustomer: boolean;
  newCustomerPayload?: any;
  routePayload: any;
  messageText: string;
}

export const useOfflineSync = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  const getQueue = (): OfflineCheckinData[] => {
    try {
      const q = localStorage.getItem(OFFLINE_QUEUE_KEY);
      return q ? JSON.parse(q) : [];
    } catch {
      return [];
    }
  };

  const updateCount = useCallback(() => {
    setPendingCount(getQueue().length);
  }, []);

  const addOfflineCheckin = (data: Omit<OfflineCheckinData, 'id'>) => {
    const queue = getQueue();
    const newItem = { ...data, id: Date.now().toString() };
    queue.push(newItem);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    updateCount();
    toast.success('Đã lưu offline. Sẽ đồng bộ khi có mạng!', { duration: 4000 });
  };

  const syncQueue = useCallback(async () => {
    const queue = getQueue();
    if (queue.length === 0) return;

    toast.info(`Đang đồng bộ ${queue.length} lượt check-in offline...`);
    let successCount = 0;

    const remainingQueue: OfflineCheckinData[] = [];

    for (const item of queue) {
      try {
        if (item.isNewCustomer && item.newCustomerPayload) {
          await addDoc(collection(db, 'customers'), item.newCustomerPayload);
        }
        await addDoc(collection(db, 'sales_routes'), item.routePayload);
        
        // Try to send notification
        if (item.messageText) {
          sendSystemNotification(item.messageText).catch(() => {});
        }
        successCount++;
      } catch (error) {
        console.error('Failed to sync offline item', error);
        remainingQueue.push(item); // Keep in queue to try later
      }
    }

    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remainingQueue));
    updateCount();

    if (successCount > 0) {
      toast.success(`Đã đồng bộ thành công ${successCount} check-in!`);
    }
    if (remainingQueue.length > 0) {
      toast.error(`Còn ${remainingQueue.length} lượt check-in chưa đồng bộ được.`);
    }
  }, [updateCount]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    updateCount();
    if (navigator.onLine && getQueue().length > 0) {
      syncQueue();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncQueue, updateCount]);

  return { isOnline, pendingCount, addOfflineCheckin, syncQueue };
};
