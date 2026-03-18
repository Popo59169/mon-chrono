const CACHE_NAME = "mon-chrono-v1";
const ASSETS = [
  "./",
  "./index.html",
  "https://cdn.tailwindcss.com"
];

// Installation : on met en cache l'essentiel
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Récupération : on sert le cache si on est hors-ligne (dans le camion sans 5G)
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
