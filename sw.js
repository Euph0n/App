const CACHE_NAME = "taskflow-cache-v2";
const ASSETS = ["./", "./index.html", "./styles.css", "./app.js", "./manifest.webmanifest", "./icon.svg"];
const NETWORK_FIRST_DESTINATIONS = new Set(["script", "style", "worker", "document"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

async function putInCache(request, response) {
  if (!response || !response.ok) {
    return response;
  }

  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
  return response;
}

async function networkFirst(request, fallbackRequest) {
  try {
    const networkResponse = await fetch(request);
    return putInCache(request, networkResponse);
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    if (fallbackRequest) {
      return caches.match(fallbackRequest);
    }
    throw new Error("No cached response available");
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  const networkResponse = await fetch(request);
  return putInCache(request, networkResponse);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "./index.html"));
    return;
  }

  if (NETWORK_FIRST_DESTINATIONS.has(request.destination)) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});
