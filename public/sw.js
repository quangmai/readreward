/* ReadReward — Service Worker (PWA + Push) */

var CACHE_NAME = 'readreward-v2';

/* ── Install: instant — no blocking cache ── */
self.addEventListener('install', function() {
  self.skipWaiting();
});

/* ── Activate: claim clients immediately, clean old caches ── */
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
             .map(function(n) { return caches.delete(n); })
      );
    }).then(function() {
      return clients.claim();
    })
  );
});

/* ── Fetch: stale-while-revalidate for speed ── */
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // Skip non-GET, cross-origin, and Supabase API calls
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Navigation: network first, cache fallback (for offline)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(function(response) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(c) { c.put(event.request, clone); });
        return response;
      }).catch(function() {
        return caches.match('/');
      })
    );
    return;
  }

  // Static assets: stale-while-revalidate
  // Serve from cache immediately, fetch update in background
  if (url.pathname.match(/\.(js|css|png|jpg|svg|ico|woff2?)$/)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(event.request).then(function(cached) {
          var fetched = fetch(event.request).then(function(response) {
            cache.put(event.request, response.clone());
            return response;
          }).catch(function() { return cached; });
          return cached || fetched;
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
      } catch (e2) {}
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

/* ── Notification click ── */
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