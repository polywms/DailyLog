// UBAH NAMA INI SETIAP KALI ADA UPDATE FITUR BARU!
const CACHE_NAME = 'artemis-log-v7'; 

const urlsToCache = [
    './',
    './index.html',
    './app.js',
    './manifest.json',
    './icon.png',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// 1. Proses Install
self.addEventListener('install', event => {
    // BARIS SAKTI 1: Paksa Service Worker baru untuk langsung menendang yang lama
    self.skipWaiting(); 
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache);
            })
    );
});

// 2. Proses Aktivasi & Bersih-bersih
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Jika ada cache dengan nama versi lama, HAPUS!
                    if (cacheName !== CACHE_NAME) {
                        console.log('Menghapus cache versi lama:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // BARIS SAKTI 2: Paksa halaman yang sedang terbuka untuk langsung pakai versi terbaru
    self.clients.claim(); 
});

// 3. Proses Ambil Data (Fetch)
self.addEventListener('fetch', event => {
    if (event.request.url.includes('script.google.com')) {
        return;
    }
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                return response || fetch(event.request);
            })
    );
});
