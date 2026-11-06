/**
 * ==========================================================================
 * إدارة تثبيت التطبيق على الهاتف واللوحي (PWA Installation & Service Worker)
 * متوافق مع الاستضافة على GitHub Pages
 * ==========================================================================
 */

window.SVGApp = window.SVGApp || {};

SVGApp.pwa = {
  deferredPrompt: null,

  init() {
    // 1. تسجيل مشغل الخدمة (Service Worker) بمسار نسبي متوافق مع مجلدات GitHub Pages
    if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
          .then((reg) => {
            console.log('PWA ServiceWorker registered successfully:', reg.scope);
          })
          .catch((err) => {
            console.log('ServiceWorker registration error:', err);
          });
      });
    }

    // 2. التقاط حدث التثبيت beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallButtons();
    });

    // 3. الكشف عما إذا كان التطبيق مثبتاً ويعمل كـ Standalone App
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      this.hideInstallButtons();
    }

    // 4. ربط أحداث النقر على أزرار التثبيت
    this.bindEvents();
  },

  showInstallButtons() {
    if (SVGApp.dom.mobileInstallBtn) {
      SVGApp.dom.mobileInstallBtn.style.display = 'inline-flex';
    }
    if (SVGApp.dom.pwaInstallBanner) {
      SVGApp.dom.pwaInstallBanner.style.display = 'flex';
    }
    if (SVGApp.dom.sidebarInstallBtn) {
      SVGApp.dom.sidebarInstallBtn.style.display = 'flex';
    }
  },

  hideInstallButtons() {
    if (SVGApp.dom.mobileInstallBtn) {
      SVGApp.dom.mobileInstallBtn.style.display = 'none';
    }
    if (SVGApp.dom.pwaInstallBanner) {
      SVGApp.dom.pwaInstallBanner.style.display = 'none';
    }
    if (SVGApp.dom.sidebarInstallBtn) {
      SVGApp.dom.sidebarInstallBtn.style.display = 'none';
    }
  },

  async promptInstall() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      const choiceResult = await this.deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the PWA install prompt');
        this.hideInstallButtons();
      }
      this.deferredPrompt = null;
    } else {
      const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
      if (isIos) {
        alert("لتثبيت التطبيق على شاشة هاتفك (iPhone):\n1. اضغط على زر المشاركة ⎋ (أسفل الشاشة).\n2. اختر 'إضافة إلى الشاشة الرئيسية' (Add to Home Screen).");
      } else {
        alert("لتثبيت التطبيق على شاشة هاتفك:\nاضغط على قائمة المتصفح (⋮) أعلى الشاشة ثم اختر 'إضافة إلى الشاشة الرئيسية' أو 'تثبيت التطبيق'.");
      }
    }
  },

  bindEvents() {
    const handleInstallClick = () => this.promptInstall();

    if (SVGApp.dom.mobileInstallBtn) {
      SVGApp.dom.mobileInstallBtn.addEventListener('click', handleInstallClick);
    }
    if (SVGApp.dom.sidebarInstallBtn) {
      SVGApp.dom.sidebarInstallBtn.addEventListener('click', handleInstallClick);
    }
    if (SVGApp.dom.bannerInstallActionBtn) {
      SVGApp.dom.bannerInstallActionBtn.addEventListener('click', handleInstallClick);
    }
    if (SVGApp.dom.bannerDismissBtn) {
      SVGApp.dom.bannerDismissBtn.addEventListener('click', () => {
        if (SVGApp.dom.pwaInstallBanner) {
          SVGApp.dom.pwaInstallBanner.style.display = 'none';
        }
      });
    }

    window.addEventListener('appinstalled', () => {
      console.log('App successfully installed to home screen!');
      this.hideInstallButtons();
      this.deferredPrompt = null;
    });
  }
};
