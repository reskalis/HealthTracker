const CACHE_VERSION = "0.9.1-20260930.23";
const SHELL_CACHE = "healthtracker-shell-" + CACHE_VERSION;
const RUNTIME_CACHE = "healthtracker-runtime-" + CACHE_VERSION;

const APP_SHELL = [
  "./",
  "./index.html",
  "./install.html",
  "./manifest.webmanifest",
  "./icons/healthtracker.svg",
  "./icons/install-qr.svg",
  "./css/app.css",
  "./css/install.css",
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
  "./js/ui/toast.js",
  "./js/ui/install.js",
  "./js/ui/voice.js",
  "./js/voice/feature.js",
  "./js/voice/parser.js",
  "./js/voice/recorder.js",
  "./js/voice/whisper.js",
  "./js/voice/whisper-upstream.js",
  "./js/voice/whisper-worker.js",
  "./vendor/whisper-upstream/main.js"
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

function withCrossOriginIsolation(response) {
  if (!response || response.type === "opaque") return response;

  const headers = new Headers(response.headers);
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Embedder-Policy", "require-corp");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
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
    event.respondWith(
      networkFirst(request, "./index.html").then(withCrossOriginIsolation)
    );
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
