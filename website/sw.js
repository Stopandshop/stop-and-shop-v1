const cacheName = 'stop-shop-v2'; // غيرنا v1 إلى v2
const staticAssets = [
  './',
  './index.html',
  './index.js',
  './logo.jpg' // تأكد من مطابقة الامتداد هنا
];

// 1. التثبيت وتخزين الملفات الأساسية
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(cacheName).then(cache => {
      return cache.addAll(staticAssets);
    })
  );
  self.skipWaiting();
});

// 2. تنظيف الكاش القديم عند التحديث
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== cacheName).map(key => caches.delete(key))
      );
    })
  );
});

// 3. جلب البيانات (استراتيجية ذكية)
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  // إذا كان الطلب موجهاً لـ Firebase، اجلبه من الشبكة مباشرة
  if (url.origin === location.origin) {
    e.respondWith(cacheFirst(req));
  } else {
    e.respondWith(networkFirst(req));
  }
});

async function cacheFirst(req) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(req);
  return cachedResponse || fetch(req);
}

async function networkFirst(req) {
  try {
    return await fetch(req);
  } catch (err) {
    const cache = await caches.open(cacheName);
    return await cache.match(req);
  }
}