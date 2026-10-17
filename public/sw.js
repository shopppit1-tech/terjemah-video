const CACHE = 'videoteks-shell-v19';
const BASE_URL = new URL('./', self.location.href);
const HOME_URL = new URL('index.html', BASE_URL).href;
const SHELL_FILES = [
  '',
  'index.html',
  'login.js',
  'pwa-install.js',
  'firebase-client.js',
  'page-navigation.js',
  'download-utils.js',
  'images/hero-studio-phone.webp',
  'app.html',
  'app.js',
  'audio.html',
  'audio.js',
  'voice.html',
  'voice.js',
  'history.html',
  'history.js',
  'auth-shell.css',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png'
].map((path) => new URL(path, BASE_URL).href);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith(fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then((cached) => cached || caches.match(HOME_URL))));
});
