/* ReadReward — Service Worker (PWA + Push) */

var CACHE_NAME = 'readreward-v1';
var SHELL_URLS = [
  '/',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json'
];

/* ── Install: cache app shell ── */
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(SHELL_URLS);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

/* ── Activate: clean old caches ── */
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(name) { return name !== CACHE_NAME; })
             .map(function(name) { return caches.delete(name); })
      );
    }).then(function() {
      return clients.claim();
    })
  );
});

/* ── Fetch: network-first for API, cache-first for shell ── */
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // Skip non-GET and cross-origin API calls
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // For navigation requests (HTML pages), try network first, fallback to cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(function(response) {
        // Cache the latest version
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
        return response;
      }).catch(function() {
        return caches.match('/') || caches.match(event.request);
      })
    );
    return;
  }

  // For static assets (JS, CSS, images), try cache first, then network
  if (url.pathname.match(/\.(js|css|png|jpg|svg|ico|woff2?)$/)) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        return fetch(event.request).then(function(response) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
          return response;
        });
      })
    );
    return;
  }
});

/* ── Push notifications ── */
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

/* ── Notification click → deep link ── */
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || '/';
  var fullUrl = self.location.origin + url;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf(self.location.origin) !== -1 && 'focus' in client) {
          client.focus();
          if ('navigate' in client) return client.navigate(fullUrl);
          return client;
        }
      }
      return clients.openWindow(fullUrl);
    })
  );
});