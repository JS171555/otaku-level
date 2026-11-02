const CACHE_NAME = 'otaku-level-shell-v6';
const APP_SHELL = [
  'index.html',
  'reset.html',
  'dashboard.html',
  'buscar.html',
  'biblioteca.html',
  'anime.html',
  'conquistas.html',
  'ranking.html',
  'perfil.html',
  'notificacoes.html',
  'app.html',
  'manifest.webmanifest',
  'css/styles.css',
  'css/app.css',
  'js/auth.js',
  'js/cards.js',
  'js/challenges.js',
  'js/config.js',
  'js/gamification.js',
  'js/image.js',
  'js/kitsu.js',
  'js/library.js',
  'js/nav.js',
  'js/notifications.js',
  'js/pages/anime.js',
  'js/pages/app.js',
  'js/pages/biblioteca.js',
  'js/pages/buscar.js',
  'js/pages/conquistas.js',
  'js/pages/dashboard.js',
  'js/pages/index.js',
  'js/pages/notificacoes.js',
  'js/pages/perfil.js',
  'js/pages/ranking.js',
  'js/pages/reset.js',
  'js/profile.js',
  'js/pwa.js',
  'js/supabase.js',
  'js/ui.js',
  'assets/favicon-32.png',
  'assets/otaku-level-logo-transparent.png',
  'assets/google-logo.png',
  'assets/apple-touch-icon.png',
  'assets/pwa-icon-192.png',
  'assets/pwa-icon-512.png',
  'assets/pwa-icon-maskable-512.png',
  'assets/pwa-icon-maskable-512-v2.png',
];
const root = new URL('./', self.registration.scope);
const isSuccessfulSameOrigin = (response, requestUrl) =>
  response && response.ok && new URL(requestUrl).origin === self.location.origin;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL.map((path) => new URL(path, root).href)))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith('otaku-level-shell-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok && !url.search) {
          const copy = response.clone();
          return caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).then(() => response);
        }
        return response;
      }).catch(async () => {
        const cached = await caches.match(request, { ignoreSearch: true });
        return cached || caches.match(new URL('index.html', root).href);
      }),
    );
    return;
  }

  if (!['style', 'script', 'image', 'font'].includes(request.destination)) return;
  event.respondWith(
    fetch(request).then(async (response) => {
      if (isSuccessfulSameOrigin(response, request.url)) {
        await (await caches.open(CACHE_NAME)).put(request, response.clone());
      }
      return response;
    }).catch(async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      throw new Error('Recurso indisponível offline.');
    }),
  );
});
