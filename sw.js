// 🔥 NENAVIJU PWA SERVICE WORKER
// Версия кэша (увеличивай при обновлении сайта)
const CACHE_VERSION = 'nenaviju-v1.0.0';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const AUDIO_CACHE = `${CACHE_VERSION}-audio`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

// Статические файлы для кэширования при установке
const STATIC_ASSETS = [
    '/nenaviju/',
    '/nenaviju/index.html',
    '/nenaviju/preview.jpg',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&display=swap'
];

// 🔧 УСТАНОВКА SERVICE WORKER
self.addEventListener('install', (event) => {
    console.log('🚀 Service Worker: Установка...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('📦 Кэширование статических файлов...');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting()) // Активировать сразу
    );
});

// 🧹 АКТИВАЦИЯ И ОЧИСТКА СТАРЫХ КЭШЕЙ
self.addEventListener('activate', (event) => {
    console.log('✅ Service Worker: Активация...');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Удаляем старые версии кэша
                    if (cacheName.startsWith('nenaviju-') && 
                        cacheName !== STATIC_CACHE && 
                        cacheName !== AUDIO_CACHE && 
                        cacheName !== IMAGE_CACHE) {
                        console.log('🗑️ Удаление старого кэша:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Захватить контроль над страницами
    );
});

// 🎯 ОБРАБОТКА ЗАПРОСОВ
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // ❌ НЕ КЭШИРУЕМ Firebase Firestore (всегда идём в сеть)
    if (url.hostname.includes('firestore.googleapis.com') || 
        url.hostname.includes('firebase') ||
        url.hostname.includes('googleapis.com')) {
        return; // Пропускаем кэширование для Firebase
    }

    // 🎵 СТРАТЕГИЯ ДЛЯ АУДИО: Cache First (кэш → сеть)
    if (request.url.endsWith('.mp3')) {
        event.respondWith(
            caches.open(AUDIO_CACHE).then(cache => {
                return cache.match(request).then(cachedResponse => {
                    if (cachedResponse) {
                        console.log('🎵 Аудио из кэша:', request.url);
                        return cachedResponse;
                    }

                    // Если нет в кэше — загружаем и кэшируем
                    return fetch(request).then(networkResponse => {
                        console.log('📥 Кэширование аудио:', request.url);
                        cache.put(request, networkResponse.clone());
                        return networkResponse;
                    }).catch(() => {
                        console.warn('⚠️ Аудио недоступно оффлайн:', request.url);
                    });
                });
            })
        );
        return;
    }

    // 🖼️ СТРАТЕГИЯ ДЛЯ ИЗОБРАЖЕНИЙ: Cache First
    if (request.url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
        event.respondWith(
            caches.open(IMAGE_CACHE).then(cache => {
                return cache.match(request).then(cachedResponse => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }

                    return fetch(request).then(networkResponse => {
                        cache.put(request, networkResponse.clone());
                        return networkResponse;
                    }).catch(() => {
                        console.warn('⚠️ Изображение недоступно оффлайн:', request.url);
                    });
                });
            })
        );
        return;
    }

    // 📄 СТРАТЕГИЯ ДЛЯ СТАТИЧЕСКИХ ФАЙЛОВ: Cache First
    event.respondWith(
        caches.match(request).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(request).then(networkResponse => {
                // Кэшируем только успешные GET-запросы
                if (request.method === 'GET' && networkResponse.status === 200) {
                    return caches.open(STATIC_CACHE).then(cache => {
                        cache.put(request, networkResponse.clone());
                        return networkResponse;
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Если оффлайн и нет в кэше — показываем базовую страницу
                if (request.destination === 'document') {
                    return caches.match('/nenaviju/index.html') || caches.match('/index.html');
                }
            });
        })
    );
});

// 🔔 ОБРАБОТКА СООБЩЕНИЙ ОТ КЛИЕНТА
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});