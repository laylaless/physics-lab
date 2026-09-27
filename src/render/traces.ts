import { camera as cam } from './camera';
import { settings } from '../app/state';
import type { BodyRecord } from '../core/bodies';

/** 轨迹线 + 频闪打点（模拟"打点计时器 / 频闪照片"） */
export function drawTraces(ctx: CanvasRenderingContext2D, rec: BodyRecord): void {
  if (!settings.showTrace && !settings.showStrobe) return;
  const color = rec.meta.color ?? '#3b82f6';
  ctx.save();
  if (settings.showStrobe) {
    ctx.fillStyle = color;
    for (const pt of rec.strobePts) {
      ctx.beginPath();
      ctx.arc(cam.w2sx(pt.x), cam.w2sy(pt.y), 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (settings.showTrace && rec.tracePts.length > 1) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cam.w2sx(rec.tracePts[0].x), cam.w2sy(rec.tracePts[0].y));
    for (let i = 1; i < rec.tracePts.length; i++) {
      ctx.lineTo(cam.w2sx(rec.tracePts[i].x), cam.w2sy(rec.tracePts[i].y));
    }
    ctx.stroke();
  }
  ctx.restore();
}
