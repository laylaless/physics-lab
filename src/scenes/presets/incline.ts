import type { SceneDef } from '../schema';

/** 实验 12A：斜面上的滑块（a = g(sinθ − μcosθ)） */
export const incline: SceneDef = {
  meta: {
    name: '斜面上的滑块',
    view: 'vertical',
    knowledge: '牛顿定律',
    desc: '倾角 25°、μ = 0.15 的斜面。滑块 m = 1 kg 静止释放下滑。理论 a = g(sinθ − μcosθ) ≈ 2.8 m/s²。打开支持力 N、摩擦力 f 矢量做受力分解。',
    guides: [
      'N 的大小 ≈ mg·cosθ = 8.9 N 吗？f ≈ μN = 1.3 N 吗？',
      '加速度实测与理论 2.8 m/s² 一致吗？',
      '把 μ 改成 0.47（tan25°）重置——滑块恰好匀速下滑！',
    ],
  },
  world: { gravity: 9.8, viewport: { cx: 5, cy: 3, widthM: 12 } },
  bodies: [
    { shape: { kind: 'rect', size: [12, 0.5] }, pos: [5, -0.25], isStatic: true, friction: 1 },
    {
      id: 'ramp',
      shape: { kind: 'rect', size: [5.5, 0.3] },
      pos: [4.6, 4.1],
      angle: (-25 * Math.PI) / 180,
      isStatic: true,
      friction: 0.15,
    },
    {
      id: 'block',
      label: '滑块',
      shape: { kind: 'rect', size: [0.5, 0.35] },
      pos: [4.0, 4.8],
      angle: (-25 * Math.PI) / 180,
      density: 5.71,
      friction: 0.15,
      restitution: 0.05,
      trace: true,
      color: '#8b5cf6',
    },
  ],
  joints: [],
};
