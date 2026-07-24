// JobApp Service Worker — shell cache v1
const CACHE = "jobapp-shell-v1";

// Pre-cache only the manifest (app shell bootstrap)
const PRECACHE = ["/manifest.json"];

// Next.js static assets are content-hashed → safe to cache forever
function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".woff") ||
    url.pathname === "/manifest.json"
  );
}

// ── Install ──────────────────────────────────────────────────────
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── Activate — purge old caches ──────────────────────────────────
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch strategy ───────────────────────────────────────────────
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Only intercept same-origin GET requests
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;

  // Never intercept auth or API routes
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/login")
  )
    return;

  if (isStaticAsset(url)) {
    // Cache-first: immutable Next.js chunks / fonts load instantly
    e.respondWith(
      caches.match(e.request).then((hit) => {
        if (hit) return hit;
        return fetch(e.request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        });
      })
    );
  } else {
    // Network-first for HTML pages: always show fresh content; fall back to cache offline
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(e.request).then((cached) => cached ?? caches.match("/"))
        )
    );
  }
});

// ── Push notifications (opt-in, §7.3) ──────────────────────────────
// Tom sereno: sem emoji de alarme, sem badge de contagem — um lembrete,
// não um puxão. O payload já vem pronto (título + corpo) do servidor.
self.addEventListener("push", (e) => {
  if (!e.data) return;
  const payload = e.data.json();
  e.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/pwa-icon?size=192",
      badge: "/pwa-icon?size=192",
      tag: payload.tag ?? "jobapp-lembrete",
      data: { url: payload.url ?? "/" },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url ?? "/";
  e.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => "focus" in c);
        if (existing) return existing.focus();
        return self.clients.openWindow(url);
      })
  );
});
