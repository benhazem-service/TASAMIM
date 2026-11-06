/**
 * ==========================================================================
 * محرك الرسم والحسابات الرياضية وتحويل النصوص إلى فيكتور (Canvas & Vector Engine)
 * ==========================================================================
 */

window.SVGApp = window.SVGApp || {};

// جدول اتجاهات خوارزمية Marching Squares لاستخراج مسارات الفيكتور (Vector Paths)
const MS_NEXT_EDGE = new Int8Array(16 * 4).fill(-1);
[
  [1, 3, 0], [2, 0, 1], [3, 3, 1], [4, 1, 2],
  [5, 3, 2], [5, 1, 0], [6, 0, 2], [7, 3, 2],
  [8, 2, 3], [9, 2, 0], [10, 0, 3], [10, 2, 1],
  [11, 2, 1], [12, 1, 3], [13, 1, 0], [14, 0, 3]
].forEach(([m, ie, oe]) => {
  MS_NEXT_EDGE[m * 4 + ie] = oe;
});
const MS_DX = [0, 1, 0, -1];
const MS_DY = [-1, 0, 1, 0];

SVGApp.canvas = {
  _traceCanvas: null,
  _traceCtx: null,
  _cachedTextKey: null,
  _cachedTextVector: null,

  /**
   * تحويل الكلمة المرسومة بأي خط عربي إلى مسار فيكتور حقيقي (<path>)
   * يضمن:
   * 1. عدم خروج الكتابة خارج الإطار نهائياً (التخلص من أخطاء RTL وهوامش الخطوط الوهمية)
   * 2. ظهور الكلمة مع الشكل 100% عند التصدير في جميع المتصفحات وبرامج الليزر والتصميم
   */
  buildWordVector(txt, fontFamily) {
    const cleanTxt = (txt || '').trim();
    if (!cleanTxt) {
      return { d: '', x: -100, y: -50, width: 200, height: 100 };
    }

    const cacheKey = cleanTxt + '|||' + fontFamily;
    if (this._cachedTextKey === cacheKey && this._cachedTextVector) {
      return this._cachedTextVector;
    }

    if (!this._traceCanvas) {
      this._traceCanvas = document.createElement('canvas');
      this._traceCtx = this._traceCanvas.getContext('2d', { willReadFrequently: true });
    }

    const canvas = this._traceCanvas;
    const ctx = this._traceCtx;
    const fontSize = 220;
    const fontStr = '700 ' + fontSize + 'px ' + fontFamily;

    ctx.font = fontStr;
    const measured = ctx.measureText(cleanTxt);
    const estW = Math.max(Math.ceil(measured.width || fontSize * cleanTxt.length), fontSize);

    const W = Math.min(Math.max(estW + fontSize * 2, 600), 3600);
    const H = Math.round(fontSize * 2.8);

    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;

    ctx.clearRect(0, 0, W, H);
    ctx.direction = 'rtl';
    ctx.font = fontStr;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000000';
    ctx.fillText(cleanTxt, W / 2, H / 2);

    const imgData = ctx.getImageData(0, 0, W, H).data;
    const alpha = new Uint8Array(W * H);

    let minX = W, minY = H, maxX = 0, maxY = 0;
    let hasInk = false;

    for (let y = 0; y < H; y++) {
      const rowOffset = y * W;
      for (let x = 0; x < W; x++) {
        const idx = rowOffset + x;
        const a = imgData[(idx << 2) + 3];
        alpha[idx] = a;
        if (a >= 128) {
          hasInk = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!hasInk) {
      return { d: '', x: -100, y: -50, width: 200, height: 100 };
    }

    const x0 = Math.max(1, minX - 2);
    const y0 = Math.max(1, minY - 2);
    const x1 = Math.min(W - 2, maxX + 2);
    const y1 = Math.min(H - 2, maxY + 2);

    const visited = new Uint8Array(W * H);

    const getMask = (x, y) => {
      const i = y * W + x;
      return (alpha[i] >= 128 ? 1 : 0) |
             (alpha[i + 1] >= 128 ? 2 : 0) |
             (alpha[i + W + 1] >= 128 ? 4 : 0) |
             (alpha[i + W] >= 128 ? 8 : 0);
    };

    const interp = (u, v) => (u === v ? 0.5 : Math.max(0.05, Math.min(0.95, (128 - u) / (v - u))));

    const edgePt = (x, y, edge) => {
      const i = y * W + x;
      const a0 = alpha[i];
      const a1 = alpha[i + 1];
      const a2 = alpha[i + W + 1];
      const a3 = alpha[i + W];
      if (edge === 0) return [x + interp(a0, a1), y];
      if (edge === 1) return [x + 1, y + interp(a1, a2)];
      if (edge === 2) return [x + interp(a3, a2), y + 1];
      return [x, y + interp(a0, a3)];
    };

    const rawContours = [];
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const m = getMask(x, y);
        if (m === 0 || m === 15) continue;
        for (let ie = 0; ie < 4; ie++) {
          if (MS_NEXT_EDGE[m * 4 + ie] === -1) continue;
          if (visited[y * W + x] & (1 << ie)) continue;

          const pts = [];
          let cx = x, cy = y, curIn = ie;
          while (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) {
            const cm = getMask(cx, cy);
            const oe = MS_NEXT_EDGE[cm * 4 + curIn];
            if (oe === -1) break;
            const vIdx = cy * W + cx;
            if (visited[vIdx] & (1 << curIn)) break;
            visited[vIdx] |= (1 << curIn);
            pts.push(edgePt(cx, cy, oe));
            cx += MS_DX[oe];
            cy += MS_DY[oe];
            curIn = oe ^ 2;
          }
          if (pts.length >= 6) {
            rawContours.push(pts);
          }
        }
      }
    }

    // تطبيع أبعاد الكلمة بحيث يكون ارتفاعها الفعلي = 100 وحدة قياسية ومركزها (0, 0) بالضبط
    const inkW = Math.max(maxX - minX + 1, 1);
    const inkH = Math.max(maxY - minY + 1, 1);
    const centerX = (minX + maxX + 1) / 2;
    const centerY = (minY + maxY + 1) / 2;

    const targetH = 100;
    const normScale = targetH / inkH;
    const normW = inkW * normScale;

    let pathParts = [];
    for (let c = 0; c < rawContours.length; c++) {
      const simplified = this.simplifyContour(rawContours[c], 0.42);
      if (simplified.length < 3) continue;

      const tx0 = ((simplified[0][0] - centerX) * normScale).toFixed(2);
      const ty0 = ((simplified[0][1] - centerY) * normScale).toFixed(2);
      let sub = 'M' + tx0 + ' ' + ty0;

      for (let i = 1; i < simplified.length; i++) {
        const tx = ((simplified[i][0] - centerX) * normScale).toFixed(2);
        const ty = ((simplified[i][1] - centerY) * normScale).toFixed(2);
        sub += 'L' + tx + ' ' + ty;
      }
      sub += 'Z';
      pathParts.push(sub);
    }

    const result = {
      d: pathParts.join(' '),
      x: -normW / 2,
      y: -targetH / 2,
      width: normW,
      height: targetH
    };

    this._cachedTextKey = cacheKey;
    this._cachedTextVector = result;
    return result;
  },

  /**
   * تنعيم وتبسيط نقاط المسار (Smoothing + Ramer-Douglas-Peucker)
   */
  simplifyContour(pts, eps) {
    const n = pts.length;
    if (n <= 6) return pts;

    let cur = pts;
    for (let pass = 0; pass < 2; pass++) {
      const next = new Array(n);
      for (let i = 0; i < n; i++) {
        const p0 = cur[(i - 1 + n) % n];
        const p1 = cur[i];
        const p2 = cur[(i + 1) % n];
        const vx1 = p1[0] - p0[0], vy1 = p1[1] - p0[1];
        const vx2 = p2[0] - p1[0], vy2 = p2[1] - p1[1];
        const l1 = Math.hypot(vx1, vy1) || 1;
        const l2 = Math.hypot(vx2, vy2) || 1;
        const dot = (vx1 * vx2 + vy1 * vy2) / (l1 * l2);
        if (dot < 0.35) {
          next[i] = p1;
        } else {
          next[i] = [
            0.25 * p0[0] + 0.5 * p1[0] + 0.25 * p2[0],
            0.25 * p0[1] + 0.5 * p1[1] + 0.25 * p2[1]
          ];
        }
      }
      cur = next;
    }

    const rdp = (arr, s, e, tol, out) => {
      let maxD = 0;
      let idx = -1;
      const ax = arr[s][0], ay = arr[s][1];
      const bx = arr[e][0], by = arr[e][1];
      const dx = bx - ax, dy = by - ay;
      const lenSq = dx * dx + dy * dy;

      for (let i = s + 1; i < e; i++) {
        let d;
        if (lenSq === 0) {
          d = Math.hypot(arr[i][0] - ax, arr[i][1] - ay);
        } else {
          const t = Math.max(0, Math.min(1, ((arr[i][0] - ax) * dx + (arr[i][1] - ay) * dy) / lenSq));
          d = Math.hypot(arr[i][0] - (ax + t * dx), arr[i][1] - (ay + t * dy));
        }
        if (d > maxD) {
          maxD = d;
          idx = i;
        }
      }

      if (maxD > tol && idx !== -1) {
        rdp(arr, s, idx, tol, out);
        out.push(arr[idx]);
        rdp(arr, idx, e, tol, out);
      }
    };

    const mid = n >> 1;
    const res = [cur[0]];
    rdp(cur, 0, mid, eps, res);
    res.push(cur[mid]);
    rdp(cur, mid, n - 1, eps, res);
    return res;
  },

  /**
   * الحصول على عنصر مسار الكلمة الفيكتور داخل textGroup أو إنشاؤه
   */
  getOrCreateTextPathEl() {
    let pathEl = document.getElementById('svgTextPath');
    if (!pathEl) {
      pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pathEl.setAttribute('id', 'svgTextPath');
      pathEl.setAttribute('fill', '#1e293b');
      pathEl.setAttribute('fill-rule', 'evenodd');
      SVGApp.dom.textGroup.appendChild(pathEl);
    }
    return pathEl;
  },

  /**
   * قراءة الحدود الهندسية الدقيقة للكلمة
   */
  getTextBBox() {
    return SVGApp.state.textLocalBox || { x: -100, y: -50, width: 200, height: 100 };
  },

  /**
   * قراءة الحدود الهندسية الدقيقة للشكل
   */
  getShapeBBox() {
    return SVGApp.state.shapeLocalBox || { x: -50, y: -50, width: 100, height: 100 };
  },

  /**
   * تغيير وتحديث مقياس تكبير/تصغير الشكل داخل المشروع
   * مع الحفاظ على المسافة الفاصلة عن الكلمة وبقاء التصميم داخل الإطار
   */
  setShapeScale(scaleRatio, skipSlider = false) {
    const clamped = Math.max(0.15, Math.min(scaleRatio, 4.0));
    const showText = (SVGApp.dom.shapePosition.value !== 'only' && (SVGApp.dom.textInput.value || '').trim().length > 0);
    const showShape = (SVGApp.state.activeShapeKey !== 'none');

    // حفظ الحافة المواجهة للكلمة قبل تغيير حجم الشكل لمنع التداخل
    let anchorEdge = null;
    const pos = SVGApp.dom.shapePosition.value;
    if (showText && showShape) {
      const oldSb = this.getShapeBBox();
      if (pos === 'right') {
        anchorEdge = SVGApp.state.shapeRelX + oldSb.x;
      } else if (pos === 'left') {
        anchorEdge = SVGApp.state.shapeRelX + oldSb.x + oldSb.width;
      } else if (pos === 'top') {
        anchorEdge = SVGApp.state.shapeRelY + oldSb.y + oldSb.height;
      } else if (pos === 'bottom') {
        anchorEdge = SVGApp.state.shapeRelY + oldSb.y;
      }
    }

    SVGApp.state.shapeScaleRatio = clamped;

    const percent = Math.round(clamped * 100);
    if (SVGApp.dom.shapeScaleVal) {
      SVGApp.dom.shapeScaleVal.textContent = percent + '%';
    }
    if (SVGApp.dom.shapeScaleSlider && !skipSlider) {
      SVGApp.dom.shapeScaleSlider.value = percent;
    }

    this.updateTextAndShapeElements();

    // استعادة الحافة المواجهة للكلمة بحيث يتمدد الشكل للخارج دون الاصطدام بالكلمة
    if (anchorEdge !== null && showText && showShape) {
      const newSb = this.getShapeBBox();
      if (pos === 'right') {
        SVGApp.state.shapeRelX = anchorEdge - newSb.x;
      } else if (pos === 'left') {
        SVGApp.state.shapeRelX = anchorEdge - (newSb.x + newSb.width);
      } else if (pos === 'top') {
        SVGApp.state.shapeRelY = anchorEdge - (newSb.y + newSb.height);
      } else if (pos === 'bottom') {
        SVGApp.state.shapeRelY = anchorEdge - newSb.y;
      }
    }

    this.applyLayoutAndManualDimensions();
  },

  /**
   * تحديث عناصر الكلمة (كمسار فيكتور دقيق) والشكل في شجرة SVG
   */
  updateTextAndShapeElements() {
    const txt = (SVGApp.dom.textInput.value || '').trim();
    const pos = SVGApp.dom.shapePosition.value;
    const showText = (pos !== 'only' && txt.length > 0);
    const showShape = (SVGApp.state.activeShapeKey !== 'none');

    // 1. تحديث الكلمة كمسار فيكتور (<path>) لضمان بقائها داخل الإطار وظهورها عند التصدير
    const textPathEl = this.getOrCreateTextPathEl();
    if (SVGApp.dom.svgText) {
      SVGApp.dom.svgText.style.display = 'none';
    }

    if (showText) {
      SVGApp.dom.textGroup.style.display = '';
      const ff = SVGApp.dom.fontSelect.value;
      const vec = this.buildWordVector(txt, ff);

      textPathEl.setAttribute('d', vec.d);
      textPathEl.style.display = '';

      SVGApp.state.textVectorPath = vec.d;
      SVGApp.state.textLocalBox = {
        x: vec.x,
        y: vec.y,
        width: vec.width,
        height: vec.height
      };
    } else {
      SVGApp.dom.textGroup.style.display = 'none';
      SVGApp.state.textVectorPath = '';
    }

    // 2. تحديث الشكل وتطبيق نسبة التحجيم (shapeScaleRatio)
    SVGApp.dom.shapeContainer.innerHTML = '';
    if (showShape) {
      SVGApp.dom.shapeGroup.style.display = '';
      const raw = SVGApp.shapes.getShapeContent(SVGApp.state.activeShapeKey);
      if (raw) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.innerHTML = raw;
        SVGApp.dom.shapeContainer.appendChild(g);

        let rawBBox = { x: 0, y: 0, width: 100, height: 100 };
        try {
          const b = g.getBBox();
          if (b.width > 0 && b.height > 0) rawBBox = b;
        } catch (e) {}

        const maxDim = Math.max(rawBBox.width, rawBBox.height, 1);
        const targetPx = 100 * SVGApp.state.shapeScaleRatio;
        const scale = targetPx / maxDim;
        const cx = rawBBox.x + rawBBox.width / 2;
        const cy = rawBBox.y + rawBBox.height / 2;

        g.setAttribute('transform', 'scale(' + scale.toFixed(4) + ') translate(' + (-cx).toFixed(2) + ',' + (-cy).toFixed(2) + ')');
        SVGApp.dom.shapeContainer.setAttribute('fill', '#1e293b');

        const sw = rawBBox.width * scale;
        const sh = rawBBox.height * scale;
        SVGApp.state.shapeLocalBox = {
          x: -sw / 2,
          y: -sh / 2,
          width: sw,
          height: sh
        };
      }
    } else {
      SVGApp.dom.shapeGroup.style.display = 'none';
    }
  },

  /**
   * إعادة رسم التصميم بالكامل وتطبيق النصوص والأشكال
   */
  renderDesign() {
    const pos = SVGApp.dom.shapePosition.value;
    const txt = (SVGApp.dom.textInput.value || '').trim();
    const showText = (pos !== 'only' && txt.length > 0);
    const showShape = (SVGApp.state.activeShapeKey !== 'none');

    // حفظ المسافة الفاصلة بين الكلمة والشكل قبل تحديث النص
    let prevGap = null;
    if (showText && showShape && SVGApp.dom.textGroup.style.display !== 'none' && SVGApp.dom.shapeGroup.style.display !== 'none') {
      const oldTb = this.getTextBBox();
      const oldSb = this.getShapeBBox();
      if (pos === 'right') {
        prevGap = (SVGApp.state.shapeRelX + oldSb.x) - (SVGApp.state.textRelX + oldTb.x + oldTb.width);
      } else if (pos === 'left') {
        prevGap = (SVGApp.state.textRelX + oldTb.x) - (SVGApp.state.shapeRelX + oldSb.x + oldSb.width);
      }
    }

    this.updateTextAndShapeElements();

    // الحفاظ على المسافة الفاصلة عند كتابة نص أطول أو تغيير الخط
    if (prevGap !== null && showText && showShape) {
      const newTb = this.getTextBBox();
      const newSb = this.getShapeBBox();
      const safeGap = Math.max(prevGap, 20);
      if (pos === 'right') {
        SVGApp.state.shapeRelX = (SVGApp.state.textRelX + newTb.x + newTb.width + safeGap) - newSb.x;
      } else if (pos === 'left') {
        SVGApp.state.shapeRelX = (SVGApp.state.textRelX + newTb.x - safeGap) - (newSb.x + newSb.width);
      }
    }

    this.applyLayoutAndManualDimensions();
  },

  /**
   * تطبيق التحويلات والقياسات اليدوية الإجمالية
   * يضمن أن محيط (الكلمة + الشكل) معاً يساوي 100% القيمة المدخلة في القياسات ويبقى داخل الإطار
   */
  applyLayoutAndManualDimensions() {
    // 1. تطبيق الإزاحات النسبية
    SVGApp.dom.textGroup.setAttribute(
      'transform',
      'translate(' + SVGApp.state.textRelX.toFixed(2) + ',' + SVGApp.state.textRelY.toFixed(2) + ')'
    );
    SVGApp.dom.shapeGroup.setAttribute(
      'transform',
      'translate(' + SVGApp.state.shapeRelX.toFixed(2) + ',' + SVGApp.state.shapeRelY.toFixed(2) + ')'
    );

    // 2. حساب الحدود الفعلية لـ (الكلمة + الشكل)
    const showText = (SVGApp.dom.textGroup.style.display !== 'none');
    const showShape = (SVGApp.dom.shapeGroup.style.display !== 'none');

    let tb = null;
    let sb = null;

    if (showText) {
      const b = this.getTextBBox();
      tb = {
        x: b.x + SVGApp.state.textRelX,
        y: b.y + SVGApp.state.textRelY,
        width: b.width,
        height: b.height
      };
    }

    if (showShape) {
      const b = this.getShapeBBox();
      sb = {
        x: b.x + SVGApp.state.shapeRelX,
        y: b.y + SVGApp.state.shapeRelY,
        width: b.width,
        height: b.height
      };
    }

    let minX, maxX, minY, maxY;
    if (tb && sb) {
      minX = Math.min(tb.x, sb.x);
      maxX = Math.max(tb.x + tb.width, sb.x + sb.width);
      minY = Math.min(tb.y, sb.y);
      maxY = Math.max(tb.y + tb.height, sb.y + sb.height);
    } else if (tb) {
      minX = tb.x;
      maxX = tb.x + tb.width;
      minY = tb.y;
      maxY = tb.y + tb.height;
    } else if (sb) {
      minX = sb.x;
      maxX = sb.x + sb.width;
      minY = sb.y;
      maxY = sb.y + sb.height;
    } else {
      minX = -100;
      maxX = 100;
      minY = -50;
      maxY = 50;
    }

    const totalLocalW = Math.max(maxX - minX, 1);
    const totalLocalH = Math.max(maxY - minY, 1);
    const centerLocalX = (minX + maxX) / 2;
    const centerLocalY = (minY + maxY) / 2;

    // 3. التحجيم المباشر لمطابقة القياس اليدوي: (الكلمة + الشكل = القياس المدخل بالسنتيمتر)
    const targetWPx = SVGApp.state.manualWidth_cm * SVGApp.PX_PER_CM;
    const targetHPx = SVGApp.state.manualHeight_cm * SVGApp.PX_PER_CM;

    const scaleX = targetWPx / totalLocalW;
    const scaleY = targetHPx / totalLocalH;

    // تطبيق التحويل على المجموعة الرئيسية masterDesignGroup لتتوسط الإطار تماماً
    SVGApp.dom.masterDesignGroup.setAttribute(
      'transform',
      'scale(' + scaleX.toFixed(4) + ',' + scaleY.toFixed(4) + ') ' +
      'translate(' + (-centerLocalX).toFixed(2) + ',' + (-centerLocalY).toFixed(2) + ')'
    );

    // تحديث مربعات الاختيار ومقابض الزوايا وأبعاد كل عنصر بالسنتيمتر
    this.updateHitBoxesAndHandles(scaleX, scaleY);

    // تحديث خطوط القياسات وكاميرا العرض
    this.updateGuidesAndView(targetWPx, targetHPx);
  },

  /**
   * تحديث مربعات التحديد والنقر ومقابض تحجيم الشكل مع إظهار قياس كل عنصر بالسنتيمتر
   */
  updateHitBoxesAndHandles(scaleX = 1, scaleY = 1) {
    const pxPerCm = SVGApp.PX_PER_CM;
    const avgScale = Math.max((scaleX + scaleY) / 2, 0.1);
    const padX = 6 / Math.max(scaleX, 0.1);
    const padY = 6 / Math.max(scaleY, 0.1);
    const handleRadius = Math.max(4, Math.min(7 / avgScale, 18));

    // إطار النص
    if (SVGApp.dom.textGroup.style.display !== 'none') {
      const b = this.getTextBBox();
      const bx = b.x - padX;
      const by = b.y - padY;
      const bw = b.width + padX * 2;
      const bh = b.height + padY * 2;

      SVGApp.dom.textHitArea.setAttribute('x', bx);
      SVGApp.dom.textHitArea.setAttribute('y', by);
      SVGApp.dom.textHitArea.setAttribute('width', bw);
      SVGApp.dom.textHitArea.setAttribute('height', bh);

      SVGApp.dom.textSelectionBox.setAttribute('x', bx);
      SVGApp.dom.textSelectionBox.setAttribute('y', by);
      SVGApp.dom.textSelectionBox.setAttribute('width', bw);
      SVGApp.dom.textSelectionBox.setAttribute('height', bh);
      SVGApp.dom.textSelectionBox.setAttribute('vector-effect', 'non-scaling-stroke');

      const wordW_cm = ((b.width * scaleX) / pxPerCm).toFixed(1);
      const wordH_cm = ((b.height * scaleY) / pxPerCm).toFixed(1);
      SVGApp.dom.textLabelBadge.textContent = '📝 الكلمة (' + wordW_cm + '×' + wordH_cm + ' cm)';
      SVGApp.dom.textLabelBadge.setAttribute('x', bx + bw / 2);
      SVGApp.dom.textLabelBadge.setAttribute('y', by - 6 / Math.max(scaleY, 0.1));
      SVGApp.dom.textLabelBadge.setAttribute('text-anchor', 'middle');
      SVGApp.dom.textLabelBadge.setAttribute('font-size', (11 / avgScale).toFixed(1));
    }

    // إطار الشكل ومقابض التكبير بالزوايا
    if (SVGApp.dom.shapeGroup.style.display !== 'none') {
      const b = this.getShapeBBox();
      const bx = b.x - padX;
      const by = b.y - padY;
      const bw = b.width + padX * 2;
      const bh = b.height + padY * 2;

      SVGApp.dom.shapeHitArea.setAttribute('x', bx);
      SVGApp.dom.shapeHitArea.setAttribute('y', by);
      SVGApp.dom.shapeHitArea.setAttribute('width', bw);
      SVGApp.dom.shapeHitArea.setAttribute('height', bh);

      SVGApp.dom.shapeSelectionBox.setAttribute('x', bx);
      SVGApp.dom.shapeSelectionBox.setAttribute('y', by);
      SVGApp.dom.shapeSelectionBox.setAttribute('width', bw);
      SVGApp.dom.shapeSelectionBox.setAttribute('height', bh);
      SVGApp.dom.shapeSelectionBox.setAttribute('vector-effect', 'non-scaling-stroke');

      const shapeW_cm = ((b.width * scaleX) / pxPerCm).toFixed(1);
      const shapeH_cm = ((b.height * scaleY) / pxPerCm).toFixed(1);
      SVGApp.dom.shapeLabelBadge.textContent = '⭐ الشكل (' + shapeW_cm + '×' + shapeH_cm + ' cm)';
      SVGApp.dom.shapeLabelBadge.setAttribute('x', bx + bw / 2);
      SVGApp.dom.shapeLabelBadge.setAttribute('y', by - 6 / Math.max(scaleY, 0.1));
      SVGApp.dom.shapeLabelBadge.setAttribute('text-anchor', 'middle');
      SVGApp.dom.shapeLabelBadge.setAttribute('font-size', (11 / avgScale).toFixed(1));

      [SVGApp.dom.handleTL, SVGApp.dom.handleTR, SVGApp.dom.handleBR, SVGApp.dom.handleBL].forEach(h => {
        if (h) {
          h.setAttribute('r', handleRadius.toFixed(1));
          h.setAttribute('vector-effect', 'non-scaling-stroke');
        }
      });

      SVGApp.dom.handleTL.setAttribute('cx', bx);
      SVGApp.dom.handleTL.setAttribute('cy', by);

      SVGApp.dom.handleTR.setAttribute('cx', bx + bw);
      SVGApp.dom.handleTR.setAttribute('cy', by);

      SVGApp.dom.handleBR.setAttribute('cx', bx + bw);
      SVGApp.dom.handleBR.setAttribute('cy', by + bh);

      SVGApp.dom.handleBL.setAttribute('cx', bx);
      SVGApp.dom.handleBL.setAttribute('cy', by + bh);
    }
  },

  /**
   * تحديث خطوط القياس اليدوية، مؤشرات الأبعاد، وكاميرا مساحة العمل
   */
  updateGuidesAndView(targetWPx, targetHPx) {
    const minX = -targetWPx / 2;
    const minY = -targetHPx / 2;

    // مستطيل يطابق تماماً القياس اليدوي المحدد (الكلمة + الشكل)
    SVGApp.dom.outerDesignRect.setAttribute('x', minX);
    SVGApp.dom.outerDesignRect.setAttribute('y', minY);
    SVGApp.dom.outerDesignRect.setAttribute('width', targetWPx);
    SVGApp.dom.outerDesignRect.setAttribute('height', targetHPx);

    // خط قياس العرض العلوي (يقرأ دائماً القياس اليدوي الإجمالي)
    const pad = 24;
    const topY = minY - pad;
    SVGApp.dom.topDimLine.setAttribute('x1', minX);
    SVGApp.dom.topDimLine.setAttribute('y1', topY);
    SVGApp.dom.topDimLine.setAttribute('x2', minX + targetWPx);
    SVGApp.dom.topDimLine.setAttribute('y2', topY);

    SVGApp.dom.widthLabel.textContent = SVGApp.state.manualWidth_cm.toFixed(2) + ' cm';
    SVGApp.dom.widthLabel.setAttribute('x', 0);
    SVGApp.dom.widthLabel.setAttribute('y', topY - 12);

    const wbw = 84;
    const wbh = 22;
    SVGApp.dom.widthBadgeBg.setAttribute('x', -wbw / 2);
    SVGApp.dom.widthBadgeBg.setAttribute('y', topY - 12 - wbh / 2);
    SVGApp.dom.widthBadgeBg.setAttribute('width', wbw);
    SVGApp.dom.widthBadgeBg.setAttribute('height', wbh);

    // خط قياس الطول الجانبي (يقرأ دائماً القياس اليدوي الإجمالي)
    const sideX = minX - pad;
    SVGApp.dom.sideDimLine.setAttribute('x1', sideX);
    SVGApp.dom.sideDimLine.setAttribute('y1', minY);
    SVGApp.dom.sideDimLine.setAttribute('x2', sideX);
    SVGApp.dom.sideDimLine.setAttribute('y2', minY + targetHPx);

    SVGApp.dom.heightLabel.textContent = SVGApp.state.manualHeight_cm.toFixed(2) + ' cm';
    SVGApp.dom.heightLabel.setAttribute('x', sideX - 46);
    SVGApp.dom.heightLabel.setAttribute('y', 0);

    const hbw = 84;
    const hbh = 22;
    SVGApp.dom.heightBadgeBg.setAttribute('x', sideX - 46 - hbw / 2);
    SVGApp.dom.heightBadgeBg.setAttribute('y', -hbh / 2);
    SVGApp.dom.heightBadgeBg.setAttribute('width', hbw);
    SVGApp.dom.heightBadgeBg.setAttribute('height', hbh);

    SVGApp.dom.infoW.textContent = SVGApp.state.manualWidth_cm.toFixed(2);
    SVGApp.dom.infoH.textContent = SVGApp.state.manualHeight_cm.toFixed(2);

    // تحديث مؤشر مسافة التباعد
    this.updateSeparationDistance();

    // ضبط كاميرا SVG ومساحة اللوحة (ViewBox & Artboard)
    const margin = 80;
    const vx = minX - margin - 40;
    const vy = minY - margin - 30;
    const vw = targetWPx + margin * 2 + 50;
    const vh = targetHPx + margin * 2 + 40;

    SVGApp.dom.previewSvg.setAttribute(
      'viewBox',
      vx.toFixed(1) + ' ' + vy.toFixed(1) + ' ' + vw.toFixed(1) + ' ' + vh.toFixed(1)
    );

    const containerRect = SVGApp.dom.artboardContainer.getBoundingClientRect();
    const maxW = Math.max(containerRect.width - 40, 260);
    const maxH = Math.max(containerRect.height - 40, 200);

    if (SVGApp.state.currentZoomMode === '100') {
      const realW = vw * SVGApp.state.customZoomLevel;
      const realH = vh * SVGApp.state.customZoomLevel;
      SVGApp.dom.artboardCard.style.width = Math.max(realW, 200) + 'px';
      SVGApp.dom.artboardCard.style.height = Math.max(realH, 150) + 'px';
    } else {
      const aspect = vw / vh;
      let fitW = maxW;
      let fitH = fitW / aspect;
      if (fitH > maxH) {
        fitH = maxH;
        fitW = fitH * aspect;
      }
      SVGApp.dom.artboardCard.style.width = fitW.toFixed(1) + 'px';
      SVGApp.dom.artboardCard.style.height = fitH.toFixed(1) + 'px';
    }
  },

  /**
   * حساب مسافة التباعد بين الكلمة والشكل وعرضها في شريط المعلومات
   */
  updateSeparationDistance() {
    const showText = (SVGApp.dom.textGroup.style.display !== 'none');
    const showShape = (SVGApp.dom.shapeGroup.style.display !== 'none');

    if (!showText || !showShape) {
      SVGApp.dom.infoSep.style.display = 'none';
      SVGApp.dom.separationGuideGroup.style.display = 'none';
      return;
    }

    try {
      const b1 = SVGApp.dom.textSelectionBox.getBoundingClientRect();
      const b2 = SVGApp.dom.shapeSelectionBox.getBoundingClientRect();

      const ctm = SVGApp.dom.previewSvg.getScreenCTM();
      const pxScale = ctm ? ctm.a : 1.0;

      const gapX1 = b2.left - b1.right;
      const gapX2 = b1.left - b2.right;
      const gapY1 = b2.top - b1.bottom;
      const gapY2 = b1.top - b2.bottom;

      let sepPx = 0;
      if (gapX1 > 0) sepPx = gapX1;
      else if (gapX2 > 0) sepPx = gapX2;
      else if (gapY1 > 0) sepPx = gapY1;
      else if (gapY2 > 0) sepPx = gapY2;

      const sepCm = (sepPx / pxScale) / SVGApp.PX_PER_CM;

      if (sepCm > 0.05) {
        SVGApp.dom.infoSep.textContent = 'التباعد: ' + sepCm.toFixed(2) + ' cm';
        SVGApp.dom.infoSep.style.display = '';
      } else {
        SVGApp.dom.infoSep.textContent = 'التباعد: متقاربان';
        SVGApp.dom.infoSep.style.display = '';
      }
      SVGApp.dom.separationGuideGroup.style.display = 'none';
    } catch (e) {
      SVGApp.dom.infoSep.style.display = 'none';
    }
  },

  /**
   * إعادة ضبط الترتيب والتوسيط المبدئي وفق الموضع المختار دون أي تداخل
   */
  resetLayout() {
    const pos = SVGApp.dom.shapePosition.value;

    SVGApp.state.shapeScaleRatio = 1.0;
    if (SVGApp.dom.shapeScaleVal) SVGApp.dom.shapeScaleVal.textContent = '100%';
    if (SVGApp.dom.shapeScaleSlider) SVGApp.dom.shapeScaleSlider.value = 100;

    // بناء العناصر أولاً لقراءة أبعادها الهندسية الدقيقة
    this.updateTextAndShapeElements();

    const tb = this.getTextBBox();
    const sb = this.getShapeBBox();
    const gap = 30;

    SVGApp.state.textRelX = 0;
    SVGApp.state.textRelY = 0;
    SVGApp.state.shapeRelX = 0;
    SVGApp.state.shapeRelY = 0;

    if (pos === 'right') {
      SVGApp.state.shapeRelX = (tb.x + tb.width) - sb.x + gap;
    } else if (pos === 'left') {
      SVGApp.state.shapeRelX = tb.x - (sb.x + sb.width) - gap;
    } else if (pos === 'top') {
      SVGApp.state.shapeRelY = tb.y - (sb.y + sb.height) - gap;
    } else if (pos === 'bottom') {
      SVGApp.state.shapeRelY = (tb.y + tb.height) - sb.y + gap;
    }

    this.applyLayoutAndManualDimensions();
  }
};
