// Routy service worker: 앱 파일은 네트워크 우선(최신 유지) + 오프라인 시 캐시,
// 지도 타일·폰트·Leaflet 등 외부 정적 리소스는 캐시 우선. AI/장소검색 API는 캐시하지 않음.
const VERSION = "routy-v5-1";
const APP_SHELL = ["./", "index.html", "styles.css", "layout.css", "icons.js", "ui.js", "app.js", "ai.js", "templates.js", "manifest.json", "icon.svg", "icon-192.png"];

// 지도 라이브러리도 설치 시점에 미리 받아 둠 (첫 실행 직후 오프라인 대비)
const EXTERNAL = [
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(APP_SHELL);
    const ext = await caches.open(VERSION + "-ext");
    await Promise.all(EXTERNAL.map(u =>
      fetch(u, { mode: "cors" }).then(r => r.ok && ext.put(u, r)).catch(() => {})
    ));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.hostname.includes("generativelanguage.googleapis.com") || url.hostname.includes("nominatim.openstreetmap.org")) {
    return; // 항상 네트워크
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("index.html")))
    );
    return;
  }

  // 외부 정적 리소스 (타일, 폰트, unpkg)
  if (/basemaps\.cartocdn\.com|fonts\.(googleapis|gstatic)\.com|unpkg\.com/.test(url.hostname)) {
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok || res.type === "opaque") {
          const copy = res.clone();
          caches.open(VERSION + "-ext").then(c => c.put(req, copy));
        }
        return res;
      }))
    );
  }
});
