// J.A.R.V.I.S. Mark I — Service Worker & Push Notification Substrate
const CACHE_NAME = 'jarvis-pwa-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming Web Push notifications from cloud/server
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'J.A.R.V.I.S. Alert', body: event.data.text() };
    }
  }

  const title = data.title || 'J.A.R.V.I.S. Directive Alert';
  const options = {
    body: data.body || 'Operational notification from J.A.R.V.I.S.',
    icon: data.icon || '/icon.png',
    badge: data.badge || '/icon.png',
    vibrate: data.vibrate || [200, 100, 200, 100, 200],
    tag: data.tag || 'jarvis-notification',
    renotify: true,
    data: {
      url: data.url || '/',
      timestamp: Date.now(),
      ...data.data,
    },
    actions: data.actions || [
      { action: 'open', title: 'Open J.A.R.V.I.S.' },
      { action: 'dismiss', title: 'Acknowledge' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click interactions
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Handle internal messages from frontend client (e.g. scheduled or immediate background triggers)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title, {
      icon: '/icon.png',
      badge: '/icon.png',
      vibrate: [200, 100, 200, 100, 200],
      ...options,
    });
  }
});
