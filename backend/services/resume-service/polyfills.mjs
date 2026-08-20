// Polyfills for pdfjs-dist (requires browser APIs not available in Node.js)
// This file is loaded via --import flag before any ES modules are resolved

globalThis.DOMMatrix = class DOMMatrix {
  constructor() {
    this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
    this.m11 = 1; this.m12 = 0; this.m13 = 0; this.m14 = 0;
    this.m21 = 0; this.m22 = 1; this.m23 = 0; this.m24 = 0;
    this.m31 = 0; this.m32 = 0; this.m33 = 1; this.m34 = 0;
    this.m41 = 0; this.m42 = 0; this.m43 = 0; this.m44 = 1;
    this.is2D = true; this.isIdentity = true;
  }
  inverse() { return new DOMMatrix(); }
  multiply() { return new DOMMatrix(); }
  translate() { return new DOMMatrix(); }
  scale() { return new DOMMatrix(); }
  rotate() { return new DOMMatrix(); }
  transformPoint() { return { x: 0, y: 0, z: 0, w: 1 }; }
  static fromMatrix() { return new DOMMatrix(); }
  static fromFloat64Array() { return new DOMMatrix(); }
  static fromFloat32Array() { return new DOMMatrix(); }
};

globalThis.Path2D = class Path2D {
  constructor() {}
  addPath() {}
  moveTo() {}
  lineTo() {}
  bezierCurveTo() {}
  quadraticCurveTo() {}
  closePath() {}
  rect() {}
};

globalThis.ImageData = class ImageData {
  constructor(w, h) {
    this.width = w;
    this.height = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }
};
