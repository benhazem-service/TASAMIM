/**
 * ==========================================================================
 * مشغّل الخدمة لتطبيق الهاتف والعمل بدون إنترنت (PWA Service Worker)
 * متوافق بالكامل مع GitHub Pages والمجلدات الفرعية
 * ==========================================================================
 */

const CACHE_NAME = 'svg-vector-designer-v4';

// استخدام مسارات نسبية بدون سلاش في البداية لتعمل داخل أي مجلد فرعي على GitHub Pages
const CORE_ASSETS = [
  'index.html',
  'manifest.json',
  'css/style.css',
  'fonts/CampanaScript.otf',
  'fonts/ArialRoundedBold.ttf',
  'fonts/CalistoMT.ttf',
  'fonts/Cameliya.otf',
  'fonts/AL-Battar.ttf',
  'fonts/AkhbarMT.ttf',
  'fonts/arabswell_1.ttf',
  'js/constants.js',
  'js/state.js',
  'js/dom.js',
  'js/shapes.js',
  'js/fonts.js',
  'js/canvas.js',
  'js/interaction.js',
  'js/export.js',
  'js/orders.js',
  'js/pwa.js',
  'js/app.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32x32.png'
];

// تثبيت التطبيق وتخزين الملفات الأساسية بأمان
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // نستخدم التخزين الفردي حتى إذا فشل ملف فرعي لا يتوقف باقي التخزين
      return Promise.allSettled(
        CORE_ASSETS.map((asset) =>
          cache.add(new Request(asset, { cache: 'reload' })).catch((err) => {
            console.warn('Could not cache asset during install:', asset, err);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

// تفعيل النسخة المحدثة وتنظيف الكاش القديم فوراً
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

// استراتيجية جلب الملفات: Network-First للملفات مع الرجوع للكاش، وتخزين خطوط جوجل
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // تخزين خطوط Google Fonts في الكاش للعمل دون اتصال
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          const fetchPromise = fetch(event.request)
            .then((networkRes) => {
              if (networkRes && networkRes.status === 200) {
                cache.put(event.request, networkRes.clone());
              }
              return networkRes;
            })
            .catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // ملفات التطبيق من نفس الدومين
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const copy = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkRes;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            // إذا كان طلباً للتنقل أو الصفحة الرئيسية
            if (event.request.mode === 'navigate') {
              return caches.match('index.html');
            }
          });
        })
    );
  }
});
