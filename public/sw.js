/* ReadReward — Service Worker */

self.addEventListener('push', function(event) {
  var data = { title: 'ReadReward', body: 'You have a new update!', icon: '/icon-192.png', type: 'general', url: '/' };

  if (event.data) {
    try {
      var parsed = event.data.json();
      if (parsed.title) data.title = parsed.title;
      if (parsed.body) data.body = parsed.body;
      if (parsed.icon) data.icon = parsed.icon;
      if (parsed.type) data.type = parsed.type;
      if (parsed.url) data.url = parsed.url;
    } catch (e) {
      try {
        var text = event.data.text();
        if (text) data.body = text;
      } catch (e2) {
        // use defaults
      }
    }
  }

  // Deep link based on notification type
  var targetUrl = '/';
  if (data.type === 'new_log' || data.type === 'new_redemption') {
    targetUrl = '/?view=dashboard';
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: '/icon-192.png',
      vibrate: [100, 50, 100],
      tag: data.type,
      renotify: true,
      data: { url: targetUrl, type: data.type }
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || '/';
  var fullUrl = self.location.origin + url;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Try to find an existing window and navigate it
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf(self.location.origin) !== -1 && 'focus' in client) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate(fullUrl);
          }
          return client;
        }
      }
      // No existing window — open new one
      return clients.openWindow(fullUrl);
    })
  );
});

self.addEventListener('install', function() { self.skipWaiting(); });
self.addEventListener('activate', function(event) { event.waitUntil(clients.claim()); });