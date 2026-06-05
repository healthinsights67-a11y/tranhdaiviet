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

        let registration;
        if ('serviceWorker' in navigator) {
          registration = await navigator.serviceWorker.ready;
        }
        const token = await getToken(messaging, { 
          vapidKey,
          serviceWorkerRegistration: registration
        });
        
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

    const authUnsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        if (permission === 'default' && typeof window !== 'undefined' && 'Notification' in window) {
          try {
            const newPermission = await Notification.requestPermission();
            setPermission(newPermission);
            if (newPermission === 'granted') {
              requestAndSaveToken();
            }
          } catch (err) {
            console.error('Error requesting notification permission on auth change:', err);
          }
        } else if (permission === 'granted') {
          requestAndSaveToken();
        }
      }
    });

    const onMessageUnsubscribe = onMessage(messaging, (payload) => {
      console.log('Message received. ', payload);
      
      // 1. Show inside-app toast
      toast(payload.notification?.title || 'Thông báo mới', {
        description: payload.notification?.body,
      });

      // 2. Also show native system notification so it pops up outside/on top of the screen
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && payload.notification) {
        const title = payload.notification.title || 'Thông báo mới';
        const options = {
          body: payload.notification.body,
          icon: '/pwa-192x192.svg',
          data: payload.data
        };

        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification(title, options);
          }).catch(() => {
            new Notification(title, options);
          });
        } else {
          new Notification(title, options);
        }
      }
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
