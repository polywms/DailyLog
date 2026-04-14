const CACHE_NAME = 'artemis-log-v5';
const urlsToCache = [
    './',
    './index.html',
    './manifest.json',
    './app.js',
    './icon.png',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Install Service Worker dan simpan file ke Cache
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache);
            })
    );
});

// Ambil file dari Cache saat offline
self.addEventListener('fetch', event => {
    // Abaikan request ke Google Apps Script (biarkan fungsi jalankanSync yang urus ini)
    if (event.request.url.includes('script.google.com')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Return cache jika ada, jika tidak lanjut ambil dari internet
                return response || fetch(event.request);
            })
    );
});
