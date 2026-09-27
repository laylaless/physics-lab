export class Camera {
  cx = 0; // 视口中心（世界坐标，米）
  cy = 0;
  ppm = 40; // pixels per meter
  w = 800;
  h = 600;

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
  }

  setViewport(cx: number, cy: number, widthM: number): void {
    this.cx = cx;
    this.cy = cy;
    this.ppm = this.w / widthM;
  }

  w2sx(x: number): number {
    return (x - this.cx) * this.ppm + this.w / 2;
  }

  /** 屏幕 y 向下、世界 y 向上，因此翻转 */
  w2sy(y: number): number {
    return this.h / 2 - (y - this.cy) * this.ppm;
  }

  s2wx(sx: number): number {
    return (sx - this.w / 2) / this.ppm + this.cx;
  }

  s2wy(sy: number): number {
    return this.cy - (sy - this.h / 2) / this.ppm;
  }

  zoomAt(sx: number, sy: number, factor: number): void {
    const wx = this.s2wx(sx);
    const wy = this.s2wy(sy);
    this.ppm = Math.min(240, Math.max(6, this.ppm * factor));
    // 缩放后保持光标下的世界点不动
    this.cx = wx - (sx - this.w / 2) / this.ppm;
    this.cy = wy + (sy - this.h / 2) / this.ppm;
  }

  panPx(dx: number, dy: number): void {
    this.cx -= dx / this.ppm;
    this.cy += dy / this.ppm;
  }
}

export const camera = new Camera();
