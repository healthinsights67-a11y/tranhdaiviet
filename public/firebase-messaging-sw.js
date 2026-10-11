importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

// These values will be injected or you can hardcode them if they are public
// For the purpose of this template, they should match your firebase-applet-config.json
// Note: In a real build step, you might want to automate this.
firebase.initializeApp({
  apiKey: "AIzaSyCj1RgCc1jYf9EkUTsCx_i_wDhnP8lekP4",
  authDomain: "tranh-dai-viet.firebaseapp.com",
  projectId: "tranh-dai-viet",
  storageBucket: "tranh-dai-viet.firebasestorage.app",
  messagingSenderId: "1023501475852",
  appId: "1:1023501475852:web:99cb8ea6ec484779c98e29"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification?.title || payload.data?.title || 'Thông báo mới';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || '',
    icon: '/pwa-192x192.svg',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const taskId = event.notification.data?.taskId;
  const urlToOpen = taskId ? `/?taskId=${taskId}` : '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
