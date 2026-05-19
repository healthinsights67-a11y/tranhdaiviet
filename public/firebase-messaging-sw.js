importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

// These values will be injected or you can hardcode them if they are public
// For the purpose of this template, they should match your firebase-applet-config.json
// Note: In a real build step, you might want to automate this.
firebase.initializeApp({
  apiKey: "AIzaSyDRUKwJvcYraU7vAExrHRzPhZejiTnk31U",
  authDomain: "gen-lang-client-0686745109.firebaseapp.com",
  projectId: "gen-lang-client-0686745109",
  storageBucket: "gen-lang-client-0686745109.firebasestorage.app",
  messagingSenderId: "841174856506",
  appId: "1:841174856506:web:02a50dd9e66eda57f81603"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/vite.svg', // Update icon path as needed
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
