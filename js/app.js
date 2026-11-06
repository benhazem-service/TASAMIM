/**
 * ==========================================================================
 * نقطة انطلاق التطبيق وربط الأحداث (Application Bootstrap & Event Wiring)
 * ==========================================================================
 */

window.SVGApp = window.SVGApp || {};

SVGApp.init = function() {
  // 1. تهيئة عناصر الواجهة
  this.dom.init();

  // 2. تفعيل دعم PWA وتثبيت التطبيق على الهاتف
  if (this.pwa) {
    this.pwa.init();
  }

  // 3. ربط القائمة الجانبية للشاشات الصغيرة
  if (this.dom.menuToggle) {
    this.dom.menuToggle.addEventListener('click', () => {
      this.dom.sidebar.classList.add('open');
      this.dom.overlay.classList.add('active');
    });
  }

  if (this.dom.menuClose) {
    this.dom.menuClose.addEventListener('click', () => {
      this.dom.sidebar.classList.remove('open');
      this.dom.overlay.classList.remove('active');
    });
  }

  if (this.dom.overlay) {
    this.dom.overlay.addEventListener('click', () => {
      this.dom.sidebar.classList.remove('open');
      this.dom.overlay.classList.remove('active');
    });
  }

  // 4. ربط مدخلات النص والخط
  [this.dom.textInput, this.dom.fontSelect].forEach(el => {
    if (!el) return;
    el.addEventListener('input', () => this.canvas.renderDesign());
    el.addEventListener('change', () => this.canvas.renderDesign());
  });

  // 5. ربط مدخلات القياس اليدوي الإجمالي (الكلمة + الشكل = القيمة المدخلة)
  ['input', 'change'].forEach(evtName => {
    this.dom.manualWidthInput.addEventListener(evtName, () => {
      const w = parseFloat(this.dom.manualWidthInput.value);
      if (w > 0) {
        this.state.manualWidth_cm = w;
        this.canvas.applyLayoutAndManualDimensions();
      }
    });

    this.dom.manualHeightInput.addEventListener(evtName, () => {
      const h = parseFloat(this.dom.manualHeightInput.value);
      if (h > 0) {
        this.state.manualHeight_cm = h;
        this.canvas.applyLayoutAndManualDimensions();
      }
    });
  });

  // 6. ربط أدوات تكبير وتصغير الشكل داخل المشروع
  if (this.dom.shapeScaleSlider) {
    ['input', 'change'].forEach(evtName => {
      this.dom.shapeScaleSlider.addEventListener(evtName, () => {
        const val = parseFloat(this.dom.shapeScaleSlider.value);
        if (val > 0) {
          this.canvas.setShapeScale(val / 100, true);
        }
      });
    });
  }

  if (this.dom.btnScaleDown) {
    this.dom.btnScaleDown.addEventListener('click', () => {
      this.canvas.setShapeScale(this.state.shapeScaleRatio - 0.1);
    });
  }

  if (this.dom.btnScaleUp) {
    this.dom.btnScaleUp.addEventListener('click', () => {
      this.canvas.setShapeScale(this.state.shapeScaleRatio + 0.1);
    });
  }

  if (this.dom.btnScaleReset) {
    this.dom.btnScaleReset.addEventListener('click', () => {
      this.canvas.setShapeScale(1.0);
    });
  }

  // 7. ربط إعادة ضبط الترتيب والموضع
  this.dom.btnResetLayout.addEventListener('click', () => this.canvas.resetLayout());
  this.dom.shapePosition.addEventListener('change', () => this.canvas.resetLayout());

  // 8. ربط أزرار التحكم في الرؤية والتكبير (Zoom)
  this.dom.btnFit.addEventListener('click', () => {
    this.state.currentZoomMode = 'fit';
    this.dom.btnFit.classList.add('active');
    this.dom.btn100.classList.remove('active');
    this.canvas.applyLayoutAndManualDimensions();
  });

  this.dom.btn100.addEventListener('click', () => {
    this.state.currentZoomMode = '100';
    this.state.customZoomLevel = 1.0;
    this.dom.btn100.classList.add('active');
    this.dom.btnFit.classList.remove('active');
    this.canvas.applyLayoutAndManualDimensions();
  });

  this.dom.btnZoomIn.addEventListener('click', () => {
    this.state.currentZoomMode = '100';
    this.state.customZoomLevel = Math.min(this.state.customZoomLevel * 1.25, 4.0);
    this.dom.btn100.classList.remove('active');
    this.dom.btnFit.classList.remove('active');
    this.canvas.applyLayoutAndManualDimensions();
  });

  this.dom.btnZoomOut.addEventListener('click', () => {
    this.state.currentZoomMode = '100';
    this.state.customZoomLevel = Math.max(this.state.customZoomLevel * 0.8, 0.25);
    this.dom.btn100.classList.remove('active');
    this.dom.btnFit.classList.remove('active');
    this.canvas.applyLayoutAndManualDimensions();
  });

  window.addEventListener('resize', () => {
    this.canvas.applyLayoutAndManualDimensions();
  });

  // 9. تفعيل الأحداث للوحدات الفرعية
  this.shapes.bindEvents();
  this.fonts.bindEvents();
  this.interaction.bindEvents();
  this.exporter.bindEvents();
  if (this.orders) {
    this.orders.bindEvents();
  }

  // 10. التشغيل والتهيئة المبدئية
  this.canvas.resetLayout();

  // إعادة القياس تلقائياً فور اكتمال تحميل خطوط الويب لضمان دقة الحدود 100%
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      this.canvas._cachedTextKey = null;
      this.canvas.resetLayout();
    });
  }
};

// تشغيل التطبيق بمجرد اكتمال تحميل شجرة العناصر (DOM)
document.addEventListener('DOMContentLoaded', () => {
  SVGApp.init();
});
