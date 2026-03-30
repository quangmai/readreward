/* ReadReward — Service Worker */

self.addEventListener('push', function(event) {
  var data = { title: 'ReadReward', body: 'You have a new update!', icon: '/icon-192.png' };

  if (event.data) {
    try {
      var parsed = event.data.json();
      if (parsed.title) data.title = parsed.title;
      if (parsed.body) data.body = parsed.body;
      if (parsed.icon) data.icon = parsed.icon;
    } catch (e) {
      try {
        var text = event.data.text();
        if (text) data.body = text;
      } catch (e2) {
        // use defaults
      }
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: '/icon-192.png',
      vibrate: [100, 50, 100]
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        if ('focus' in clientList[i]) return clientList[i].focus();
      }
      return clients.openWindow('/');
    })
  );
});

self.addEventListener('install', function() { self.skipWaiting(); });
self.addEventListener('activate', function(event) { event.waitUntil(clients.claim()); });