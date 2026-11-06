/**
 * ==========================================================================
 * مشغّل الخدمة لتطبيق الهاتف والعمل بدون إنترنت (PWA Service Worker)
 * ==========================================================================
 */

const CACHE_NAME = 'svg-vector-designer-v2';

const CORE_ASSETS = [
  './',
  './index.html',
  './SVG.HTML',
  './manifest.json',
  './css/style.css',
  './js/constants.js',
  './js/state.js',
  './js/dom.js',
  './js/shapes.js',
  './js/fonts.js',
  './js/canvas.js',
  './js/interaction.js',
  './js/export.js',
  './js/orders.js',
  './js/pwa.js',
  './js/app.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32x32.png'
];

// تثبيت التطبيق وتخزين الملفات الأساسية في ذاكرة الهاتف
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// تفعيل النسخة المحدثة وتنظيف النسخ القديمة
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// جلب الملفات (الأولوية للشبكة مع العودة للذاكرة المحلية عند انقطاع الإنترنت، وتخزين الخطوط)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // تخزين خطوط Google Fonts للعمل بدون إنترنت بعد أول فتح
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          const networkFetch = fetch(event.request)
            .then((res) => {
              if (res && res.status === 200) {
                cache.put(event.request, res.clone());
              }
              return res;
            })
            .catch(() => cached);
          return cached || networkFetch;
        })
      )
    );
    return;
  }

  // ملفات التطبيق المحلية: تحديث من الشبكة إن توفرت أو القراءة الفورية من الذاكرة
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => cached || caches.match('./index.html'))
        )
    );
  }
});

