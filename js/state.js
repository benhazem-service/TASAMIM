/**
 * ==========================================================================
 * إدارة حالة التطبيق (Application State)
 * ==========================================================================
 */

window.SVGApp = window.SVGApp || {};

SVGApp.state = {
  // الأشكال المرفوعة من المستخدم
  customShapes: {},

  // قائمة الأشكال المضافة في التصميم (يمكن إضافة أكثر من شكل أو تكراره وتحريك كل شكل على حدة)
  shapes: [
    {
      id: 'shape_1',
      key: 'crescent',
      relX: 140,
      relY: 0,
      scaleRatio: 1.0,
      localBox: { x: -50, y: -50, width: 100, height: 100 },
      innerTransform: ''
    }
  ],
  selectedShapeId: 'shape_1',
  nextShapeUid: 2,

  // الشكل النشط حالياً (للتوافق السريع)
  activeShapeKey: 'crescent',

  // الخطوط المفضلة (محفوظة في التخزين المحلي)
  favoriteFonts: JSON.parse(localStorage.getItem('favFonts') || '[]'),

  // حالة قفل التحريك اليدوي في مساحة العمل (الوضع الافتراضي: مقفل true)
  isDesignLocked: true,

  // وضع الرؤية ومستوى التكبير
  currentZoomMode: 'fit',
  customZoomLevel: 1.0,

  // القياسات اليدوية الإجمالية (بالسنتيمتر): (الكلمة + الشكل = القياس المدخل)
  manualWidth_cm: 20.0,
  manualHeight_cm: 4.0,

  // الإحداثيات والمقاييس النسبية للكلمة والشكل داخل التصميم
  textRelX: -120,
  textRelY: 0,
  shapeRelX: 140,
  shapeRelY: 0,
  shapeScaleRatio: 1.0,

  // أبعاد الحبر الفعلية للكلمة والشكل في الفضاء المحلي
  textLocalBox: { x: -100, y: -50, width: 200, height: 100 },
  shapeLocalBox: { x: -50, y: -50, width: 100, height: 100 },

  // حالة السحب والتحريك والتحجيم (Drag & Resize)
  activeDrag: null,
  dragStartClient: { x: 0, y: 0 },
  dragStartPos: { x: 0, y: 0 },
  dragStartScale: { x: 1, y: 1 },
  activeResize: false,
  resizeStartClient: { x: 0, y: 0 },
  resizeStartScale: 1.0,
  resizeStartCenter: { x: 0, y: 0 },
  resizeStartDist: 50
};
