const CACHE_VERSION = "0.6.1-20260930.4";
const SHELL_CACHE = "healthtracker-shell-" + CACHE_VERSION;
const RUNTIME_CACHE = "healthtracker-runtime-" + CACHE_VERSION;

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/app.css",
  "./css/variables.css",
  "./css/base.css",
  "./css/components.css",
  "./css/trends.css",
  "./css/history.css",
  "./css/data-safety.css",
  "./js/app.js",
  "./js/config/forms.js",
  "./js/config/version.js",
  "./js/analytics/summary.js",
  "./js/db/database.js",
  "./js/data/export.js",
  "./js/data/backup.js",
  "./js/data/csv.js",
  "./js/pwa/update.js",
  "./js/ui/forms.js",
  "./js/ui/history.js",
  "./js/ui/dashboard.js",
  "./js/ui/data-safety.js",
  "./js/ui/status.js",
  "./js/ui/toast.js"
];

async function fetchFresh(request) {
  return fetch(new Request(request, { cache: "no-store" }));
}

async function precacheShell() {
  const cache = await caches.open(SHELL_CACHE);

  await Promise.all(
    APP_SHELL.map(async url => {
      const response = await fetch(new Request(url, { cache: "reload" }));
      if (!response.ok) {
        throw new Error("Could not precache " + url);
      }
      await cache.put(url, response);
    })
  );
}

async function networkFirst(request, fallbackUrl = null) {
  try {
    const response = await fetchFresh(request);

    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    const runtimeMatch = await caches.match(request);
    if (runtimeMatch) return runtimeMatch;

    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) return fallback;
    }

    throw error;
  }
}

self.addEventListener("install", event => {
  event.waitUntil(precacheShell());
});

self.addEventListener("activate", event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(key =>
              key.startsWith("healthtracker-") &&
              key !== SHELL_CACHE &&
              key !== RUNTIME_CACHE
            )
            .map(key => caches.delete(key))
        )
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "./index.html"));
    return;
  }

  const isAppAsset =
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "manifest" ||
    APP_SHELL.some(path => new URL(path, self.registration.scope).href === request.url);

  if (isAppAsset) {
    event.respondWith(networkFirst(request));
  }
});
