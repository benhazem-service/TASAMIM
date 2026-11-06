/**
 * ==========================================================================
 * إدارة حالة التطبيق (Application State)
 * ==========================================================================
 */

window.SVGApp = window.SVGApp || {};

SVGApp.state = {
  // الأشكال المرفوعة من المستخدم
  customShapes: {},

  // الشكل النشط حالياً
  activeShapeKey: 'crescent',

  // الخطوط المفضلة (محفوظة في التخزين المحلي)
  favoriteFonts: JSON.parse(localStorage.getItem('favFonts') || '[]'),

  // وضع الرؤية ومستوى التكبير
  currentZoomMode: 'fit',
  customZoomLevel: 1.0,

  // القياسات اليدوية الإجمالية (بالسنتيمتر): (الكلمة + الشكل = القياس المدخل)
  manualWidth_cm: 25.0,
  manualHeight_cm: 10.0,

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
