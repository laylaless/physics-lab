import { camera as cam } from './camera';
import { arrow } from './draw';
import type { BodyRecord } from '../core/bodies';
import { settings } from '../app/state';
import type { ViewMode } from '../scenes/schema';

const S_V = 8; // px per (m/s)
const S_A = 10; // px per (m/s²)
const S_F = 2.5; // px per N
const MAX_PX = 150; // 矢量最大长度（像素），超出按比例截断

export function drawVectors(
  ctx: CanvasRenderingContext2D,
  rec: BodyRecord,
  view: ViewMode,
  gravity: number,
): void {
  if (rec.meta.isStatic) return;
  const anyForce = settings.vecF || settings.vecN || settings.vecFric;
  if (!settings.vecV && !settings.vecA && !settings.vecG && !anyForce) return;
  const p = rec.body.GetPosition();
  const ox = cam.w2sx(p.x);
  const oy = cam.w2sy(p.y);

  if (settings.vecV) arrowCapped(ctx, ox, oy, rec.vx * S_V, -rec.vy * S_V, '#16a34a', 'v');
  if (settings.vecA) arrowCapped(ctx, ox, oy, rec.ax * S_A, -rec.ay * S_A, '#ea580c', 'a');
  if (settings.vecG && view === 'vertical' && gravity > 0) {
    const G = rec.body.GetMass() * gravity * rec.meta.gravityScale;
    arrowCapped(ctx, ox, oy, 0, G * S_F, '#2563eb', 'G');
  }
  if (settings.vecF) {
    const m = rec.body.GetMass();
    arrowCapped(ctx, ox, oy, m * rec.ax * S_F, -m * rec.ay * S_F, '#dc2626', 'ΣF');
  }
  // 接触反推：支持力 N（青）、摩擦力 f（紫）
  if (settings.vecN) arrowCapped(ctx, ox, oy, rec.dnx * S_F, -rec.dny * S_F, '#0891b2', 'N');
  if (settings.vecFric) arrowCapped(ctx, ox, oy, rec.dfx * S_F, -rec.dfy * S_F, '#a21caf', 'f');
  // 施加的外力（force/forces）：从物心画出的紫红箭头
  if (anyForce || settings.vecF) {
    const m = rec.meta;
    const list: { v: [number, number]; label: string }[] = [];
    if (m.force) list.push({ v: m.force, label: 'F' });
    if (m.forces) for (let i = 0; i < m.forces.length; i++) {
      const f = m.forces[i];
      list.push({ v: f.v, label: f.label ?? `F${i + 1}` });
    }
    for (const item of list) {
      arrowCapped(ctx, ox, oy, item.v[0] * S_F, -item.v[1] * S_F, '#7c3aed', item.label);
    }
  }
}

function arrowCapped(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  color: string,
  label: string,
): void {
  const len = Math.hypot(dx, dy);
  if (len < 7) return;
  const k = len > MAX_PX ? MAX_PX / len : 1;
  arrow(ctx, ox, oy, ox + dx * k, oy + dy * k, color, 2.2, label);
}
