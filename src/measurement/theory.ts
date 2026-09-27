import type { Sim } from '../core/sim';
import type { SceneBodyDef } from '../scenes/schema';

/**
 * 理论曲线叠加（实测 vs 公式）：
 * 按预设 id 注册各曲线序列的理论函数；绘制时以当前 sim 的 g、质量等实时参数
 * 与 snapshotDef 中的初始条件（位置/初速度/场景参数）计算课本公式值。
 * 返回 null 表示该时刻不画（如小球落地后）。
 */
export type CurveFn = (t: number, sim: Sim) => number | null;

type Entry = Record<string, CurveFn[]>;

/* ---------------- 工具 ---------------- */

function snapBody(sim: Sim, id: string): SceneBodyDef | undefined {
  return sim.snapshotDef?.bodies.find(b => b.id === id);
}

function liveMass(sim: Sim, id: string): number {
  return sim.records.find(r => r.meta.id === id)?.body.GetMass() ?? 0;
}

const g = (sim: Sim): number => (sim.view === 'vertical' ? sim.gravity : 0);

/** 自由落体/抛体的落地时刻（撞到地面 y≈r 处） */
function landTime(sim: Sim, b: SceneBodyDef, vy0 = 0): number {
  const r = b.shape.kind === 'circle' ? b.shape.r : 0.2;
  const h = Math.max(b.pos[1] - r, 0);
  const gg = g(sim);
  if (gg <= 0) return Infinity;
  if (vy0 >= 0) return Math.sqrt((2 * (h + (vy0 * vy0) / (2 * gg))) / gg);
  return (-vy0 + Math.sqrt(vy0 * vy0 + 2 * gg * h)) / gg;
}

/* ---------------- 各预设理论公式 ---------------- */

export const THEORY: Record<string, Entry> = {
  'uniform-motion': {
    x: [t => 2 + 3 * t], // 场景固定：x₀=2、v₀=3
    vx: [() => 3],
  },
  'uniform-accel': {
    vx: [
      (t, sim) => {
        const b = sim.records.find(r => r.meta.id === 'block');
        if (!b) return null;
        return ((b.meta.force?.[0] ?? 0) / b.body.GetMass()) * t;
      },
    ],
  },
  'free-fall': {
    y: [
      (t, sim) => {
        const b = snapBody(sim, 'light') ?? snapBody(sim, 'heavy');
        if (!b) return null;
        if (t > landTime(sim, b)) return null;
        return b.pos[1] - 0.5 * g(sim) * t * t;
      },
    ],
    vy: [
      (t, sim) => {
        const b = snapBody(sim, 'light') ?? snapBody(sim, 'heavy');
        if (!b) return null;
        if (t > landTime(sim, b)) return null;
        return -g(sim) * t;
      },
    ],
  },
  projectile: {
    x: [
      (t, sim) => {
        const b = snapBody(sim, 'main');
        if (!b?.v0) return null;
        if (t > landTime(sim, b)) return null;
        return b.pos[0] + b.v0[0] * t;
      },
    ],
    y: [
      (t, sim) => {
        const b = snapBody(sim, 'main');
        if (!b?.v0) return null;
        if (t > landTime(sim, b)) return null;
        return b.pos[1] - 0.5 * g(sim) * t * t;
      },
    ],
  },
  'oblique-throw': {
    x: [(t, sim) => snapBody(sim, 'ball')?.v0 ? snapBody(sim, 'ball')!.pos[0] + snapBody(sim, 'ball')!.v0![0] * t : null],
    y: [
      (t, sim) => {
        const b = snapBody(sim, 'ball');
        if (!b?.v0) return null;
        const vy0 = b.v0[1];
        const tLand = landTime(sim, b, vy0);
        if (t > tLand) return null;
        return b.pos[1] + vy0 * t - 0.5 * g(sim) * t * t;
      },
    ],
  },
  'friction-static': {
    vx: [
      (t, sim) => {
        const b = snapBody(sim, 'block');
        const rec = sim.records.find(r => r.meta.id === 'block');
        if (!b?.forceRamp || !rec) return null;
        const m = rec.body.GetMass();
        const { from, to, duration } = b.forceRamp;
        const fMax = (b.friction ?? 0.3) * m * g(sim);
        // F(t) = from + (to−from)·min(t,d)/d
        const F = (tt: number): number => from + ((to - from) * Math.min(tt, duration)) / duration;
        if (F(t) <= fMax) return 0; // 静摩擦段
        const tStar = ((fMax - from) * duration) / (to - from); // 开始滑动的时刻
        if (t <= duration) {
          // v(t) = ∫[t*→t] (F(τ)−fmax)/m dτ（F 线性 → 解析积分）
          return ((from - fMax) * (t - tStar)) / m + ((to - from) / (2 * duration * m)) * (t * t - tStar * tStar);
        }
        const vAtD =
          ((from - fMax) * (duration - tStar)) / m +
          ((to - from) / (2 * duration * m)) * (duration * duration - tStar * tStar);
        return vAtD + ((to - fMax) / m) * (t - duration);
      },
    ],
  },
  newton2: {
    vx: [
      (t, sim) => {
        const chassis = sim.records.find(r => r.meta.id === 'cart-body');
        if (!chassis) return null;
        const F = chassis.meta.force?.[0] ?? 0;
        let mTotal = 0;
        for (const r of sim.records) if (r.meta.group === chassis.meta.group) mTotal += r.body.GetMass();
        return mTotal > 0 ? (F / mTotal) * t : null;
      },
    ],
  },
  incline: {
    vx: [
      (t, sim) => {
        const b = snapBody(sim, 'block');
        const ramp = sim.snapshotDef?.bodies.find(x => x.id === 'ramp');
        if (!b || !ramp) return null;
        const th = Math.abs(ramp.angle ?? 0);
        const a = g(sim) * (Math.sin(th) - (b.friction ?? 0.3) * Math.cos(th));
        return a * t * Math.cos(th);
      },
    ],
  },
  'incline-pulley': {
    vx: [
      (t, sim) => {
        const m1 = liveMass(sim, 'm1');
        const m2 = liveMass(sim, 'm2');
        if (!m1 || !m2) return null;
        const th = (30 * Math.PI) / 180;
        const a = (m2 * g(sim) - m1 * g(sim) * Math.sin(th)) / (m1 + m2);
        return a * t * Math.cos(th);
      },
    ],
  },
  'horizontal-circle': {
    sp: [() => 3], // 场景固定 v₀=3（绳张紧后速率近似不变）
  },
  'friction-heat': {
    vx: [
      (t, sim) => {
        const b = snapBody(sim, 'block');
        if (!b?.v0) return null;
        return Math.max(b.v0[0] - (b.friction ?? 0.3) * g(sim) * t, 0);
      },
    ],
  },
  recoil: {
    vx: [
      (t, sim) => (t < 0.35 ? null : recoilSpeed(sim)[0]),
      (t, sim) => (t < 0.35 ? null : recoilSpeed(sim)[1]),
    ],
  },
  'spring-oscillator': {
    x: [
      (t, sim) => {
        const p = oscParams(sim);
        return p ? p.xEq + p.A * Math.cos(p.omega * t) : null;
      },
    ],
    vx: [
      (t, sim) => {
        const p = oscParams(sim);
        return p ? -p.A * p.omega * Math.sin(p.omega * t) : null;
      },
    ],
  },
  elevator: {
    en: [
      (t, sim) => {
        const m = liveMass(sim, 'box');
        const drv = sim.drivers[0];
        if (!m || !drv || drv.def.type !== 'elevator') return null;
        // 分段：相位内 N = m(g+a)（ay 向上为正），脚本结束后 N = mg
        let acc = 0;
        for (const ph of drv.def.profile) {
          if (t < acc + ph.dt) return m * (g(sim) + ph.ay);
          acc += ph.dt;
        }
        return m * g(sim);
      },
    ],
  },
};

/** 反冲：弹簧压缩能 → 两物块末速度（动量守恒 + 能量守恒） */
function recoilSpeed(sim: Sim): [number, number] {
  const j = sim.joints[0];
  const b1 = snapBody(sim, 'm1');
  const b2 = snapBody(sim, 'm2');
  if (!j || j.kind !== 'spring' || !b1 || !b2) return [NaN, NaN];
  const d0 = Math.abs(b2.pos[0] - b1.pos[0]);
  const x0 = Math.max(j.length - d0, 0); // 压缩量
  const m1 = liveMass(sim, 'm1');
  const m2 = liveMass(sim, 'm2');
  if (!m1 || !m2) return [NaN, NaN];
  const v1 = -x0 * Math.sqrt((j.k * m2) / (m1 * (m1 + m2)));
  const v2 = x0 * Math.sqrt((j.k * m1) / (m2 * (m1 + m2)));
  return [v1, v2];
}

/** 弹簧振子参数：平衡位置、振幅、角频率（水平弹簧，锚点在左） */
function oscParams(sim: Sim): { xEq: number; A: number; omega: number } | null {
  const j = sim.joints[0];
  const b = snapBody(sim, 'block');
  if (!j || j.kind !== 'spring' || !b) return null;
  const anchor = springAnchor(sim);
  if (!anchor) return null;
  const m = liveMass(sim, 'block');
  if (!m) return null;
  const dir = b.pos[0] >= anchor[0] ? 1 : -1;
  const xEq = anchor[0] + dir * j.length;
  return { xEq, A: b.pos[0] - xEq, omega: Math.sqrt(j.k / m) };
}

/** 弹簧 A 端的世界锚点（从 snapshotDef 的关节定义还原——运行期锚点可能已随物移动） */
function springAnchor(sim: Sim): [number, number] | null {
  const jd = sim.snapshotDef?.joints?.find(x => x.type === 'spring');
  if (!jd || jd.type !== 'spring') return null;
  if ('world' in jd.a) return jd.a.world;
  const local = 'local' in jd.a && jd.a.local ? jd.a.local : [0, 0];
  const body = sim.snapshotDef?.bodies.find(x => 'body' in jd.a && x.id === jd.a.body);
  return body ? [body.pos[0] + local[0], body.pos[1] + local[1]] : null;
}
