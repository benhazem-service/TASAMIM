/**
 * ==========================================================================
 * محرك توليد وتصدير ملفات SVG (SVG Generation & Export Engine)
 * ==========================================================================
 */

window.SVGApp = window.SVGApp || {};

SVGApp.exporter = {
  /**
   * ترميز المحارف الخاصة بـ XML لمنع أي أخطاء في ملف الـ SVG
   */
  escXml(s) {
    if (!s) return '';
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  },

  /**
   * بناء كود SVG القياسي النقي للتصميم الحالي بالقياسات الحقيقية (cm)
   */
  generateSvgString() {
    const targetWPx = SVGApp.state.manualWidth_cm * SVGApp.PX_PER_CM;
    const targetHPx = SVGApp.state.manualHeight_cm * SVGApp.PX_PER_CM;
    const ff = SVGApp.dom.fontSelect.value;
    const txt = (SVGApp.dom.textInput.value || '').trim();
    const pos = SVGApp.dom.shapePosition.value;

    const showText = (pos !== 'only' && txt.length > 0);
    const showShape = (SVGApp.state.activeShapeKey !== 'none');

    // 1. تصدير الكلمة كمسار فيكتور (<path>) مطابق 100% للمعاينة
    let textStr = '';
    if (showText) {
      let pathD = SVGApp.state.textVectorPath;
      if (!pathD && SVGApp.canvas && SVGApp.canvas.buildWordVector) {
        pathD = SVGApp.canvas.buildWordVector(txt, ff).d;
      }

      if (pathD) {
        textStr = '    <g id="wordGroup" transform="translate(' + SVGApp.state.textRelX.toFixed(2) + ',' + SVGApp.state.textRelY.toFixed(2) + ')">\n' +
                  '      <path d="' + pathD + '" fill="#000000" fill-rule="evenodd"/>\n' +
                  '    </g>\n';
      } else {
        const cleanFont = ff.replace(/"/g, "'");
        textStr = '    <g id="wordGroup" transform="translate(' + SVGApp.state.textRelX.toFixed(2) + ',' + SVGApp.state.textRelY.toFixed(2) + ')">\n' +
                  '      <text x="0" y="0" font-family="' + cleanFont + '" font-size="100" text-anchor="middle" dominant-baseline="central" fill="#000000">' +
                  this.escXml(txt) +
                  '</text>\n' +
                  '    </g>\n';
      }
    }

    // 2. تصدير الشكل كمسار فيكتور
    let shapeStr = '';
    const raw = SVGApp.shapes.getShapeContent(SVGApp.state.activeShapeKey);
    if (showShape && raw) {
      const gTemp = SVGApp.dom.shapeContainer.querySelector('g');
      const transformAttr = gTemp ? (gTemp.getAttribute('transform') || '') : '';
      shapeStr = '    <g id="shapeGroup" transform="translate(' + SVGApp.state.shapeRelX.toFixed(2) + ',' + SVGApp.state.shapeRelY.toFixed(2) + ')">\n' +
                 '      <g transform="' + transformAttr + '" fill="#000000">\n        ' +
                 raw +
                 '\n      </g>\n    </g>\n';
    }

    const masterTransform = SVGApp.dom.masterDesignGroup.getAttribute('transform') || '';
    const minX = -targetWPx / 2;
    const minY = -targetHPx / 2;

    return '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' +
      '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n' +
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1"\n' +
      '     width="' + SVGApp.state.manualWidth_cm.toFixed(2) + 'cm"\n' +
      '     height="' + SVGApp.state.manualHeight_cm.toFixed(2) + 'cm"\n' +
      '     viewBox="' + minX.toFixed(2) + ' ' + minY.toFixed(2) + ' ' + targetWPx.toFixed(2) + ' ' + targetHPx.toFixed(2) + '">\n' +
      '  <g id="design" transform="' + masterTransform + '">\n' +
      textStr +
      shapeStr +
      '  </g>\n' +
      '</svg>';
  },

  /**
   * تنزيل أي نص SVG كملف .svg صالح 100%
   */
  downloadSvgFile(svgContent, customFilename) {
    let filename = customFilename || ('design_' + Math.round(SVGApp.state.manualWidth_cm) + 'x' + Math.round(SVGApp.state.manualHeight_cm) + 'cm.svg');
    if (!filename.toLowerCase().endsWith('.svg')) {
      filename += '.svg';
    }

    let blob = null;
    try {
      blob = new Blob(['\uFEFF' + svgContent], { type: 'image/svg+xml;charset=utf-8' });
    } catch (e) {}

    if (blob && window.URL && window.URL.createObjectURL) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (a.parentNode) document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 5000);
    } else {
      const dataUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgContent);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = dataUri;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (a.parentNode) document.body.removeChild(a);
      }, 2000);
    }
  },

  /**
   * تصدير التصميم الحالي مباشرة كملف SVG (خاص بالمدير)
   */
  exportSvg(customFilename) {
    const svgContent = this.generateSvgString();
    this.downloadSvgFile(svgContent, customFilename);
  },

  /**
   * ربط أحداث التصدير
   */
  bindEvents() {
    if (SVGApp.dom.exportBtn) {
      SVGApp.dom.exportBtn.addEventListener('click', () => this.exportSvg());
    }
  }
};
