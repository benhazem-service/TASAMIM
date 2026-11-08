/**
 * ==========================================================================
 * إدارة الأشكال والزخارف المتعددة (Multiple Shapes Management)
 * ==========================================================================
 */

window.SVGApp = window.SVGApp || {};

SVGApp.shapes = {
  /**
   * الحصول على الشكل المحدد حالياً داخل التصميم
   */
  getSelectedShape() {
    const list = SVGApp.state.shapes || [];
    if (list.length === 0) return null;
    let found = list.find(s => s.id === SVGApp.state.selectedShapeId);
    if (!found) {
      found = list[list.length - 1];
      SVGApp.state.selectedShapeId = found.id;
    }
    return found;
  },

  /**
   * مزامنة حالة الشكل المحدد مع المتغيرات العامة وأدوات الواجهة
   */
  syncStateAndUI() {
    const list = SVGApp.state.shapes || [];
    const sel = this.getSelectedShape();

    if (sel) {
      SVGApp.state.activeShapeKey = sel.key;
      SVGApp.state.shapeRelX = sel.relX;
      SVGApp.state.shapeRelY = sel.relY;
      SVGApp.state.shapeScaleRatio = sel.scaleRatio || 1.0;
      SVGApp.state.shapeLocalBox = sel.localBox || { x: -50, y: -50, width: 100, height: 100 };

      const pct = Math.round((sel.scaleRatio || 1.0) * 100);
      if (SVGApp.dom.shapeScaleVal) SVGApp.dom.shapeScaleVal.textContent = pct + '%';
      if (SVGApp.dom.shapeScaleSlider) SVGApp.dom.shapeScaleSlider.value = pct;
    } else {
      SVGApp.state.activeShapeKey = 'none';
    }

    // تحديث تمييز أزرار الأشكال في الشبكة
    document.querySelectorAll('.shape-btn').forEach(b => {
      if (list.length === 0) {
        b.classList.toggle('active', b.dataset.shape === 'none');
      } else {
        b.classList.toggle('active', sel && b.dataset.shape === sel.key);
      }
    });

    // تحديث شريط عدد الأشكال وأزرار التكرار والحذف
    if (SVGApp.dom.shapesCountBadge) {
      if (list.length === 0) {
        SVGApp.dom.shapesCountBadge.textContent = 'بدون أشكال';
      } else if (list.length === 1) {
        SVGApp.dom.shapesCountBadge.textContent = 'شكل واحد (1)';
      } else if (list.length === 2) {
        SVGApp.dom.shapesCountBadge.textContent = 'شكلان (2)';
      } else {
        SVGApp.dom.shapesCountBadge.textContent = list.length + ' أشكال';
      }
    }

    if (SVGApp.dom.btnDeleteShape) {
      SVGApp.dom.btnDeleteShape.disabled = (list.length === 0);
      SVGApp.dom.btnDeleteShape.style.opacity = (list.length === 0) ? '0.45' : '1';
    }
  },

  /**
   * تحديد شكل معين بالمعرف الخاص به (عند النقر عليه في اللوحة)
   */
  selectShapeById(shapeId, shouldRender = true) {
    const list = SVGApp.state.shapes || [];
    const target = list.find(s => s.id === shapeId);
    if (!target) return;

    SVGApp.state.selectedShapeId = target.id;
    this.syncStateAndUI();

    if (shouldRender && SVGApp.canvas) {
      SVGApp.canvas.applyLayoutAndManualDimensions();
    }
  },

  /**
   * حساب موضع ذكي غير متداخل للشكل الجديد أو المكرر
   */
  computeNewShapePosition(scaleRatio = 1.0) {
    const list = SVGApp.state.shapes || [];
    const pos = SVGApp.dom.shapePosition ? SVGApp.dom.shapePosition.value : 'right';
    const tb = (SVGApp.canvas && SVGApp.canvas.getTextBBox)
      ? SVGApp.canvas.getTextBBox()
      : { x: -100, y: -50, width: 200, height: 100 };
    const textX = SVGApp.state.textRelX || 0;
    const textY = SVGApp.state.textRelY || 0;
    const halfShape = 50 * scaleRatio;
    const gap = 30;

    // إذا كان هذا أول شكل في التصميم
    if (list.length === 0) {
      if (pos === 'only') return { x: 0, y: 0 };
      if (pos === 'left') {
        return { x: textX + tb.x - halfShape - gap, y: textY };
      }
      if (pos === 'top') {
        return { x: textX, y: textY + tb.y - halfShape - gap };
      }
      if (pos === 'bottom') {
        return { x: textX, y: textY + tb.y + tb.height + halfShape + gap };
      }
      // افتراضياً يمين النص
      return { x: textX + tb.x + tb.width + halfShape + gap, y: textY };
    }

    // إذا كان هناك شكل واحد فقط، نضع الشكل الثاني في الجهة المقابلة للكلمة لتكوين تصميم متناظر أنيق
    if (list.length === 1 && pos !== 'only') {
      const first = list[0];
      if (pos === 'right' || first.relX > textX) {
        return { x: textX + tb.x - halfShape - gap, y: textY };
      }
      if (pos === 'left' || first.relX < textX) {
        return { x: textX + tb.x + tb.width + halfShape + gap, y: textY };
      }
      if (pos === 'top' || first.relY < textY) {
        return { x: textX, y: textY + tb.y + tb.height + halfShape + gap };
      }
      if (pos === 'bottom' || first.relY > textY) {
        return { x: textX, y: textY + tb.y - halfShape - gap };
      }
    }

    // في حال وجود شكلين أو أكثر، نضع الشكل الجديد بجانب أبعد شكل لتجنب التراكب
    let maxRight = textX + tb.x + tb.width;
    let minLeft = textX + tb.x;
    list.forEach(s => {
      const sb = s.localBox || { x: -50, y: -50, width: 100, height: 100 };
      const rEdge = s.relX + sb.x + sb.width;
      const lEdge = s.relX + sb.x;
      if (rEdge > maxRight) maxRight = rEdge;
      if (lEdge < minLeft) minLeft = lEdge;
    });

    if (list.length % 2 === 0) {
      return { x: maxRight + halfShape + gap, y: textY };
    } else {
      return { x: minLeft - halfShape - gap, y: textY };
    }
  },

  /**
   * إضافة شكل جديد إلى التصميم (أو مسح الأشكال عند اختيار 'none')
   */
  selectShape(key) {
    if (key === 'none') {
      SVGApp.state.shapes = [];
      SVGApp.state.selectedShapeId = null;
      this.syncStateAndUI();
      SVGApp.canvas.renderDesign();
      return;
    }

    // التأكد من تحديث أبعاد الكلمة أولاً لحساب الموضع بدقة
    if (SVGApp.canvas && SVGApp.canvas.updateTextAndShapeElements) {
      SVGApp.canvas.updateTextAndShapeElements();
    }

    const coords = this.computeNewShapePosition(1.0);
    const newId = 'shape_' + (SVGApp.state.nextShapeUid++);
    const newShape = {
      id: newId,
      key: key,
      relX: coords.x,
      relY: coords.y,
      scaleRatio: 1.0,
      localBox: { x: -50, y: -50, width: 100, height: 100 },
      innerTransform: ''
    };

    SVGApp.state.shapes.push(newShape);
    SVGApp.state.selectedShapeId = newId;
    this.syncStateAndUI();
    SVGApp.canvas.renderDesign();
  },

  /**
   * تكرار الشكل المحدد حالياً بنفس حجمه ونوعه
   */
  duplicateSelectedShape() {
    const sel = this.getSelectedShape();
    if (!sel) {
      // إذا لم يكن هناك أي شكل، نضيف الشكل الافتراضي (هلال ونجمة)
      this.selectShape('crescent');
      return;
    }

    if (SVGApp.canvas && SVGApp.canvas.updateTextAndShapeElements) {
      SVGApp.canvas.updateTextAndShapeElements();
    }

    const scale = sel.scaleRatio || 1.0;
    const coords = this.computeNewShapePosition(scale);
    const newId = 'shape_' + (SVGApp.state.nextShapeUid++);

    const copyShape = {
      id: newId,
      key: sel.key,
      relX: coords.x,
      relY: coords.y,
      scaleRatio: scale,
      localBox: sel.localBox ? { ...sel.localBox } : { x: -50, y: -50, width: 100, height: 100 },
      innerTransform: sel.innerTransform || ''
    };

    SVGApp.state.shapes.push(copyShape);
    SVGApp.state.selectedShapeId = newId;
    this.syncStateAndUI();
    SVGApp.canvas.renderDesign();
  },

  /**
   * حذف الشكل المحدد حالياً من التصميم
   */
  deleteSelectedShape() {
    const list = SVGApp.state.shapes || [];
    if (list.length === 0) return;

    const sel = this.getSelectedShape();
    if (sel) {
      SVGApp.state.shapes = list.filter(s => s.id !== sel.id);
    } else {
      SVGApp.state.shapes.pop();
    }

    if (SVGApp.state.shapes.length > 0) {
      SVGApp.state.selectedShapeId = SVGApp.state.shapes[SVGApp.state.shapes.length - 1].id;
    } else {
      SVGApp.state.selectedShapeId = null;
    }

    this.syncStateAndUI();
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
          this.selectShape(id);
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
   * ربط أحداث الأشكال وأزرار التكرار والحذف
   */
  bindEvents() {
    // رفع ملف مخصص
    if (SVGApp.dom.svgFileInput) {
      SVGApp.dom.svgFileInput.addEventListener('change', (e) => this.handleFileUpload(e));
    }

    // النقر على أي شكل في الشبكة يضيفه للتصميم (أو يمسح الأشكال عند النقر على ✕)
    if (SVGApp.dom.shapesGrid) {
      SVGApp.dom.shapesGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('.shape-btn');
        if (btn) {
          this.selectShape(btn.dataset.shape);
        }
      });
    }

    // زر تكرار الشكل المحدد
    if (SVGApp.dom.btnDuplicateShape) {
      SVGApp.dom.btnDuplicateShape.addEventListener('click', () => {
        this.duplicateSelectedShape();
      });
    }

    // زر حذف الشكل المحدد
    if (SVGApp.dom.btnDeleteShape) {
      SVGApp.dom.btnDeleteShape.addEventListener('click', () => {
        this.deleteSelectedShape();
      });
    }

    this.syncStateAndUI();
  }
};
