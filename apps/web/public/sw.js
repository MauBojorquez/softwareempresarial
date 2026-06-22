// StratiuMetrics service worker — offline support + asset caching + web push.
const CACHE = "metrixpro-v3";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/manifest.json", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache API calls or auth — always go to network.
  if (url.pathname.startsWith("/api/")) return;

  // Navigations: network-first, fall back to the offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Next.js build assets (/_next/) change hash on every deploy. Serving a
  // stale cached chunk after a new deploy causes ChunkLoadError → the page
  // reloads itself repeatedly (the "loop"). Use NETWORK-FIRST for these so
  // the user always gets chunks matching the freshly-served HTML; fall back
  // to cache only when offline.
  if (url.pathname.startsWith("/_next/")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Other static assets (images, fonts, root-level css/js): cache-first.
  if (/\.(?:js|css|woff2?|png|jpg|jpeg|svg|gif|webp|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        });
      })
    );
  }
});

// ── Web Push ──────────────────────────────────────────────────────
// A push message arrives (even when the app is fully closed). Show a
// system notification on the device.
self.addEventListener("push", (event) => {
  let payload = { title: "StratiuMetrics", body: "Tienes una nueva notificación." };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }

  const options = {
    body: payload.body,
    icon: "/brand-icon.png",
    badge: "/brand-icon.png",
    tag: payload.tag || "stratiumetrics",
    data: { url: payload.url || "/dashboard/overview" },
    vibrate: [120, 60, 120],
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

// Tapping a notification focuses an open tab (or opens a new one) at the URL.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/dashboard/overview";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
