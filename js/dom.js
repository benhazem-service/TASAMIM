/**
 * ==========================================================================
 * مراجع عناصر الواجهة (DOM Elements Cache)
 * ==========================================================================
 */

window.SVGApp = window.SVGApp || {};

SVGApp.dom = {
  init() {
    // مدخلات التحكم والشريط الجانبي
    this.textInput = document.getElementById('textInput');
    this.fontSelect = document.getElementById('fontSelect');
    this.fontFileInput = document.getElementById('fontFileInput');
    this.loadFontsBtn = document.getElementById('loadFontsBtn');
    this.localFontsGroup = document.getElementById('localFontsGroup');
    this.addFavBtn = document.getElementById('addFavBtn');
    this.favList = document.getElementById('favList');
    this.svgFileInput = document.getElementById('svgFileInput');
    this.shapesGrid = document.getElementById('shapesGrid');
    this.shapePosition = document.getElementById('shapePosition');
    this.manualWidthInput = document.getElementById('manualWidthInput');
    this.manualHeightInput = document.getElementById('manualHeightInput');
    this.btnResetLayout = document.getElementById('btnResetLayout');

    // أدوات الزبون (الإرسال المشفر عبر الواتساب)
    this.customerPhoneInput = document.getElementById('customerPhoneInput');
    this.orderCodePreview = document.getElementById('orderCodePreview');
    this.whatsappSendBtn = document.getElementById('whatsappSendBtn');
    this.customerStatusMsg = document.getElementById('customerStatusMsg');

    // بوابة وخانة المدير (فك التشفير وتصدير SVG)
    this.adminToggleBtn = document.getElementById('adminToggleBtn');
    this.mobileAdminToggleBtn = document.getElementById('mobileAdminToggleBtn');
    this.adminAuthBox = document.getElementById('adminAuthBox');
    this.adminPinInput = document.getElementById('adminPinInput');
    this.adminPinSubmitBtn = document.getElementById('adminPinSubmitBtn');
    this.adminPinError = document.getElementById('adminPinError');
    this.adminSectionBody = document.getElementById('adminSectionBody');
    this.adminEncryptedFileInput = document.getElementById('adminEncryptedFileInput');
    this.adminDecodedInfo = document.getElementById('adminDecodedInfo');
    this.adminExportDecodedBtn = document.getElementById('adminExportDecodedBtn');
    this.adminDirectExportBtn = document.getElementById('adminDirectExportBtn');
    this.adminWhatsAppInput = document.getElementById('adminWhatsAppInput');
    this.adminResetCounterBtn = document.getElementById('adminResetCounterBtn');

    // أدوات تكبير وتصغير الشكل
    this.shapeScaleSlider = document.getElementById('shapeScaleSlider');
    this.shapeScaleVal = document.getElementById('shapeScaleVal');
    this.btnScaleDown = document.getElementById('btnScaleDown');
    this.btnScaleUp = document.getElementById('btnScaleUp');
    this.btnScaleReset = document.getElementById('btnScaleReset');

    // مساحة الرسم والبطاقة
    this.artboardContainer = document.getElementById('artboardContainer');
    this.artboardCard = document.getElementById('artboardCard');
    this.previewSvg = document.getElementById('previewSvg');

    // مجموعات وعناصر SVG للكلمة
    this.masterDesignGroup = document.getElementById('masterDesignGroup');
    this.textGroup = document.getElementById('textGroup');
    this.textHitArea = document.getElementById('textHitArea');
    this.textSelectionBox = document.getElementById('textSelectionBox');
    this.textLabelBadge = document.getElementById('textLabelBadge');
    this.svgText = document.getElementById('svgText');

    // مجموعات وعناصر SVG للشكل ومقابض التحجيم
    this.shapeGroup = document.getElementById('shapeGroup');
    this.shapeHitArea = document.getElementById('shapeHitArea');
    this.shapeSelectionBox = document.getElementById('shapeSelectionBox');
    this.shapeLabelBadge = document.getElementById('shapeLabelBadge');
    this.shapeContainer = document.getElementById('shapeContainer');
    this.handleTL = document.getElementById('handleTL');
    this.handleTR = document.getElementById('handleTR');
    this.handleBR = document.getElementById('handleBR');
    this.handleBL = document.getElementById('handleBL');

    // خطوط القياسات والتأطير
    this.guideLinesGroup = document.getElementById('guideLinesGroup');
    this.outerDesignRect = document.getElementById('outerDesignRect');
    this.topDimLine = document.getElementById('topDimLine');
    this.widthBadgeBg = document.getElementById('widthBadgeBg');
    this.widthLabel = document.getElementById('widthLabel');
    this.sideDimLine = document.getElementById('sideDimLine');
    this.heightBadgeBg = document.getElementById('heightBadgeBg');
    this.heightLabel = document.getElementById('heightLabel');

    // خطوط ومؤشرات التباعد
    this.separationGuideGroup = document.getElementById('separationGuideGroup');
    this.sepLine = document.getElementById('sepLine');
    this.sepBadgeRect = document.getElementById('sepBadgeRect');
    this.sepBadgeText = document.getElementById('sepBadgeText');

    // الأشرطة العائمة وأزرار الرؤية
    this.topInfoBar = document.getElementById('topInfoBar');
    this.infoW = document.getElementById('infoW');
    this.infoH = document.getElementById('infoH');
    this.infoSep = document.getElementById('infoSep');
    this.dragHint = document.getElementById('dragHint');
    this.btnFit = document.getElementById('btnFit');
    this.btn100 = document.getElementById('btn100');
    this.btnZoomOut = document.getElementById('btnZoomOut');
    this.btnZoomIn = document.getElementById('btnZoomIn');

    // شريط الهواتف والقائمة المتجاوبة
    this.sidebar = document.getElementById('sidebar');
    this.overlay = document.getElementById('overlay');
    this.menuToggle = document.getElementById('menuToggle');
    this.menuClose = document.getElementById('menuClose');

    // عناصر تثبيت التطبيق PWA على الهاتف
    this.mobileInstallBtn = document.getElementById('mobileInstallBtn');
    this.sidebarInstallBtn = document.getElementById('sidebarInstallBtn');
    this.pwaInstallBanner = document.getElementById('pwaInstallBanner');
    this.bannerInstallActionBtn = document.getElementById('bannerInstallActionBtn');
    this.bannerDismissBtn = document.getElementById('bannerDismissBtn');
  }
};
