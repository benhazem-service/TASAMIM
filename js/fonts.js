/**
 * ==========================================================================
 * إدارة الخطوط والمفضلة ورفع الخطوط للهاتف والحاسوب (Fonts Management)
 * ==========================================================================
 */

window.SVGApp = window.SVGApp || {};

SVGApp.fonts = {
  customFontCounter: 0,

  /**
   * حفظ الخطوط المفضلة في التخزين المحلي للمتصفح
   */
  saveFavFonts() {
    localStorage.setItem('favFonts', JSON.stringify(SVGApp.state.favoriteFonts));
  },

  /**
   * رسم وتحديث قائمة الخطوط المفضلة في الواجهة
   */
  renderFavList() {
    const list = SVGApp.dom.favList;
    if (!list) return;

    if (!SVGApp.state.favoriteFonts.length) {
      list.innerHTML = '<div style="font-size:.75rem;color:#94a3b8;text-align:center;padding:8px;">اختر خطاً ثم اضغط + أضف للمفضلة</div>';
      return;
    }

    list.innerHTML = '';
    SVGApp.state.favoriteFonts.forEach((fav, idx) => {
      const item = document.createElement('div');
      item.className = 'font-fav-item' + (SVGApp.dom.fontSelect.value === fav.value ? ' selected-font' : '');

      // زر الحذف (checkbox)
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true;
      cb.id = 'fav_' + idx;
      cb.addEventListener('change', () => {
        if (!cb.checked) {
          SVGApp.state.favoriteFonts = SVGApp.state.favoriteFonts.filter(f => f.value !== fav.value);
          this.saveFavFonts();
          this.renderFavList();
        }
      });

      // عنوان الخط بنمطه الفعلي
      const lbl = document.createElement('label');
      lbl.htmlFor = 'fav_' + idx;
      lbl.className = 'fav-label';
      lbl.textContent = fav.label;
      lbl.style.fontFamily = fav.value;

      // زر تطبيق الخط
      const useBtn = document.createElement('button');
      useBtn.className = 'fav-action-btn';
      useBtn.textContent = 'استخدم';
      useBtn.addEventListener('click', () => {
        let found = false;
        Array.from(SVGApp.dom.fontSelect.options).forEach(o => {
          if (o.value === fav.value) {
            o.selected = true;
            found = true;
          }
        });

        // إذا كان خط محلي لم يكن مدرجاً مسبقاً في القائمة
        if (!found) {
          const o = document.createElement('option');
          o.value = fav.value;
          o.textContent = fav.label;
          SVGApp.dom.localFontsGroup.appendChild(o);
          o.selected = true;
        }

        SVGApp.canvas.renderDesign();
        this.renderFavList();
      });

      item.appendChild(cb);
      item.appendChild(lbl);
      item.appendChild(useBtn);
      list.appendChild(item);
    });
  },

  /**
   * إضافة الخط المحدد حالياً إلى المفضلة
   */
  addFavoriteFont() {
    const sel = SVGApp.dom.fontSelect.options[SVGApp.dom.fontSelect.selectedIndex];
    const addBtn = SVGApp.dom.addFavBtn;
    if (!sel || !sel.value) return;

    if (!SVGApp.state.favoriteFonts.some(f => f.value === sel.value)) {
      SVGApp.state.favoriteFonts.push({ value: sel.value, label: sel.text });
      this.saveFavFonts();
      this.renderFavList();
      addBtn.textContent = '✓ تمت الإضافة';
    } else {
      addBtn.textContent = '⚠ موجود مسبقاً';
    }

    setTimeout(() => {
      addBtn.textContent = '+ أضف للمفضلة';
    }, 1500);
  },

  /**
   * قراءة جميع خطوط حاسوب المستخدم (Chrome / Edge Desktop)
   */
  async loadLocalFonts() {
    if ('queryLocalFonts' in window) {
      try {
        const availableFonts = await window.queryLocalFonts();
        const uniqueFamilies = Array.from(new Set(availableFonts.map(f => f.family))).sort();

        SVGApp.dom.localFontsGroup.innerHTML = '';
        uniqueFamilies.forEach(fam => {
          const opt = document.createElement('option');
          opt.value = '"' + fam + '"';
          opt.textContent = fam;
          SVGApp.dom.localFontsGroup.appendChild(opt);
        });

        SVGApp.dom.loadFontsBtn.textContent = 'تم تحميل ' + uniqueFamilies.length + ' خط ✓';
        SVGApp.dom.loadFontsBtn.disabled = true;
      } catch (err) {
        alert('تم رفض إذن الوصول لخطوط الحاسوب.');
      }
    } else if (SVGApp.dom.fontFileInput) {
      SVGApp.dom.fontFileInput.click();
    }
  },

  /**
   * رفع ملف خط مخصص (.ttf / .otf / .woff2) يعمل على جميع الهواتف والحواسيب
   */
  async handleCustomFontUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      this.customFontCounter++;
      const cleanLabel = file.name.replace(/\.(ttf|otf|woff2?|TTF|OTF|WOFF2?)$/, '');
      const familyId = 'CustomUploadedFont_' + this.customFontCounter;

      const fontFace = new FontFace(familyId, buffer);
      const loadedFace = await fontFace.load();
      document.fonts.add(loadedFace);

      const opt = document.createElement('option');
      opt.value = "'" + familyId + "', sans-serif";
      opt.textContent = '🔤 ' + cleanLabel;
      SVGApp.dom.localFontsGroup.appendChild(opt);
      opt.selected = true;

      SVGApp.canvas._cachedTextKey = null;
      SVGApp.canvas.renderDesign();
      this.renderFavList();
    } catch (err) {
      alert('تعذر قراءة ملف الخط. يرجى اختيار ملف خط صالح بصيغة TTF أو OTF.');
    }
    e.target.value = '';
  },

  /**
   * ربط أحداث الخطوط
   */
  bindEvents() {
    if (SVGApp.dom.loadFontsBtn) {
      if (!('queryLocalFonts' in window)) {
        SVGApp.dom.loadFontsBtn.style.display = 'none';
      }
      SVGApp.dom.loadFontsBtn.addEventListener('click', () => this.loadLocalFonts());
    }

    if (SVGApp.dom.fontFileInput) {
      SVGApp.dom.fontFileInput.addEventListener('change', (e) => this.handleCustomFontUpload(e));
    }

    if (SVGApp.dom.addFavBtn) {
      SVGApp.dom.addFavBtn.addEventListener('click', () => this.addFavoriteFont());
    }

    this.renderFavList();
  }
};
