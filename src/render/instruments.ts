import { camera as cam } from './camera';
import { arrow } from './draw';
import type { MeasureState } from '../app/state';

/** 屏幕测量绘制：标尺（两点距离）/ 量角器（三点夹角） */
export function drawMeasure(ctx: CanvasRenderingContext2D, ms: MeasureState): void {
  const pts = ms.pts.map(p => ({ x: cam.w2sx(p[0]), y: cam.w2sy(p[1]) }));
  ctx.save();
  ctx.strokeStyle = '#dc2626';
  ctx.fillStyle = '#dc2626';
  ctx.lineWidth = 1.6;
  ctx.setLineDash([6, 4]);
  for (const p of pts) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (ms.kind === 'ruler') {
    if (pts.length >= 2) {
      arrow(ctx, pts[0].x, pts[0].y, pts[1].x, pts[1].y, '#dc2626', 1.6);
      const wx = ms.pts[1][0] - ms.pts[0][0];
      const wy = ms.pts[1][1] - ms.pts[0][1];
      const d = Math.hypot(wx, wy);
      const mx = (pts[0].x + pts[1].x) / 2;
      const my = (pts[0].y + pts[1].y) / 2;
      label(ctx, mx, my - 10, `${d.toFixed(2)} m`);
    }
  } else {
    // 量角器：顶点 + 两条边 + 夹角
    if (pts.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.stroke();
    }
    if (pts.length === 3) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[2].x, pts[2].y);
      ctx.stroke();
      // 夹角：边1 → 边2 的夹角（0~180°）
      const a1 = Math.atan2(ms.pts[1][1] - ms.pts[0][1], ms.pts[1][0] - ms.pts[0][0]);
      const a2 = Math.atan2(ms.pts[2][1] - ms.pts[0][1], ms.pts[2][0] - ms.pts[0][0]);
      let deg = ((a1 - a2) * 180) / Math.PI;
      while (deg < 0) deg += 360;
      while (deg > 180) deg = 360 - deg;
      // 弧线（屏幕坐标 y 翻转：世界角度取负）
      const r = 34;
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, r, -a1, -a2, deg > 0 ? a2 < a1 : a2 > a1);
      ctx.stroke();
      label(ctx, pts[0].x + 44, pts[0].y - 26, `${deg.toFixed(1)}°`);
    }
  }
  ctx.restore();
}

function label(ctx: CanvasRenderingContext2D, x: number, y: number, text: string): void {
  ctx.save();
  ctx.font = 'bold 12px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 10;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.strokeStyle = 'rgba(220,38,38,0.6)';
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - 10, w, 20, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#b91c1c';
  ctx.fillText(text, x, y);
  ctx.restore();
}
