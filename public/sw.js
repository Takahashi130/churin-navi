// 最小限の Service Worker（ホーム画面追加用）。
// 検索 API・Google の地図や写真はキャッシュしない（規約上・鮮度の両面から）。
const CACHE = "churin-shell-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (req.mode === "navigate") {
    // ネット優先。圏外時だけ前回の画面を出す
    e.respondWith(fetch(req).catch(() => caches.match("/")));
  }
});
