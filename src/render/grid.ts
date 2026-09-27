import { camera as cam } from './camera';
import { arrow } from './draw';
import { settings } from '../app/state';
import { history } from '../app/history';
import type { ViewMode } from '../scenes/schema';

/** 背景色区分两种视角：垂直=天空立面，平面=桌面俯视 */
export function drawGrid(ctx: CanvasRenderingContext2D, view: ViewMode, gravity: number): void {
  const { w, h } = cam;
  if (view === 'vertical') {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#d8ecfa');
    g.addColorStop(1, '#f7fbff');
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = '#edf1f5';
  }
  ctx.fillRect(0, 0, w, h);

  if (settings.showGrid) {
    const x0 = cam.s2wx(0);
    const x1 = cam.s2wx(w);
    const yBot = cam.s2wy(h);
    const yTop = cam.s2wy(0);
    ctx.lineWidth = 1;
    for (let gx = Math.ceil(x0 / 0.5) * 0.5; gx <= x1; gx += 0.5) {
      const major = Math.abs(gx - Math.round(gx)) < 1e-6;
      ctx.strokeStyle = major ? 'rgba(100,116,139,0.30)' : 'rgba(100,116,139,0.12)';
      const sx = Math.round(cam.w2sx(gx)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, h);
      ctx.stroke();
      if (major) {
        ctx.fillStyle = 'rgba(71,85,105,0.75)';
        ctx.font = '10px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(String(Math.round(gx)), sx, h - 6);
      }
    }
    for (let gy = Math.ceil(yBot / 0.5) * 0.5; gy <= yTop; gy += 0.5) {
      const major = Math.abs(gy - Math.round(gy)) < 1e-6;
      ctx.strokeStyle = major ? 'rgba(100,116,139,0.30)' : 'rgba(100,116,139,0.12)';
      const sy = Math.round(cam.w2sy(gy)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
      ctx.stroke();
      if (major) {
        ctx.fillStyle = 'rgba(71,85,105,0.75)';
        ctx.font = '10px system-ui';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(String(Math.round(gy)), 4, sy - 3);
      }
    }
  }

  // 重力指示徽章（屏幕右上角）
  ctx.save();
  const bx = w - 132;
  const by = 12;
  const bw = 120;
  const bh = 42;
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.strokeStyle = 'rgba(148,163,184,0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 8);
  ctx.fill();
  ctx.stroke();
  if (view === 'vertical') {
    arrow(ctx, bx + 22, by + 11, bx + 22, by + 31, '#2563eb', 2.5);
    ctx.fillStyle = '#1e3a8a';
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`g = ${gravity.toFixed(2)} m/s²`, bx + 38, by + 21);
    ctx.fillStyle = '#64748b';
    ctx.font = '10px system-ui';
    ctx.fillText('方向竖直向下', bx + 38, by + 34);
  } else {
    ctx.fillStyle = '#1e3a8a';
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('重力 ⊙', bx + 12, by + 21);
    ctx.fillStyle = '#64748b';
    ctx.font = '10px system-ui';
    ctx.fillText('垂直屏幕向内（俯视）', bx + 12, by + 34);
  }
  ctx.restore();

  // 撤销 / 重做按钮（重力徽章正下方；无对应历史时置灰不可点）
  for (const b of topRightButtons(w)) {
    ctx.save();
    ctx.fillStyle = !b.enabled
      ? 'rgba(241,245,249,0.72)'
      : b.hover
        ? '#ffffff'
        : 'rgba(255,255,255,0.82)';
    ctx.strokeStyle = b.enabled && b.hover ? '#2563eb' : 'rgba(148,163,184,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = b.enabled ? '#1e3a8a' : '#94a3b8';
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.id === 'undo' ? '↶ 撤销' : '↷ 重做', b.x + b.w / 2, b.y + b.h / 2);
    ctx.restore();
  }
}

/* ---------------- 撤销 / 重做按钮（画布右上角，重力徽章下方） ---------------- */

interface CornerBtn {
  id: 'undo' | 'redo';
  x: number;
  y: number;
  w: number;
  h: number;
  enabled: boolean;
  hover: boolean;
}

let cornerHover: 'undo' | 'redo' | null = null;

/** 布局：与徽章同宽（120px）对半分，间距 4px；徽章下缘 54，留 8px 空隙 */
export function topRightButtons(w: number): CornerBtn[] {
  const x0 = w - 132;
  const bw = 58;
  const bh = 26;
  return (['undo', 'redo'] as const).map((id, i) => ({
    id,
    x: x0 + i * (bw + 4),
    y: 62,
    w: bw,
    h: bh,
    enabled: id === 'undo' ? history.canUndo() : history.canRedo(),
    hover: cornerHover === id,
  }));
}

/** 命中测试：落在任一按钮矩形内（含置灰按钮）都返回该按钮，
 *  由调用方决定是否执行——置灰按钮也要吞掉点击，防止穿透到画布误创建物体 */
export function hitTopRightButton(w: number, sx: number, sy: number): CornerBtn | null {
  cornerHover = null;
  for (const b of topRightButtons(w)) {
    if (sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h) {
      if (b.enabled) cornerHover = b.id;
      return b;
    }
  }
  return null;
}
