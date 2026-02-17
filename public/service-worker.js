const CACHE_NAME = "panel-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/login.html",
  "/offline.html",
  "/assets/js/utils.js",
  "/assets/js/auth.js",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png",
  "/assets/icons/maskable-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("Cache opened");
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn("Some assets could not be cached:", err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log("Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.method !== "GET") {
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstStrategy(request));
  } else if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|webp|woff|woff2)$/i) ||
    url.pathname.startsWith("/assets/")
  ) {
    event.respondWith(cacheFirstStrategy(request));
  } else if (
    url.pathname.endsWith(".html") ||
    url.pathname === "/"
  ) {
    event.respondWith(networkFirstStrategy(request));
  }
});

async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    if (request.destination === "document") {
      return caches.match("/offline.html");
    }
    return new Response("Recurso no disponible", { status: 503 });
  }
}

async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return new Response("Recurso no disponible", { status: 503 });
  }
}

self.addEventListener("push", event => {
  const options = {
    body: event.data?.text() || "Tienes una nueva actualización",
    icon: "/assets/icons/icon-192.png",
    badge: "/assets/icons/icon-192.png",
    vibrate: [200, 100, 200],
    tag: "notification",
    requireInteraction: false
  };
  event.waitUntil(
    self.registration.showNotification("Panel Administrativo", options)
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then(clientList => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow("/");
    })
  );
});
