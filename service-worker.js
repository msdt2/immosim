/**
 * ImmoSim — Service Worker
 *
 * Stratégies :
 *   - HTML (navigation)  : network-first → fallback cache → fallback 404.html
 *   - Assets locaux (css/js/icones) : cache-first → réseau si absent
 *   - CDN (fonts/leaflet/chart.js/jspdf) : stale-while-revalidate
 *   - API (anthropic, ban.gouv, jsonbin) : jamais mises en cache
 *
 * Quand tu modifies tes fichiers, incrémente CACHE_VERSION pour forcer le rafraîchissement.
 */

const CACHE_VERSION = 'immosim-v1.1.0';
const CACHE_STATIC = `${CACHE_VERSION}-static`;
const CACHE_DYNAMIC = `${CACHE_VERSION}-dynamic`;

// Fichiers à pré-cacher dès l'installation : tout ce qu'il faut pour ouvrir l'app hors-ligne
const PRECACHE_URLS = [
  './',
  './index.html',
  './404.html',
  './manifest.webmanifest',
  './assets/css/styles.css',
  './assets/css/annonce.css',
  './assets/js/app.js',
  './assets/js/sw-register.js',
  './assets/js/event-handlers.js',
  './assets/js/modules/storage.js',
  './assets/js/modules/donnees-publiques.js',
  './assets/js/modules/localisation.js',
  './assets/js/modules/annonce-store.js',
  './assets/js/modules/annonce.js',
  './assets/js/modules/localisation-ui.js',
  './assets/icons/favicon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon.png'
];

// Domaines externes à ne JAMAIS mettre en cache (APIs sensibles ou dynamiques)
const NO_CACHE_HOSTS = [
  'api.anthropic.com',
  'api.openai.com',
  'api.jsonbin.io',
  'api-adresse.data.gouv.fr',
  'data.ademe.fr',
  'api.cquest.org',
  'graph.mapillary.com'
];

// Domaines externes en stale-while-revalidate (CDN qui changent rarement)
const STALE_WHILE_REVALIDATE_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdnjs.cloudflare.com',
  'unpkg.com'
];

// =============== INSTALL ===============
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('[SW] Précache partiel :', err))
  );
});

// =============== ACTIVATE ===============
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// =============== FETCH ===============
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ne touche qu'au GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip explicite des APIs sensibles
  if (NO_CACHE_HOSTS.some((host) => url.hostname.includes(host))) {
    return;
  }

  // Navigation HTML : network-first
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirst(request));
    return;
  }

  // CDN externes : stale-while-revalidate
  if (STALE_WHILE_REVALIDATE_HOSTS.some((host) => url.hostname.includes(host))) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Same-origin assets : cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Autre cas : passe au réseau
});

// =============== STRATÉGIES ===============

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_DYNAMIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Dernier recours pour la navigation
    const fallback = await caches.match('./index.html');
    if (fallback) return fallback;
    return caches.match('./404.html');
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_STATIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    return new Response('Asset indisponible hors-ligne', { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_DYNAMIC);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached);
  return cached || fetchPromise;
}

// =============== MESSAGES (pour skipWaiting depuis l'app) ===============
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
