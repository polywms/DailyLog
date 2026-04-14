// UBAH NAMA INI SETIAP KALI ADA UPDATE FITUR BARU!
const CACHE_NAME = 'artemis-log-v9'; 

const urlsToCache = [
    './',
    './index.html',
    './app.js',
    './manifest.json',
    './icon.png',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// 1. Proses Install: Menyimpan aset awal ke cache
self.addEventListener('install', event => {
    self.skipWaiting(); // Paksa SW baru langsung aktif
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(urlsToCache);
        })
    );
});

// 2. Proses Aktivasi: Membersihkan cache lama
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Menghapus cache lama:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim(); // Ambil kendali halaman segera
});

// 3. Proses Ambil Data: Strategi NETWORK-FIRST
self.addEventListener('fetch', event => {
    // Jangan cache request ke Google Script (API)
    if (event.request.url.includes('script.google.com')) return;

    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Jika sukses ambil dari internet, perbarui cache dengan file terbaru ini
                if (response && response.status === 200) {
                    let responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Jika internet mati (OFFLINE), ambil dari Cache
                return caches.match(event.request);
            })
    );
});
