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
    // نستخدم نمط normal لأن بعض الخطوط المزخرفة (مثل Campana Script أو Cameliya) لا تحتوي على نسخة Bold وإذا فُرض 700 قد يرفضها المتصفح
    const isBold = fontFamily.includes('Bold');
    const fontStr = (isBold ? 'bold ' : 'normal ') + fontSize + 'px ' + fontFamily;

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

  _rawShapeBBoxCache: {},

  /**
   * قراءة الحدود الهندسية الدقيقة للكلمة
   */
  getTextBBox() {
    return SVGApp.state.textLocalBox || { x: -100, y: -50, width: 200, height: 100 };
  },

  /**
   * قراءة الحدود الهندسية الدقيقة للشكل المحدد (أو شكل ممرر)
   */
  getShapeBBox(shapeObj) {
    const target = shapeObj || (SVGApp.shapes && SVGApp.shapes.getSelectedShape ? SVGApp.shapes.getSelectedShape() : null);
    if (target && target.localBox) {
      return target.localBox;
    }
    return SVGApp.state.shapeLocalBox || { x: -50, y: -50, width: 100, height: 100 };
  },

  /**
   * تغيير وتحديث مقياس تكبير/تصغير الشكل المحدد داخل المشروع
   */
  setShapeScale(scaleRatio, skipSlider = false) {
    const sel = SVGApp.shapes && SVGApp.shapes.getSelectedShape ? SVGApp.shapes.getSelectedShape() : null;
    const clamped = Math.max(0.15, Math.min(scaleRatio, 4.0));
    const showText = (SVGApp.dom.shapePosition.value !== 'only' && (SVGApp.dom.textInput.value || '').trim().length > 0);
    const shapesList = SVGApp.state.shapes || [];

    // حفظ الحافة المواجهة للكلمة قبل تغيير حجم الشكل لمنع التداخل (عندما يكون هناك شكل واحد)
    let anchorEdge = null;
    const pos = SVGApp.dom.shapePosition.value;
    if (showText && sel && shapesList.length === 1) {
      const oldSb = this.getShapeBBox(sel);
      if (pos === 'right') {
        anchorEdge = sel.relX + oldSb.x;
      } else if (pos === 'left') {
        anchorEdge = sel.relX + oldSb.x + oldSb.width;
      } else if (pos === 'top') {
        anchorEdge = sel.relY + oldSb.y + oldSb.height;
      } else if (pos === 'bottom') {
        anchorEdge = sel.relY + oldSb.y;
      }
    }

    if (sel) {
      sel.scaleRatio = clamped;
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

    // استعادة الحافة المواجهة للكلمة عند وجود شكل واحد بحيث يتمدد للخارج دون الاصطدام بالكلمة
    if (anchorEdge !== null && showText && sel && shapesList.length === 1) {
      const newSb = this.getShapeBBox(sel);
      if (pos === 'right') {
        sel.relX = anchorEdge - newSb.x;
      } else if (pos === 'left') {
        sel.relX = anchorEdge - (newSb.x + newSb.width);
      } else if (pos === 'top') {
        sel.relY = anchorEdge - (newSb.y + newSb.height);
      } else if (pos === 'bottom') {
        sel.relY = anchorEdge - newSb.y;
      }
      SVGApp.state.shapeRelX = sel.relX;
      SVGApp.state.shapeRelY = sel.relY;
    }

    this.applyLayoutAndManualDimensions();
  },

  /**
   * تحديث عناصر الكلمة (كمسار فيكتور دقيق) وجميع الأشكال المضافة في شجرة SVG
   */
  updateTextAndShapeElements() {
    const txt = (SVGApp.dom.textInput.value || '').trim();
    const pos = SVGApp.dom.shapePosition.value;
    const showText = (pos !== 'only' && txt.length > 0);
    const shapesList = SVGApp.state.shapes || [];
    const showShapes = (shapesList.length > 0);

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

    // 2. تحديث جميع الأشكال المضافة في التصميم داخل shapeGroup
    SVGApp.dom.shapeGroup.innerHTML = '';
    if (showShapes) {
      SVGApp.dom.shapeGroup.style.display = '';
      SVGApp.dom.shapeGroup.setAttribute('transform', 'translate(0,0)');

      shapesList.forEach((sh) => {
        const raw = SVGApp.shapes.getShapeContent(sh.key);
        if (!raw) return;

        const itemGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        itemGroup.setAttribute('class', 'interactive-group shape-item-group');
        itemGroup.setAttribute('data-shape-id', sh.id);
        itemGroup.setAttribute('transform', 'translate(' + (sh.relX || 0).toFixed(2) + ',' + (sh.relY || 0).toFixed(2) + ')');

        const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        hitArea.setAttribute('class', 'shape-hit-area');
        hitArea.setAttribute('fill', 'transparent');
        hitArea.setAttribute('pointer-events', 'all');
        itemGroup.appendChild(hitArea);

        const selBox = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        selBox.setAttribute('class', 'drag-selection-box shape-selection-box');
        selBox.setAttribute('fill', 'none');
        selBox.setAttribute('stroke', '#10b981');
        selBox.setAttribute('stroke-width', '1.2');
        selBox.setAttribute('rx', '4');
        itemGroup.appendChild(selBox);

        const labelBadge = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        labelBadge.setAttribute('class', 'drag-label-badge shape-label-badge');
        labelBadge.setAttribute('fill', '#10b981');
        itemGroup.appendChild(labelBadge);

        const contentContainer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        contentContainer.setAttribute('class', 'shape-item-content');
        contentContainer.setAttribute('fill', '#1e293b');
        const innerG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        innerG.innerHTML = raw;
        contentContainer.appendChild(innerG);
        itemGroup.appendChild(contentContainer);

        ['TL', 'TR', 'BR', 'BL'].forEach(corner => {
          const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          handle.setAttribute('class', 'resize-handle handle-' + corner);
          handle.setAttribute('data-shape-id', sh.id);
          handle.setAttribute('data-corner', corner);
          handle.setAttribute('r', '6');
          itemGroup.appendChild(handle);
        });

        SVGApp.dom.shapeGroup.appendChild(itemGroup);

        let rawBBox = this._rawShapeBBoxCache[sh.key];
        if (!rawBBox) {
          rawBBox = { x: 0, y: 0, width: 100, height: 100 };
          try {
            const b = innerG.getBBox();
            if (b.width > 0 && b.height > 0) {
              rawBBox = { x: b.x, y: b.y, width: b.width, height: b.height };
              this._rawShapeBBoxCache[sh.key] = rawBBox;
            }
          } catch (e) {}
        }

        const scaleRatio = sh.scaleRatio || 1.0;
        const maxDim = Math.max(rawBBox.width, rawBBox.height, 1);
        const targetPx = 100 * scaleRatio;
        const scale = targetPx / maxDim;
        const cx = rawBBox.x + rawBBox.width / 2;
        const cy = rawBBox.y + rawBBox.height / 2;

        const transformStr = 'scale(' + scale.toFixed(4) + ') translate(' + (-cx).toFixed(2) + ',' + (-cy).toFixed(2) + ')';
        innerG.setAttribute('transform', transformStr);
        sh.innerTransform = transformStr;

        const sw = rawBBox.width * scale;
        const shHeight = rawBBox.height * scale;
        sh.localBox = {
          x: -sw / 2,
          y: -shHeight / 2,
          width: sw,
          height: shHeight
        };
      });

      if (SVGApp.shapes && SVGApp.shapes.syncStateAndUI) {
        SVGApp.shapes.syncStateAndUI();
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
    const shapesList = SVGApp.state.shapes || [];
    const showSingleShape = (shapesList.length === 1);

    // حفظ المسافة الفاصلة بين الكلمة والشكل قبل تحديث النص (في حالة شكل واحد)
    let prevGap = null;
    if (showText && showSingleShape && SVGApp.dom.textGroup.style.display !== 'none') {
      const sh0 = shapesList[0];
      const oldTb = this.getTextBBox();
      const oldSb = this.getShapeBBox(sh0);
      if (pos === 'right') {
        prevGap = (sh0.relX + oldSb.x) - (SVGApp.state.textRelX + oldTb.x + oldTb.width);
      } else if (pos === 'left') {
        prevGap = (SVGApp.state.textRelX + oldTb.x) - (sh0.relX + oldSb.x + oldSb.width);
      }
    }

    this.updateTextAndShapeElements();

    // الحفاظ على المسافة الفاصلة عند كتابة نص أطول أو تغيير الخط (في حالة شكل واحد)
    if (prevGap !== null && showText && showSingleShape) {
      const sh0 = shapesList[0];
      const newTb = this.getTextBBox();
      const newSb = this.getShapeBBox(sh0);
      const safeGap = Math.max(prevGap, 20);
      if (pos === 'right') {
        sh0.relX = (SVGApp.state.textRelX + newTb.x + newTb.width + safeGap) - newSb.x;
      } else if (pos === 'left') {
        sh0.relX = (SVGApp.state.textRelX + newTb.x - safeGap) - (newSb.x + newSb.width);
      }
      SVGApp.state.shapeRelX = sh0.relX;
    }

    this.applyLayoutAndManualDimensions();
  },

  /**
   * تطبيق التحويلات والقياسات اليدوية الإجمالية
   * يضمن أن محيط (الكلمة + جميع الأشكال) معاً يساوي 100% القيمة المدخلة في القياسات ويبقى داخل الإطار
   */
  applyLayoutAndManualDimensions() {
    // 1. تطبيق الإزاحات النسبية للكلمة ولكل شكل
    SVGApp.dom.textGroup.setAttribute(
      'transform',
      'translate(' + SVGApp.state.textRelX.toFixed(2) + ',' + SVGApp.state.textRelY.toFixed(2) + ')'
    );
    SVGApp.dom.shapeGroup.setAttribute('transform', 'translate(0,0)');

    const shapesList = SVGApp.state.shapes || [];
    const itemGroups = SVGApp.dom.shapeGroup.querySelectorAll('.shape-item-group');
    itemGroups.forEach(g => {
      const sid = g.getAttribute('data-shape-id');
      const sh = shapesList.find(s => s.id === sid);
      if (sh) {
        g.setAttribute('transform', 'translate(' + (sh.relX || 0).toFixed(2) + ',' + (sh.relY || 0).toFixed(2) + ')');
      }
    });

    // 2. حساب الحدود الفعلية لـ (الكلمة + جميع الأشكال المضافة)
    const showText = (SVGApp.dom.textGroup.style.display !== 'none');
    const showShapes = (SVGApp.dom.shapeGroup.style.display !== 'none' && shapesList.length > 0);

    const boxes = [];

    if (showText) {
      const b = this.getTextBBox();
      boxes.push({
        x: b.x + SVGApp.state.textRelX,
        y: b.y + SVGApp.state.textRelY,
        width: b.width,
        height: b.height
      });
    }

    if (showShapes) {
      shapesList.forEach(sh => {
        const b = sh.localBox || { x: -50, y: -50, width: 100, height: 100 };
        boxes.push({
          x: b.x + (sh.relX || 0),
          y: b.y + (sh.relY || 0),
          width: b.width,
          height: b.height
        });
      });
    }

    let minX, maxX, minY, maxY;
    if (boxes.length > 0) {
      minX = boxes[0].x;
      maxX = boxes[0].x + boxes[0].width;
      minY = boxes[0].y;
      maxY = boxes[0].y + boxes[0].height;
      for (let i = 1; i < boxes.length; i++) {
        if (boxes[i].x < minX) minX = boxes[i].x;
        if (boxes[i].x + boxes[i].width > maxX) maxX = boxes[i].x + boxes[i].width;
        if (boxes[i].y < minY) minY = boxes[i].y;
        if (boxes[i].y + boxes[i].height > maxY) maxY = boxes[i].y + boxes[i].height;
      }
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

    // 3. التحجيم المباشر لمطابقة القياس اليدوي: (الكلمة + الأشكال = القياس المدخل بالسنتيمتر)
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
   * تحديث مربعات التحديد والنقر ومقابض تحجيم كل شكل مع إظهار قياس كل عنصر بالسنتيمتر
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

    // أطر الأشكال ومقابض التكبير بالزوايا لكل شكل
    if (SVGApp.dom.shapeGroup.style.display !== 'none') {
      const shapesList = SVGApp.state.shapes || [];
      const itemGroups = SVGApp.dom.shapeGroup.querySelectorAll('.shape-item-group');

      itemGroups.forEach((g, idx) => {
        const sid = g.getAttribute('data-shape-id');
        const sh = shapesList.find(s => s.id === sid);
        if (!sh) return;

        const isSelected = (sh.id === SVGApp.state.selectedShapeId) || (shapesList.length === 1);
        const b = sh.localBox || { x: -50, y: -50, width: 100, height: 100 };
        const bx = b.x - padX;
        const by = b.y - padY;
        const bw = b.width + padX * 2;
        const bh = b.height + padY * 2;

        const hitArea = g.querySelector('.shape-hit-area');
        if (hitArea) {
          hitArea.setAttribute('x', bx);
          hitArea.setAttribute('y', by);
          hitArea.setAttribute('width', bw);
          hitArea.setAttribute('height', bh);
        }

        const selBox = g.querySelector('.shape-selection-box');
        if (selBox) {
          selBox.setAttribute('x', bx);
          selBox.setAttribute('y', by);
          selBox.setAttribute('width', bw);
          selBox.setAttribute('height', bh);
          selBox.setAttribute('vector-effect', 'non-scaling-stroke');
          selBox.setAttribute('stroke', isSelected ? '#10b981' : '#94a3b8');
          selBox.setAttribute('stroke-width', isSelected ? '1.6' : '1.1');
        }

        const shapeW_cm = ((b.width * scaleX) / pxPerCm).toFixed(1);
        const shapeH_cm = ((b.height * scaleY) / pxPerCm).toFixed(1);
        const labelBadge = g.querySelector('.shape-label-badge');
        if (labelBadge) {
          const titlePrefix = shapesList.length > 1 ? ('⭐ شكل ' + (idx + 1)) : '⭐ الشكل';
          labelBadge.textContent = titlePrefix + ' (' + shapeW_cm + '×' + shapeH_cm + ' cm)';
          labelBadge.setAttribute('x', bx + bw / 2);
          labelBadge.setAttribute('y', by - 6 / Math.max(scaleY, 0.1));
          labelBadge.setAttribute('text-anchor', 'middle');
          labelBadge.setAttribute('font-size', (11 / avgScale).toFixed(1));
          labelBadge.setAttribute('fill', isSelected ? '#059669' : '#64748b');
        }

        const hTL = g.querySelector('.handle-TL');
        const hTR = g.querySelector('.handle-TR');
        const hBR = g.querySelector('.handle-BR');
        const hBL = g.querySelector('.handle-BL');

        [hTL, hTR, hBR, hBL].forEach(h => {
          if (h) {
            h.setAttribute('r', handleRadius.toFixed(1));
            h.setAttribute('vector-effect', 'non-scaling-stroke');
            h.style.display = isSelected ? '' : 'none';
          }
        });

        if (hTL) { hTL.setAttribute('cx', bx); hTL.setAttribute('cy', by); }
        if (hTR) { hTR.setAttribute('cx', bx + bw); hTR.setAttribute('cy', by); }
        if (hBR) { hBR.setAttribute('cx', bx + bw); hBR.setAttribute('cy', by + bh); }
        if (hBL) { hBL.setAttribute('cx', bx); hBL.setAttribute('cy', by + bh); }
      });
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
   * حساب مسافة التباعد بين الكلمة والشكل المحدد وعرضها في شريط المعلومات
   */
  updateSeparationDistance() {
    const showText = (SVGApp.dom.textGroup.style.display !== 'none');
    const shapesList = SVGApp.state.shapes || [];
    const showShape = (SVGApp.dom.shapeGroup.style.display !== 'none' && shapesList.length > 0);

    if (!showText || !showShape) {
      SVGApp.dom.infoSep.style.display = 'none';
      SVGApp.dom.separationGuideGroup.style.display = 'none';
      return;
    }

    try {
      const sel = (SVGApp.shapes && SVGApp.shapes.getSelectedShape) ? SVGApp.shapes.getSelectedShape() : shapesList[0];
      const selGroup = sel
        ? SVGApp.dom.shapeGroup.querySelector('.shape-item-group[data-shape-id="' + sel.id + '"]')
        : SVGApp.dom.shapeGroup.querySelector('.shape-item-group');
      const selBoxEl = selGroup ? selGroup.querySelector('.shape-selection-box') : null;

      if (!selBoxEl) {
        SVGApp.dom.infoSep.style.display = 'none';
        return;
      }

      const b1 = SVGApp.dom.textSelectionBox.getBoundingClientRect();
      const b2 = selBoxEl.getBoundingClientRect();

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
    const shapesList = SVGApp.state.shapes || [];

    SVGApp.state.shapeScaleRatio = 1.0;
    shapesList.forEach(sh => {
      sh.scaleRatio = 1.0;
    });
    if (SVGApp.dom.shapeScaleVal) SVGApp.dom.shapeScaleVal.textContent = '100%';
    if (SVGApp.dom.shapeScaleSlider) SVGApp.dom.shapeScaleSlider.value = 100;

    // بناء العناصر أولاً لقراءة أبعادها الهندسية الدقيقة
    this.updateTextAndShapeElements();

    const tb = this.getTextBBox();
    const gap = 30;

    SVGApp.state.textRelX = 0;
    SVGApp.state.textRelY = 0;

    let rightEdge = tb.x + tb.width;
    let leftEdge = tb.x;
    let topEdge = tb.y;
    let bottomEdge = tb.y + tb.height;

    shapesList.forEach((sh, idx) => {
      const sb = sh.localBox || { x: -50, y: -50, width: 100, height: 100 };
      sh.relX = 0;
      sh.relY = 0;

      if (pos === 'only') {
        sh.relX = idx * (sb.width + gap);
        sh.relY = 0;
      } else if (pos === 'right') {
        if (idx === 0) {
          sh.relX = rightEdge - sb.x + gap;
          rightEdge = sh.relX + sb.x + sb.width;
        } else if (idx === 1) {
          sh.relX = leftEdge - (sb.x + sb.width) - gap;
          leftEdge = sh.relX + sb.x;
        } else if (idx % 2 === 0) {
          sh.relX = rightEdge - sb.x + gap;
          rightEdge = sh.relX + sb.x + sb.width;
        } else {
          sh.relX = leftEdge - (sb.x + sb.width) - gap;
          leftEdge = sh.relX + sb.x;
        }
      } else if (pos === 'left') {
        if (idx === 0) {
          sh.relX = leftEdge - (sb.x + sb.width) - gap;
          leftEdge = sh.relX + sb.x;
        } else if (idx === 1) {
          sh.relX = rightEdge - sb.x + gap;
          rightEdge = sh.relX + sb.x + sb.width;
        } else if (idx % 2 === 0) {
          sh.relX = leftEdge - (sb.x + sb.width) - gap;
          leftEdge = sh.relX + sb.x;
        } else {
          sh.relX = rightEdge - sb.x + gap;
          rightEdge = sh.relX + sb.x + sb.width;
        }
      } else if (pos === 'top') {
        sh.relY = topEdge - (sb.y + sb.height) - gap;
        sh.relX = (idx === 0) ? 0 : ((idx % 2 === 1 ? 1 : -1) * Math.ceil(idx / 2) * (sb.width + gap));
      } else if (pos === 'bottom') {
        sh.relY = bottomEdge - sb.y + gap;
        sh.relX = (idx === 0) ? 0 : ((idx % 2 === 1 ? 1 : -1) * Math.ceil(idx / 2) * (sb.width + gap));
      }
    });

    if (shapesList.length > 0) {
      SVGApp.state.shapeRelX = shapesList[0].relX;
      SVGApp.state.shapeRelY = shapesList[0].relY;
    }

    this.applyLayoutAndManualDimensions();
  }
};
