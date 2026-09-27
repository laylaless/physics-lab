import { camera as cam } from './camera';
import type { BodyRecord } from '../core/bodies';
import { wedgeVerts, arcBaseOutline, arcBaseRect } from '../core/geometry';
import { jointEnds, type JointRecord } from '../core/joints';
import type { PendingLink } from '../app/state';

const COL = {
  rod: 'rgba(51,65,85,0.9)',
  rope: 'rgba(124,45,18,0.9)',
  hinge: 'rgba(15,118,110,0.95)',
  slider: 'rgba(109,40,217,0.9)',
  pulley: 'rgba(51,65,85,0.9)',
};

function anchorDot(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** 弹簧锯齿线 */
function springPath(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  coils = 8,
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const amp = Math.min(9, len * 0.18);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  const head = Math.min(len * 0.16, 14);
  ctx.lineTo(x0 + ux * head, y0 + uy * head);
  const n = coils * 2;
  for (let i = 1; i <= n; i++) {
    const t = head + ((len - 2 * head) * i) / n;
    const side = i % 2 === 0 ? 1 : -1;
    ctx.lineTo(x0 + ux * t + px * amp * side, y0 + uy * t + py * amp * side);
  }
  ctx.lineTo(x1 - ux * head, y1 - uy * head);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

export function drawJoints(ctx: CanvasRenderingContext2D, joints: JointRecord[]): void {
  for (const j of joints) {
    const { a, b } = jointEnds(j);
    const ax = cam.w2sx(a[0]);
    const ay = cam.w2sy(a[1]);
    const bx = cam.w2sx(b[0]);
    const by = cam.w2sy(b[1]);
    ctx.save();
    ctx.lineWidth = j.kind === 'rope' ? 2 : 1.5;
    if (j.kind === 'spring') {
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.8;
      springPath(ctx, ax, ay, bx, by);
      if (!j.recA) anchorDot(ctx, ax, ay, '#475569');
    } else if (j.kind === 'rope') {
      ctx.strokeStyle = COL.rope;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      if (!j.recA) anchorDot(ctx, ax, ay, '#7c2d12');
    } else if (j.kind === 'rod') {
      ctx.strokeStyle = COL.rod;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      if (!j.recA) anchorDot(ctx, ax, ay, '#334155');
    } else if (j.kind === 'hinge') {
      // 铰链：锚点圆环
      ctx.strokeStyle = COL.hinge;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bx, by, 5.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(15,118,110,0.25)';
      ctx.fill();
      if (!j.recA) anchorDot(ctx, bx, by, '#0f766e');
    } else if (j.kind === 'slider') {
      // 滑轨：过物体的双向轨道线
      const ext = 60;
      const ux = j.axis[0];
      const uy = -j.axis[1]; // 屏幕 y 翻转
      ctx.strokeStyle = COL.slider;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 5]);
      ctx.beginPath();
      ctx.moveTo(bx - ux * ext, by - uy * ext);
      ctx.lineTo(bx + ux * ext, by + uy * ext);
      ctx.stroke();
      anchorDot(ctx, ax, ay, '#5b21b6');
    } else if (j.kind === 'pulley') {
      const gax = cam.w2sx(j.groundAnchorA?.[0] ?? a[0]);
      const gay = cam.w2sy(j.groundAnchorA?.[1] ?? a[1]);
      const gbx = cam.w2sx(j.groundAnchorB?.[0] ?? b[0]);
      const gby = cam.w2sy(j.groundAnchorB?.[1] ?? b[1]);
      ctx.strokeStyle = COL.pulley;
      ctx.setLineDash([]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(gax, gay);
      ctx.lineTo(gbx, gby);
      ctx.lineTo(bx, by);
      ctx.stroke();
      anchorDot(ctx, gax, gay, '#334155');
      anchorDot(ctx, gbx, gby, '#334155');
    }
    ctx.restore();
  }
}

/** 连接件创建第一击后的挂起锚点标记 */
export function drawPendingLink(ctx: CanvasRenderingContext2D, pending: PendingLink): void {
  const x = cam.w2sx(pending.local[0]);
  const y = cam.w2sy(pending.local[1]);
  ctx.save();
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(220,38,38,0.25)';
  ctx.fill();
  ctx.restore();
}

/** 圆弧轨道的弧带路径（原点 = 圆心，半径为像素值，世界 y 向上映射为画布 -y）。
 *  供 drawBody 与拖拽预览（drawGhost）共用 */
export function arcBandPath(ctx: CanvasRenderingContext2D, rOut: number, rIn: number, span: number): void {
  const spanRad = (span * Math.PI) / 180;
  const n = Math.min(64, Math.max(12, Math.ceil(span / 7.5))); // 约 7.5°/段，视觉平滑
  const px = (r: number, th: number): [number, number] => [r * Math.cos(th), -r * Math.sin(th)];
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const [x, y] = px(rOut, Math.PI + (spanRad * i) / n);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  for (let i = n; i >= 0; i--) {
    const [x, y] = px(rIn, Math.PI + (spanRad * i) / n);
    ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** 通用形体绘制：buildPath 建立画布局部坐标路径后填充——
 *  动态物体填物体色；静态/运动学画灰蓝底 + 斜纹标识固定地形，最后描边。
 *  fillRule 用于带孔形状（有底座大圆心角）的 evenodd 填充 */
function paintShape(
  ctx: CanvasRenderingContext2D,
  m: BodyRecord['meta'],
  buildPath: () => void,
  hatchW: number,
  hatchH: number,
  fillRule: CanvasFillRule = 'nonzero',
): void {
  buildPath();
  if (m.isStatic || m.isKinematic) {
    ctx.fillStyle = m.isKinematic ? '#a7c7e7' : '#b6c2cd';
    ctx.fill(fillRule);
    ctx.save();
    ctx.clip(fillRule);
    ctx.strokeStyle = 'rgba(71,85,105,0.35)';
    ctx.lineWidth = 1;
    for (let x = -hatchW / 2 - hatchH; x < hatchW / 2 + hatchH; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, hatchH / 2);
      ctx.lineTo(x + hatchH, -hatchH / 2);
      ctx.stroke();
    }
    ctx.restore();
    buildPath(); // 斜纹的 beginPath 已清掉原路径，重建后描边
    ctx.strokeStyle = 'rgba(51,65,85,0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    ctx.fillStyle = m.color ?? '#3b82f6';
    ctx.fill(fillRule);
    ctx.strokeStyle = 'rgba(15,23,42,0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

export function drawBody(ctx: CanvasRenderingContext2D, rec: BodyRecord, selected: boolean): void {
  const p = rec.body.GetPosition();
  const a = rec.body.GetAngle();
  const m = rec.meta;
  ctx.save();
  ctx.translate(cam.w2sx(p.x), cam.w2sy(p.y));
  ctx.rotate(-a); // 屏幕 y 向下，世界逆时针角度在屏幕上是顺时针

  if (m.shape.kind === 'point') {
    // 质点：极小圆，保证最小像素尺寸，任何缩放下都可见；无姿态，不画半径线
    const r = Math.max(m.shape.r * cam.ppm, 4);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = m.color ?? '#3b82f6';
    ctx.fill();
    ctx.strokeStyle = 'rgba(15,23,42,0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else if (m.shape.kind === 'circle') {
    const r = m.shape.r * cam.ppm;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = m.color ?? '#3b82f6';
    ctx.fill();
    // 半径线让旋转可见
    ctx.strokeStyle = 'rgba(15,23,42,0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(r, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  } else if (m.shape.kind === 'wedge') {
    // 斜面体：三角形（局部 y 向上 → 画布 y 取负）
    const verts = wedgeVerts(m.shape.w, m.shape.h).map(
      ([vx, vy]) => [vx * cam.ppm, -vy * cam.ppm] as [number, number],
    );
    paintShape(
      ctx,
      m,
      () => {
        ctx.beginPath();
        verts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.closePath();
      },
      m.shape.w * cam.ppm,
      m.shape.h * cam.ppm,
    );
  } else if (m.shape.kind === 'arc') {
    const sh = m.shape;
    if (sh.base) {
      // 有底座：外接矩形 − 内弧凹槽（大圆心角时内弧成孔，evenodd 双回路）
      const rc = arcBaseRect(sh.r, sh.span);
      const { outer, hole } = arcBaseOutline(sh.r, sh.t, sh.span);
      const toCanvas = (p: [number, number]): [number, number] => [p[0] * cam.ppm, -p[1] * cam.ppm];
      paintShape(
        ctx,
        m,
        () => {
          ctx.beginPath();
          for (let i = 0; i < outer.length; i++) {
            const [x, y] = toCanvas(outer[i]);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.closePath();
          if (hole) {
            for (let i = 0; i < hole.length; i++) {
              const [x, y] = toCanvas(hole[i]);
              i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.closePath();
          }
        },
        (rc.right - rc.left) * cam.ppm,
        (rc.top - rc.bottom) * cam.ppm,
        'evenodd',
      );
    } else {
      // 弧带：精确弧（物理是盒子拼合，视觉画真弧）
      const rOut = sh.r * cam.ppm;
      paintShape(
        ctx,
        m,
        () => arcBandPath(ctx, rOut, (sh.r - sh.t) * cam.ppm, sh.span),
        rOut * 2,
        rOut * 2,
      );
    }
  } else {
    const w = m.shape.size[0] * cam.ppm;
    const h = m.shape.size[1] * cam.ppm;
    paintShape(
      ctx,
      m,
      () => {
        ctx.beginPath();
        ctx.rect(-w / 2, -h / 2, w, h);
      },
      w,
      h,
    );
  }

  if (m.label) {
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = 'bold 11px system-ui';
    // 质点太小，标签画在右侧避免盖住圆点
    ctx.textAlign = m.shape.kind === 'point' ? 'left' : 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(15,23,42,0.6)';
    ctx.shadowBlur = 2;
    ctx.fillText(m.label, m.shape.kind === 'point' ? 10 : 0, 0);
    ctx.shadowBlur = 0;
  }
  ctx.restore();

  if (selected) {
    const sx = cam.w2sx(p.x);
    const sy = cam.w2sy(p.y);
    ctx.save();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    // 选中虚线圈半径：取形状最远点到中心（原点）的距离
    let rPx: number;
    if (m.shape.kind === 'point') rPx = Math.max(m.shape.r * cam.ppm, 4) + 8;
    else if (m.shape.kind === 'circle') rPx = m.shape.r * cam.ppm + 6;
    else if (m.shape.kind === 'rect')
      rPx = ((Math.max(m.shape.size[0], m.shape.size[1]) / 2) * cam.ppm) + 6;
    else if (m.shape.kind === 'wedge') rPx = (Math.hypot(m.shape.w, m.shape.h) / 2) * cam.ppm + 6;
    else rPx = m.shape.r * cam.ppm + 6;
    ctx.beginPath();
    ctx.arc(sx, sy, rPx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
