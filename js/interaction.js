/**
 * ==========================================================================
 * إدارة تفاعلات السحب والتحريك والتحجيم (Drag & Resize Interactions)
 * ==========================================================================
 */

window.SVGApp = window.SVGApp || {};

SVGApp.interaction = {
  hintTimer: null,

  /**
   * إخفاء تلميح السحب التوضيحي
   */
  hideHint() {
    if (this.hintTimer) clearTimeout(this.hintTimer);
    if (SVGApp.dom.dragHint) {
      SVGApp.dom.dragHint.style.opacity = '0';
    }
  },

  /**
   * بدء تحريك عنصر (نص أو شكل)
   */
  initDrag(target, e) {
    if (SVGApp.state.isDesignLocked) {
      if (SVGApp.dom.dragHint) {
        SVGApp.dom.dragHint.textContent = '🔒 التصميم مقفل حالياً. افتح القفل من الأعلى للسماح بالتحريك اليدوي.';
        SVGApp.dom.dragHint.style.opacity = '1';
        clearTimeout(this.hintTimer);
        this.hintTimer = setTimeout(() => this.hideHint(), 2500);
      }
      return;
    }
    if (SVGApp.state.activeResize) return;

    SVGApp.state.activeDrag = target;
    document.body.classList.add('is-dragging');

    const src = e.touches ? e.touches[0] : e;
    SVGApp.state.dragStartClient = { x: src.clientX, y: src.clientY };

    // حفظ مقياس التحويل الحالي لمرة واحدة عند بدء السحب لمنع الاهتزاز
    let scaleX = 1.0;
    let scaleY = 1.0;
    try {
      const ctm = SVGApp.dom.masterDesignGroup.getScreenCTM();
      if (ctm) {
        scaleX = Math.abs(ctm.a) || 1.0;
        scaleY = Math.abs(ctm.d) || 1.0;
      }
    } catch (err) {}
    SVGApp.state.dragStartScale = { x: scaleX, y: scaleY };

    if (target === 'text') {
      SVGApp.state.dragStartPos = { x: SVGApp.state.textRelX, y: SVGApp.state.textRelY };
    } else {
      SVGApp.state.dragStartPos = { x: SVGApp.state.shapeRelX, y: SVGApp.state.shapeRelY };
    }

    this.hideHint();
  },

  /**
   * بدء تكبير/تصغير الشكل بواسطة مقابض الزوايا الأربع
   */
  initResizeShape(e) {
    if (SVGApp.state.isDesignLocked) {
      if (SVGApp.dom.dragHint) {
        SVGApp.dom.dragHint.textContent = '🔒 التصميم مقفل حالياً. افتح القفل من الأعلى للسماح بالتحريك والتحجيم.';
        SVGApp.dom.dragHint.style.opacity = '1';
        clearTimeout(this.hintTimer);
        this.hintTimer = setTimeout(() => this.hideHint(), 2500);
      }
      return;
    }
    e.stopPropagation();
    e.preventDefault();

    SVGApp.state.activeResize = true;
    document.body.classList.add('is-resizing');

    const src = e.touches ? e.touches[0] : e;
    SVGApp.state.resizeStartClient = { x: src.clientX, y: src.clientY };
    SVGApp.state.resizeStartScale = SVGApp.state.shapeScaleRatio || 1.0;

    // حساب مركز الشكل على الشاشة عند لحظة البدء لضمان تحجيم سلس من جميع الزوايا الأربع
    try {
      const rect = SVGApp.dom.shapeSelectionBox.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const startDist = Math.max(Math.hypot(src.clientX - cx, src.clientY - cy), 15);
      SVGApp.state.resizeStartCenter = { x: cx, y: cy };
      SVGApp.state.resizeStartDist = startDist;
    } catch (err) {
      SVGApp.state.resizeStartCenter = { x: src.clientX - 50, y: src.clientY - 50 };
      SVGApp.state.resizeStartDist = 70;
    }

    this.hideHint();
  },

  /**
   * معالجة حركة المؤشر (الماوس أو اللمس)
   */
  handlePointerMove(e) {
    const src = e.touches ? e.touches[0] : e;

    // 1. حالة تكبير/تصغير الشكل من أي زاوية من الزوايا الأربع
    if (SVGApp.state.activeResize) {
      if (e.touches && e.cancelable) e.preventDefault();

      const center = SVGApp.state.resizeStartCenter;
      const curDist = Math.hypot(src.clientX - center.x, src.clientY - center.y);
      const ratio = curDist / Math.max(SVGApp.state.resizeStartDist, 15);
      const newScale = Math.max(0.15, Math.min(SVGApp.state.resizeStartScale * ratio, 4.0));

      SVGApp.canvas.setShapeScale(newScale);
      return;
    }

    // 2. حالة تحريك الكلمة أو الشكل بحرية
    if (SVGApp.state.activeDrag) {
      if (e.touches && e.cancelable) e.preventDefault();

      const scaleX = (SVGApp.state.dragStartScale && SVGApp.state.dragStartScale.x) || 1.0;
      const scaleY = (SVGApp.state.dragStartScale && SVGApp.state.dragStartScale.y) || 1.0;

      const dx = (src.clientX - SVGApp.state.dragStartClient.x) / scaleX;
      const dy = (src.clientY - SVGApp.state.dragStartClient.y) / scaleY;

      if (SVGApp.state.activeDrag === 'text') {
        SVGApp.state.textRelX = SVGApp.state.dragStartPos.x + dx;
        SVGApp.state.textRelY = SVGApp.state.dragStartPos.y + dy;
      } else if (SVGApp.state.activeDrag === 'shape') {
        SVGApp.state.shapeRelX = SVGApp.state.dragStartPos.x + dx;
        SVGApp.state.shapeRelY = SVGApp.state.dragStartPos.y + dy;
      }

      SVGApp.canvas.applyLayoutAndManualDimensions();
    }
  },

  /**
   * إنهاء عملية السحب أو التحجيم عند رفع الضغط
   */
  handlePointerEnd() {
    if (SVGApp.state.activeDrag) {
      SVGApp.state.activeDrag = null;
      document.body.classList.remove('is-dragging');
      SVGApp.canvas.renderDesign();
    }
    if (SVGApp.state.activeResize) {
      SVGApp.state.activeResize = false;
      document.body.classList.remove('is-resizing');
      SVGApp.canvas.renderDesign();
    }
  },

  /**
   * تبديل حالة القفل (مقفل / مفتوح)
   */
  toggleDesignLock() {
    SVGApp.state.isDesignLocked = !SVGApp.state.isDesignLocked;
    this.updateLockUI();
  },

  updateLockUI() {
    const isLocked = SVGApp.state.isDesignLocked;
    const btn = SVGApp.dom.lockToggleBtn;
    if (btn) {
      if (isLocked) {
        btn.classList.add('locked');
        btn.classList.remove('unlocked');
        btn.innerHTML = '🔒 مقفل';
        btn.title = 'التصميم مقفل لمنع التحريك بالخطأ (اضغط لفتح التحريك اليدوي)';
      } else {
        btn.classList.remove('locked');
        btn.classList.add('unlocked');
        btn.innerHTML = '🔓 مفتوح للتحريك';
        btn.title = 'التصميم مفتوح (يمكنك سحب وتحريك الكلمة والشكل بالماوس أو اللمس)';
      }
    }

    if (SVGApp.dom.dragHint) {
      if (isLocked) {
        SVGApp.dom.dragHint.textContent = '🔒 التصميم مقفل • افتح القفل بالأعلى للتحريك باللمس';
      } else {
        SVGApp.dom.dragHint.textContent = '🔓 مفتوح • المس الكلمة أو الشكل للتحريك بحرية';
      }
      SVGApp.dom.dragHint.style.opacity = '1';
      clearTimeout(this.hintTimer);
      this.hintTimer = setTimeout(() => this.hideHint(), 4000);
    }

    if (SVGApp.dom.masterDesignGroup) {
      if (isLocked) {
        document.body.classList.add('design-locked');
      } else {
        document.body.classList.remove('design-locked');
      }
    }
  },

  /**
   * ربط أحداث الماوس واللمس للعناصر
   */
  bindEvents() {
    // زر القفل
    if (SVGApp.dom.lockToggleBtn) {
      SVGApp.dom.lockToggleBtn.addEventListener('click', () => this.toggleDesignLock());
    }
    this.updateLockUI();

    // سحب الكلمة
    SVGApp.dom.textGroup.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.initDrag('text', e);
      e.preventDefault();
    });
    SVGApp.dom.textGroup.addEventListener('touchstart', (e) => {
      e.stopPropagation();
      this.initDrag('text', e);
    }, { passive: false });

    // سحب الشكل
    SVGApp.dom.shapeGroup.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('resize-handle')) return;
      e.stopPropagation();
      this.initDrag('shape', e);
      e.preventDefault();
    });
    SVGApp.dom.shapeGroup.addEventListener('touchstart', (e) => {
      if (e.target.classList.contains('resize-handle')) return;
      e.stopPropagation();
      this.initDrag('shape', e);
    }, { passive: false });

    // مقابض تكبير وتصغير الشكل الأربع
    const handles = [
      SVGApp.dom.handleTL,
      SVGApp.dom.handleTR,
      SVGApp.dom.handleBR,
      SVGApp.dom.handleBL
    ];
    handles.forEach(h => {
      if (!h) return;
      h.addEventListener('mousedown', (e) => this.initResizeShape(e));
      h.addEventListener('touchstart', (e) => this.initResizeShape(e), { passive: false });
    });

    // أحداث الحركة العامة على النافذة
    window.addEventListener('mousemove', (e) => this.handlePointerMove(e));
    window.addEventListener('touchmove', (e) => this.handlePointerMove(e), { passive: false });
    window.addEventListener('mouseup', () => this.handlePointerEnd());
    window.addEventListener('touchend', () => this.handlePointerEnd());

    // مؤقت إخفاء التلميح التلقائي
    this.hintTimer = setTimeout(() => {
      this.hideHint();
    }, 5500);
  }
};
