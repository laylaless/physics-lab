import type { SceneDef } from '../schema';

/** 实验 12B：斜面 + 定滑轮连接体（整体法与隔离法） */
export const inclinePulley: SceneDef = {
  meta: {
    name: '连接体（斜面与滑轮）',
    view: 'vertical',
    knowledge: '牛顿定律',
    desc: '光滑斜面（30°）上的滑块 m₁ = 1 kg 经绳跨过顶端滑轮连接悬挂砝码 m₂ = 2 kg。整体法：a = (m₂g − m₁g·sinθ)/(m₁+m₂) = 4.9 m/s²。',
    guides: [
      '实测加速度与理论 4.9 m/s² 一致吗？（图表看 vx 斜率）',
      '选中滑块或砝码，绳的张力 T 是多少？（隔离法：T − m₁g·sinθ = m₁a → T ≈ 9.8 N）',
      '把砝码密度减半（m₂ = 1 kg）重置——系统还动吗？',
    ],
  },
  world: { gravity: 9.8, viewport: { cx: 5.5, cy: 3.4, widthM: 13 } },
  bodies: [
    { shape: { kind: 'rect', size: [14, 0.5] }, pos: [5.5, -0.25], isStatic: true, friction: 1 },
    {
      id: 'ramp',
      shape: { kind: 'rect', size: [5.5, 0.3] },
      pos: [4.0, 3.4],
      angle: (30 * Math.PI) / 180,
      isStatic: true,
      friction: 0.02,
    },
    {
      id: 'm1',
      label: '滑块m₁',
      shape: { kind: 'rect', size: [0.5, 0.35] },
      pos: [2.54, 2.93],
      angle: (30 * Math.PI) / 180,
      density: 5.71,
      friction: 0.02,
      restitution: 0.05,
      trace: true,
      color: '#8b5cf6',
    },
    {
      id: 'm2',
      label: '砝码m₂',
      shape: { kind: 'rect', size: [0.45, 0.45] },
      pos: [8.8, 4.0],
      density: 9.88,
      friction: 0.3,
      restitution: 0.05,
      trace: true,
      color: '#f59e0b',
    },
  ],
  joints: [
    {
      type: 'pulley',
      a: { body: 'm1' },
      b: { body: 'm2' },
      groundAnchorA: [7.0, 5.6],
      groundAnchorB: [8.8, 5.6],
      ratio: 1,
    },
  ],
};
