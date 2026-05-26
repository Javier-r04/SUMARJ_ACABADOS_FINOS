// ===========================================================================
// SUMARJ Service Worker
// Estrategia: Network-first para API, Cache-first para assets estáticos
// ===========================================================================

const CACHE_VERSION = 'sumarj-v31';
const APP_SHELL = [
 '/',
 '/login',
 '/app',
 '/static/css/app.css',
 '/static/js/app.js',
 '/static/js/views/dashboard.js',
 '/static/js/views/pos.js',
 '/static/js/views/productos.js',
 '/static/js/views/ventas.js',
 '/static/js/views/compras.js',
 '/static/js/views/cotizaciones.js',
 '/static/js/views/reportes.js',
 '/static/js/views/usuarios.js',
 '/static/js/views/configuracion.js',
 '/static/img/logo.png',
 '/static/img/icon-192.png',
 '/static/img/icon-512.png',
 '/static/manifest.json',
];

// ---------------------------------------------------------------------------
// INSTALL: precachear el "app shell"
// ---------------------------------------------------------------------------
self.addEventListener('install', (event) => {
 event.waitUntil(
 caches.open(CACHE_VERSION).then((cache) => {
 // Cachear lo posible; no fallar si algún recurso no carga
 return Promise.allSettled(
 APP_SHELL.map((url) => cache.add(url).catch(() => null))
 );
 }).then(() => self.skipWaiting())
 );
});

// ---------------------------------------------------------------------------
// ACTIVATE: limpiar versiones anteriores
// ---------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
 event.waitUntil(
 caches.keys().then((keys) =>
 Promise.all(
 keys
 .filter((k) => k !== CACHE_VERSION)
 .map((k) => caches.delete(k))
 )
 ).then(() => self.clients.claim())
 );
});

// ---------------------------------------------------------------------------
// FETCH: estrategia por tipo de recurso
// ---------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
 const req = event.request;
 const url = new URL(req.url);

 // Solo GET (no cacheamos POST/PUT/DELETE)
 if (req.method !== 'GET') return;

 // Solo recursos del mismo origen
 if (url.origin !== self.location.origin) return;

 // API: NETWORK ONLY (siempre datos frescos)
 if (url.pathname.startsWith('/api/')) {
 event.respondWith(
 fetch(req).catch(() =>
 new Response(
 JSON.stringify({
 detail: 'Sin conexión con el servidor. Verifica que estés conectado al WiFi.',
 offline: true,
 }),
 {
 status: 503,
 statusText: 'Sin conexión',
 headers: { 'Content-Type': 'application/json' },
 }
 )
 )
 );
 return;
 }

 // Assets estáticos: CACHE FIRST con actualización en background
 if (url.pathname.startsWith('/static/')) {
 event.respondWith(
 caches.match(req).then((cached) => {
 const fetchPromise = fetch(req).then((response) => {
 if (response && response.status === 200) {
 const clone = response.clone();
 caches.open(CACHE_VERSION).then((cache) => {
 cache.put(req, clone);
 });
 }
 return response;
 }).catch(() => cached);
 return cached || fetchPromise;
 })
 );
 return;
 }

 // HTML (navegación): NETWORK FIRST con fallback a caché
 event.respondWith(
 fetch(req)
 .then((response) => {
 if (response && response.status === 200) {
 const clone = response.clone();
 caches.open(CACHE_VERSION).then((cache) => {
 cache.put(req, clone);
 });
 }
 return response;
 })
 .catch(() => caches.match(req).then((cached) => cached || caches.match('/offline')))
 );
});
