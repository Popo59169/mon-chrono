const CACHE_NAME = "mon-chrono-v2"; // On change v1 en v2 pour forcer l'actualisation
const ASSETS = [
  "./",
  "./index.html",
  "https://cdn.tailwindcss.com"
];

// Installation : on force la mise à jour immédiate
self.addEventListener("install", (event) => {
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Nettoyage des anciens caches (v1) pour libérer de la place
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

// Récupération : on tente le réseau d'abord, sinon le cache
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
