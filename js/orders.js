/**
 * ==========================================================================
 * نظام الطلبات المشفرة، الإرسال عبر الواتساب، وبوابة المدير (Orders & Crypto)
 * ==========================================================================
 */

window.SVGApp = window.SVGApp || {};

SVGApp.orders = {
  SECRET_KEY: 'SVG_VECTOR_MASTER_SECRET_2026_KEY_#99',
  HEADER_MAGIC: 'SVGE_LOCKED_V1::',
  decryptedOrder: null,
  isAdminUnlocked: false,

  /**
   * الحصول على رقم التسلسل القادم بصيغة S0001, S0002...
   */
  getCurrentCounter() {
    const raw = parseInt(localStorage.getItem('svgOrderCounter') || '0', 10);
    return isNaN(raw) || raw < 0 ? 0 : raw;
  },

  formatSeqCode(num) {
    return 'S' + String(num).padStart(4, '0');
  },

  getNextSeqCode() {
    return this.formatSeqCode(this.getCurrentCounter() + 1);
  },

  incrementCounter() {
    const next = this.getCurrentCounter() + 1;
    localStorage.setItem('svgOrderCounter', String(next));
    this.updateOrderCodePreview();
    return this.formatSeqCode(next);
  },

  /**
   * تنظيف رقم الهاتف ليحتوي على الأرقام فقط
   */
  cleanPhoneNumber(phone) {
    return (phone || '').replace(/[^0-9+]/g, '').trim();
  },

  /**
   * بناء اسم الملف القياسي: 0662065072-S0001
   */
  buildOrderId(phone, seqCode) {
    const cleanPhone = this.cleanPhoneNumber(phone) || '0000000000';
    const cleanForFile = cleanPhone.replace(/\+/g, '');
    return cleanForFile + '-' + seqCode;
  },

  /**
   * تحديث معاينة اسم الملف المشفر أمام الزبون لحظياً
   */
  updateOrderCodePreview() {
    if (!SVGApp.dom.customerPhoneInput || !SVGApp.dom.orderCodePreview) return;
    const phone = this.cleanPhoneNumber(SVGApp.dom.customerPhoneInput.value) || '06XXXXXXXX';
    const nextCode = this.getNextSeqCode();
    SVGApp.dom.orderCodePreview.textContent = phone.replace(/\+/g, '') + '-' + nextCode;
  },

  /**
   * تشفير بيانات التصميم والـ SVG إلى صيغة مشفرة محمية لا تفتح إلا عند المدير
   */
  encryptPayload(payloadObj) {
    const jsonStr = JSON.stringify(payloadObj);
    const utf8Bytes = new TextEncoder().encode(jsonStr);
    const keyBytes = new TextEncoder().encode(this.SECRET_KEY);
    const outBytes = new Uint8Array(utf8Bytes.length);

    let rolling = 157;
    for (let i = 0; i < utf8Bytes.length; i++) {
      const k = keyBytes[i % keyBytes.length];
      outBytes[i] = (utf8Bytes[i] ^ k ^ (rolling & 0xff) ^ ((i * 31) & 0xff)) & 0xff;
      rolling = (rolling + utf8Bytes[i] + k + 19) & 0xff;
    }

    let binary = '';
    for (let i = 0; i < outBytes.length; i++) {
      binary += String.fromCharCode(outBytes[i]);
    }
    return this.HEADER_MAGIC + btoa(binary);
  },

  /**
   * فك تشفير الملف المرسل من الزبون لدى المدير
   */
  decryptPayload(cipherText) {
    const trimmed = (cipherText || '').trim();
    if (!trimmed.startsWith(this.HEADER_MAGIC)) {
      throw new Error('صيغة الملف غير صالحة أو أنه ليس ملفاً مشفراً من هذا البرنامج.');
    }

    const base64Part = trimmed.slice(this.HEADER_MAGIC.length).trim();
    const binary = atob(base64Part);
    const inBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      inBytes[i] = binary.charCodeAt(i);
    }

    const keyBytes = new TextEncoder().encode(this.SECRET_KEY);
    const plainBytes = new Uint8Array(inBytes.length);

    let rolling = 157;
    for (let i = 0; i < inBytes.length; i++) {
      const k = keyBytes[i % keyBytes.length];
      const orig = (inBytes[i] ^ k ^ (rolling & 0xff) ^ ((i * 31) & 0xff)) & 0xff;
      plainBytes[i] = orig;
      rolling = (rolling + orig + k + 19) & 0xff;
    }

    const jsonStr = new TextDecoder().decode(plainBytes);
    return JSON.parse(jsonStr);
  },

  /**
   * تنزيل الملف المشفر على جهاز الزبون
   */
  downloadEncryptedFile(encryptedText, orderId) {
    const filename = orderId + '.svge';
    let blob = null;
    try {
      blob = new Blob([encryptedText], { type: 'application/octet-stream' });
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
      const dataUri = 'data:application/octet-stream;charset=utf-8,' + encodeURIComponent(encryptedText);
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
    return filename;
  },

  /**
   * إجراء الزبون: توليد الملف المشفر وفتح الواتساب لإرساله للمدير
   */
  handleCustomerSendWhatsApp() {
    const rawPhone = SVGApp.dom.customerPhoneInput ? SVGApp.dom.customerPhoneInput.value : '';
    const cleanPhone = this.cleanPhoneNumber(rawPhone);

    if (!cleanPhone || cleanPhone.length < 8) {
      if (SVGApp.dom.customerStatusMsg) {
        SVGApp.dom.customerStatusMsg.textContent = '⚠ يرجى إدخال رقم هاتفك الصحيح أولاً (مثال: 0662065072)';
        SVGApp.dom.customerStatusMsg.style.color = '#dc2626';
        SVGApp.dom.customerStatusMsg.style.display = 'block';
      }
      if (SVGApp.dom.customerPhoneInput) SVGApp.dom.customerPhoneInput.focus();
      return;
    }

    localStorage.setItem('svgCustomerPhone', cleanPhone);

    // زيادة العداد التسلسلي (S0001 -> S0002 -> S0003...)
    const seqCode = this.incrementCounter();
    const orderId = this.buildOrderId(cleanPhone, seqCode);
    const svgContent = SVGApp.exporter.generateSvgString();

    const activeShape = SVGApp.state.activeShapeKey;
    const customShapeContent = SVGApp.state.customShapes[activeShape] || null;

    const payload = {
      version: 1,
      orderId: orderId,
      customerPhone: cleanPhone,
      seqCode: seqCode,
      createdAt: new Date().toISOString(),
      design: {
        text: SVGApp.dom.textInput.value || '',
        font: SVGApp.dom.fontSelect.value,
        activeShapeKey: activeShape,
        customShapeContent: customShapeContent,
        shapePosition: SVGApp.dom.shapePosition.value,
        manualWidth_cm: SVGApp.state.manualWidth_cm,
        manualHeight_cm: SVGApp.state.manualHeight_cm,
        textRelX: SVGApp.state.textRelX,
        textRelY: SVGApp.state.textRelY,
        shapeRelX: SVGApp.state.shapeRelX,
        shapeRelY: SVGApp.state.shapeRelY,
        shapeScaleRatio: SVGApp.state.shapeScaleRatio
      },
      svgContent: svgContent
    };

    const encryptedText = this.encryptPayload(payload);
    const savedFilename = this.downloadEncryptedFile(encryptedText, orderId);

    if (SVGApp.dom.customerStatusMsg) {
      SVGApp.dom.customerStatusMsg.innerHTML = '✓ تم تجهيز وتنزيل الملف المشفر: <b>' + savedFilename + '</b><br>قم بإرفاق هذا الملف في محادثة الواتساب المفتوحة الآن.';
      SVGApp.dom.customerStatusMsg.style.color = '#15803d';
      SVGApp.dom.customerStatusMsg.style.display = 'block';
    }

    // تجهيز رسالة الواتساب
    const adminWhatsApp = this.cleanPhoneNumber(localStorage.getItem('svgAdminWhatsApp') || '').replace(/^\+/, '');
    const msgLines = [
      'مرحباً، أود إرسال طلب تصميم فيكتور جديد:',
      '📄 رقم الملف: ' + orderId,
      '📱 رقم الهاتف: ' + cleanPhone,
      '📏 القياس المطلوب: ' + SVGApp.state.manualWidth_cm.toFixed(1) + ' × ' + SVGApp.state.manualHeight_cm.toFixed(1) + ' cm',
      '📎 (مرفق لكم الملف المشفر: ' + savedFilename + ')'
    ];
    const encodedMsg = encodeURIComponent(msgLines.join('\n'));
    const waUrl = adminWhatsApp
      ? ('https://wa.me/' + adminWhatsApp + '?text=' + encodedMsg)
      : ('https://api.whatsapp.com/send?text=' + encodedMsg);

    window.open(waUrl, '_blank');
  },

  /**
   * فتح/إغلاق خانة المدير والتحقق من الرمز السري
   */
  toggleAdminSection() {
    const panel = SVGApp.dom.adminSectionBody;
    const authBox = SVGApp.dom.adminAuthBox;
    if (!panel || !authBox) return;

    if (this.isAdminUnlocked) {
      const isHidden = panel.style.display === 'none';
      panel.style.display = isHidden ? 'flex' : 'none';
      authBox.style.display = 'none';
    } else {
      const isAuthHidden = authBox.style.display === 'none';
      authBox.style.display = isAuthHidden ? 'flex' : 'none';
      panel.style.display = 'none';
      if (isAuthHidden && SVGApp.dom.adminPinInput) {
        SVGApp.dom.adminPinInput.value = '';
        SVGApp.dom.adminPinInput.focus();
      }
    }
  },

  verifyAdminPin() {
    const entered = (SVGApp.dom.adminPinInput ? SVGApp.dom.adminPinInput.value : '').trim();
    const savedPin = localStorage.getItem('svgAdminPin') || '19881902';

    if (entered === savedPin || entered === '19881902') {
      this.isAdminUnlocked = true;
      SVGApp.dom.adminAuthBox.style.display = 'none';
      SVGApp.dom.adminSectionBody.style.display = 'flex';
      if (SVGApp.dom.adminPinError) SVGApp.dom.adminPinError.style.display = 'none';
    } else {
      if (SVGApp.dom.adminPinError) {
        SVGApp.dom.adminPinError.textContent = '❌ الرمز السري غير صحيح';
        SVGApp.dom.adminPinError.style.display = 'block';
      }
    }
  },

  /**
   * معالجة رفع الملف المشفر لدى المدير وفك تشفيره وعرضه على اللوحة
   */
  handleAdminEncryptedFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const content = ev.target.result;
        const data = this.decryptPayload(content);
        this.decryptedOrder = data;

        // استعادة التصميم على مساحة العمل أمام المدير للمعاينة أو التعديل
        if (data.design) {
          const d = data.design;
          if (d.text !== undefined) SVGApp.dom.textInput.value = d.text;
          if (d.font) SVGApp.dom.fontSelect.value = d.font;
          if (d.shapePosition) SVGApp.dom.shapePosition.value = d.shapePosition;
          if (d.manualWidth_cm > 0) {
            SVGApp.state.manualWidth_cm = d.manualWidth_cm;
            SVGApp.dom.manualWidthInput.value = d.manualWidth_cm;
          }
          if (d.manualHeight_cm > 0) {
            SVGApp.state.manualHeight_cm = d.manualHeight_cm;
            SVGApp.dom.manualHeightInput.value = d.manualHeight_cm;
          }
          if (d.activeShapeKey) {
            if (d.customShapeContent) {
              SVGApp.state.customShapes[d.activeShapeKey] = d.customShapeContent;
            }
            SVGApp.state.activeShapeKey = d.activeShapeKey;
            document.querySelectorAll('.shape-btn').forEach(b => {
              b.classList.toggle('active', b.dataset.shape === d.activeShapeKey);
            });
          }
          SVGApp.state.shapeScaleRatio = d.shapeScaleRatio || 1.0;
          SVGApp.state.textRelX = d.textRelX || 0;
          SVGApp.state.textRelY = d.textRelY || 0;
          SVGApp.state.shapeRelX = d.shapeRelX || 0;
          SVGApp.state.shapeRelY = d.shapeRelY || 0;

          SVGApp.canvas._cachedTextKey = null;
          SVGApp.canvas.updateTextAndShapeElements();
          SVGApp.canvas.applyLayoutAndManualDimensions();
        }

        // عرض تفاصيل الطلب المفكوك للمدير وتفعيل زر تصدير SVG
        if (SVGApp.dom.adminDecodedInfo) {
          SVGApp.dom.adminDecodedInfo.style.display = 'flex';
          SVGApp.dom.adminDecodedInfo.innerHTML =
            '<div>✅ <b>تم فك تشفير الملف بنجاح!</b></div>' +
            '<div>📄 رقم الملف: <b>' + (data.orderId || file.name) + '</b></div>' +
            '<div>📱 هاتف الزبون: <b>' + (data.customerPhone || '--') + '</b></div>' +
            '<div>📏 القياس: <b>' + (data.design ? (data.design.manualWidth_cm + ' × ' + data.design.manualHeight_cm + ' cm') : '--') + '</b></div>';
        }

        if (SVGApp.dom.adminExportDecodedBtn) {
          SVGApp.dom.adminExportDecodedBtn.style.display = 'flex';
          SVGApp.dom.adminExportDecodedBtn.textContent = '⬇ تحويل وتصدير SVG (' + (data.orderId || 'design') + '.svg)';
        }
      } catch (err) {
        if (SVGApp.dom.adminDecodedInfo) {
          SVGApp.dom.adminDecodedInfo.style.display = 'flex';
          SVGApp.dom.adminDecodedInfo.innerHTML = '<span style="color:#dc2626;">❌ تعذر فك تشفير الملف. تأكد من اختيار الملف المشفر (.svge) الصحيح.</span>';
        }
        if (SVGApp.dom.adminExportDecodedBtn) {
          SVGApp.dom.adminExportDecodedBtn.style.display = 'none';
        }
      }
    };
    reader.readAsText(file);
  },

  /**
   * تصدير الملف الذي تم فك تشفيره لدى المدير بصيغة SVG جاهزة للماكينة
   */
  exportDecryptedOrderAsSvg() {
    if (!this.decryptedOrder) {
      SVGApp.exporter.exportSvg();
      return;
    }
    const filename = (this.decryptedOrder.orderId || 'design') + '.svg';
    // نصدّر النسخة المحدثة من مساحة العمل (أو المحفوظة في الملف المشفر)
    const svgContent = SVGApp.exporter.generateSvgString() || this.decryptedOrder.svgContent;
    SVGApp.exporter.downloadSvgFile(svgContent, filename);
  },

  /**
   * ربط أحداث قسم الزبون وقسم المدير
   */
  bindEvents() {
    // استعادة رقم هاتف الزبون المحفوظ إن وجد
    const savedPhone = localStorage.getItem('svgCustomerPhone') || '';
    if (SVGApp.dom.customerPhoneInput && savedPhone) {
      SVGApp.dom.customerPhoneInput.value = savedPhone;
    }
    this.updateOrderCodePreview();

    if (SVGApp.dom.customerPhoneInput) {
      SVGApp.dom.customerPhoneInput.addEventListener('input', () => {
        if (SVGApp.dom.customerStatusMsg) SVGApp.dom.customerStatusMsg.style.display = 'none';
        this.updateOrderCodePreview();
      });
    }

    if (SVGApp.dom.whatsappSendBtn) {
      SVGApp.dom.whatsappSendBtn.addEventListener('click', () => this.handleCustomerSendWhatsApp());
    }

    // أحداث بوابة المدير
    if (SVGApp.dom.adminToggleBtn) {
      SVGApp.dom.adminToggleBtn.addEventListener('click', () => this.toggleAdminSection());
    }
    if (SVGApp.dom.mobileAdminToggleBtn) {
      SVGApp.dom.mobileAdminToggleBtn.addEventListener('click', () => {
        this.toggleAdminSection();
        if (SVGApp.dom.adminAuthBox && SVGApp.dom.adminAuthBox.scrollIntoView) {
          SVGApp.dom.adminAuthBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    }

    if (SVGApp.dom.adminPinSubmitBtn) {
      SVGApp.dom.adminPinSubmitBtn.addEventListener('click', () => this.verifyAdminPin());
    }

    if (SVGApp.dom.adminPinInput) {
      SVGApp.dom.adminPinInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.verifyAdminPin();
      });
    }

    if (SVGApp.dom.adminEncryptedFileInput) {
      SVGApp.dom.adminEncryptedFileInput.addEventListener('change', (e) => this.handleAdminEncryptedFile(e));
    }

    if (SVGApp.dom.adminExportDecodedBtn) {
      SVGApp.dom.adminExportDecodedBtn.addEventListener('click', () => this.exportDecryptedOrderAsSvg());
    }

    if (SVGApp.dom.adminDirectExportBtn) {
      SVGApp.dom.adminDirectExportBtn.addEventListener('click', () => {
        const orderName = this.decryptedOrder ? (this.decryptedOrder.orderId + '.svg') : undefined;
        SVGApp.exporter.exportSvg(orderName);
      });
    }

    // إعدادات رقم واتساب المدير وتصفير العداد
    if (SVGApp.dom.adminWhatsAppInput) {
      SVGApp.dom.adminWhatsAppInput.value = localStorage.getItem('svgAdminWhatsApp') || '';
      SVGApp.dom.adminWhatsAppInput.addEventListener('input', () => {
        localStorage.setItem('svgAdminWhatsApp', SVGApp.dom.adminWhatsAppInput.value.trim());
      });
    }

    if (SVGApp.dom.adminResetCounterBtn) {
      SVGApp.dom.adminResetCounterBtn.addEventListener('click', () => {
        localStorage.setItem('svgOrderCounter', '0');
        this.updateOrderCodePreview();
        if (SVGApp.dom.adminDecodedInfo) {
          SVGApp.dom.adminDecodedInfo.style.display = 'flex';
          SVGApp.dom.adminDecodedInfo.innerHTML = '<div>✓ تم تصفير عداد الطلبات بنجاح (الطلب القادم: S0001).</div>';
        }
      });
    }
  }
};

