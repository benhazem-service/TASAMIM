/**
 * ==========================================================================
 * إدارة الأشكال والزخارف (Shapes Management)
 * ==========================================================================
 */

window.SVGApp = window.SVGApp || {};

SVGApp.shapes = {
  /**
   * اختيار شكل نشط وتحديث الواجهة
   */
  selectShape(key, btn) {
    SVGApp.state.activeShapeKey = key;

    document.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
    if (btn) {
      btn.classList.add('active');
    }

    SVGApp.canvas.renderDesign();
  },

  /**
   * الحصول على مسار SVG الخاص بالشكل
   */
  getShapeContent(key) {
    return SVGApp.BUILT_IN_SHAPES[key] || SVGApp.state.customShapes[key] || '';
  },

  /**
   * معالجة رفع ملف SVG مخصص من جهاز المستخدم
   */
  handleFileUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const doc = new DOMParser().parseFromString(ev.target.result, 'image/svg+xml');
        const svgEl = doc.querySelector('svg');
        if (svgEl) {
          const content = svgEl.innerHTML;
          const id = 'custom_' + Date.now();
          SVGApp.state.customShapes[id] = content;

          const btn = document.createElement('button');
          btn.className = 'shape-btn';
          btn.dataset.shape = id;
          btn.title = file.name;
          btn.innerHTML = '<svg viewBox="0 0 100 100">' + content + '</svg>';

          SVGApp.dom.shapesGrid.appendChild(btn);
          this.selectShape(id, btn);
        } else {
          alert('تعذر قراءة ملف SVG. تأكد من صحة الملف.');
        }
      } catch (err) {
        alert('حدث خطأ أثناء قراءة ملف SVG.');
      }
    };
    reader.readAsText(file);
  },

  /**
   * ربط أحداث الأشكال
   */
  bindEvents() {
    // رفع ملف مخصص
    SVGApp.dom.svgFileInput.addEventListener('change', (e) => this.handleFileUpload(e));

    // اختيار شكل من الشبكة
    SVGApp.dom.shapesGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.shape-btn');
      if (btn) {
        this.selectShape(btn.dataset.shape, btn);
      }
    });
  }
};

