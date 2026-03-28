/**
 * FinWise Service Worker
 * Strategy:
 *   - HTML (навигация): network-first — чтобы бандл всегда был актуальным
 *   - Статика (файлы с хешами в URL): cache-first
 *   - API: всегда нетворк, не кешируется
 *   - Обновление: при активации нового SW шлёт сообщение всем вкладкам — они авто-релоадятся
 */

// Меняйте версию при каждом деплое (Vite подставывает хеш автоматически)
const CACHE_VERSION = "finwise-v3";
const STATIC_ASSETS = ["/manifest.json"];

// ── Install ────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.addAll(STATIC_ASSETS).catch((err) =>
        console.warn("[SW] Cache partial fail:", err)
      )
    )
  );
  // Сразу становимся активным, не ждём закрытия вкладок
  self.skipWaiting();
});

// ── Activate: чистим старые кеши + шлём обновление ─────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
      .then(() => {
        // Сообщаем всем открытым вкладкам: "перезагрузитесь"
        return self.clients
          .matchAll({ type: "window", includeUncontrolled: true })
          .then((clients) => {
            clients.forEach((client) => client.postMessage({ type: "SW_UPDATED" }));
          });
      })
  );
});

// ── Fetch ──────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API — всегда network, нет кеша
  if (request.method !== "GET" || url.pathname.startsWith("/api/")) return;

  // WebSocket — пропускаем
  if (url.pathname.includes("socket")) return;

  // Навигация (HTML) — NETWORK-FIRST
  // При перезапуске сервера всегда получаем свежий index.html
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Статические файлы с хешами в URL (бандл) — CACHE-FIRST
  const hasHash = url.pathname.match(/\.[0-9a-f]{8,}\./); // Vite хеши
  if (hasHash) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Всё остальное — network
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});

// ── Push ───────────────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title ?? "FinWise";
  const options = {
    body: data.body ?? "Новое уведомление",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag ?? "finwise-notification",
    data: { url: data.url ?? "/" },
    actions: [
      { action: "open", title: "Открыть" },
      { action: "dismiss", title: "Закрыть" },
    ],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click ─────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;
  const targetUrl = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        return clients.openWindow(targetUrl);
      })
  );
});
