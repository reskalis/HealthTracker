const CACHE = "healthtracker-v4";
const ASSETS = ["./","./index.html","./manifest.webmanifest","./css/app.css","./css/variables.css","./css/base.css","./css/components.css","./js/app.js","./js/config/forms.js","./js/db/database.js","./js/data/export.js","./js/data/import.js","./js/ui/forms.js","./js/ui/history.js","./js/ui/toast.js"];
self.addEventListener("install", event => { self.skipWaiting(); event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))); });
self.addEventListener("activate", event => { event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))), self.clients.claim()])); });
self.addEventListener("fetch", event => {
  if (event.request.mode === "navigate") { event.respondWith(fetch(event.request).catch(() => caches.match("./"))); return; }
  event.respondWith(fetch(event.request).then(response => { const copy=response.clone(); caches.open(CACHE).then(cache => cache.put(event.request,copy)); return response; }).catch(() => caches.match(event.request)));
});