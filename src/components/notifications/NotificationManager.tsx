import React, { useEffect, useState } from 'react';
import { messaging, getToken, onMessage, db, auth, doc, updateDoc, arrayUnion, collection, query, where, getDocs, setDoc } from '@/src/lib/firebase';
import { toast } from 'sonner';

export function NotificationManager() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' ? Notification.permission : 'default'
  );
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    if (!messaging) {
      console.warn('Firebase Messaging is not supported or initialized.');
      return;
    }

    async function requestAndSaveToken() {
      try {
        const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
        
        if (!vapidKey || vapidKey === 'YOUR_FCM_VAPID_KEY') {
          console.warn('VITE_FIREBASE_VAPID_KEY is not set. Please set it in the settings.');
          setDebugInfo('Thiếu VAPID Key trong cài đặt.');
          return;
        }

        const token = await getToken(messaging, { vapidKey });
        
        if (token && auth.currentUser) {
          console.log('Current identity for token:', auth.currentUser.email);
          try {
            // Priority 1: Save to members collection
            const membersRef = collection(db, 'members');
            const q = query(membersRef, where('email', '==', auth.currentUser.email));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
              const memberDoc = querySnapshot.docs[0];
              await updateDoc(doc(db, 'members', memberDoc.id), {
                fcmTokens: arrayUnion(token),
                lastUpdated: new Date().toISOString()
              });
              console.log('FCM Token saved to member profile.');
              toast.success('Thiết bị đã sẵn sàng nhận thông báo (Member)');
            } else {
              // Priority 2: Save to users collection (fallback)
              const userRef = doc(db, 'users', auth.currentUser.uid);
              await setDoc(userRef, { 
                email: auth.currentUser.email,
                fcmTokens: arrayUnion(token),
                lastUpdated: new Date().toISOString()
              }, { merge: true });
              console.log('FCM Token saved to user fallback.');
              toast.success('Thiết bị đã sẵn sàng nhận thông báo (User)');
            }
          } catch (e) {
            console.error('Error saving token to Firestore:', e);
            setDebugInfo('Lỗi lưu token vào DB: ' + (e instanceof Error ? e.message : 'Unknown'));
          }
        }
      } catch (error) {
        console.error('Error getting FCM token:', error);
        setDebugInfo('Lỗi lấy mã FCM. Hãy kiểm tra VAPID Key.');
      }
    }

    const authUnsubscribe = auth.onAuthStateChanged((user) => {
      if (user && permission === 'granted') {
        requestAndSaveToken();
      }
    });

    const onMessageUnsubscribe = onMessage(messaging, (payload) => {
      console.log('Message received. ', payload);
      toast(payload.notification?.title || 'Thông báo mới', {
        description: payload.notification?.body,
      });
    });

    return () => {
      authUnsubscribe();
      onMessageUnsubscribe();
    };
  }, [permission]);

  // Debugging helper (console only, no disruptive toasts for users)
  useEffect(() => {
    if (debugInfo && auth.currentUser) {
      console.warn('Nhắc nhở Kỹ thuật (FCM/VAPID Debug):', debugInfo);
    }
  }, [debugInfo]);

  // No auto-prompting for notifications on load
  return null;
}
