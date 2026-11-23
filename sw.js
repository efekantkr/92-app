// Offline-Cache für die 92 App. Bei jedem Update VERSION hochzählen.
const VERSION = '92app-v1.2.1';
const FILES = ['./', './index.html', './app.js', './styles.css', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
  './icons/logo.png', './icons/logo-mark.png', './icons/splash-1206x2622.png',
  './fonts/rajdhani-latin-500-normal.woff2', './fonts/rajdhani-latin-600-normal.woff2', './fonts/rajdhani-latin-700-normal.woff2',
  './fonts/exo-2-latin-800-italic.woff2', './fonts/exo-2-latin-900-italic.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Code (HTML/JS/CSS): erst Netz (max. 3 Sek.), damit Updates sofort ankommen; offline aus dem Cache.
// Bilder und Schriften: aus dem Cache, im Hintergrund aktualisieren.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const code = e.request.mode === 'navigate' || /\.(js|css|html|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');
  e.respondWith(caches.open(VERSION).then(async c => {
    const net = fetch(e.request, {cache: 'no-cache'}).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => null);
    const hit = () => c.match(e.request, {ignoreSearch: true});
    if (code) {
      const r = await Promise.race([net, new Promise(res => setTimeout(() => res(null), 3000))]);
      return r || (await hit()) || (await net) || c.match('./index.html');
    }
    return (await hit()) || (await net) || c.match('./index.html');
  }));
});
