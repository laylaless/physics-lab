import type { SceneDef } from '../schema';

/** 实验 7：静摩擦与滑动摩擦（拉力线性增大，教材侧视图） */
export const frictionStatic: SceneDef = {
  meta: {
    name: '静摩擦与滑动摩擦',
    view: 'vertical',
    knowledge: '相互作用',
    desc: '物块 m = 1 kg、μ = 0.5，水平拉力从 0 随时间线性增大到 6 N（约 5 s）。打开摩擦力 f 矢量观察静摩擦被动匹配拉力。',
    guides: [
      '拉力多大时物块开始滑动？（最大静摩擦 ≈ μmg = 4.9 N）',
      '滑动前 f 与 F 等大反向吗？（静摩擦被动调节）',
      '滑动后 |f| 稳定在多少？（f = μN）',
    ],
  },
  world: { gravity: 9.8, viewport: { cx: 6, cy: 1.6, widthM: 14 } },
  bodies: [
    {
      id: 'block',
      label: '物块',
      shape: { kind: 'rect', size: [0.7, 0.5] },
      pos: [4, 1.05],
      density: 2.86,
      friction: 0.5,
      restitution: 0.05,
      trace: true,
      color: '#8b5cf6',
      forceRamp: { from: 0, to: 6, duration: 5 },
    },
    { shape: { kind: 'rect', size: [16, 0.5] }, pos: [6, -0.25], isStatic: true, friction: 0.5 },
  ],
  joints: [],
};
