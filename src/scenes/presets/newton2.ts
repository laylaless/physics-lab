import type { SceneDef } from '../schema';

/** 实验 9：牛顿第二定律（小车控制变量，教材侧视图） */
export const newton2: SceneDef = {
  meta: {
    name: '牛顿第二定律（控制变量）',
    view: 'vertical',
    knowledge: '牛顿定律',
    desc: '小车（总质量约 1.65 kg）受水平恒力 F = 3 N。观察加速度矢量与 vx-t 图斜率。',
    guides: [
      'a ≈ F/m = 3/1.65 ≈ 1.8 m/s²，与矢量读数一致吗？',
      '把车厢密度加倍（质量变量）重置重跑，a 如何变？（F 不变 → a 减半）',
      '把恒力 Fx 改成 6 N 重置，a 如何变？（m 不变 → a 加倍）',
    ],
  },
  world: { gravity: 9.8, viewport: { cx: 7, cy: 2, widthM: 16 } },
  bodies: [
    { shape: { kind: 'rect', size: [18, 0.5] }, pos: [7, -0.25], isStatic: true, friction: 1 },
    {
      id: 'cart-body',
      label: '小车',
      shape: { kind: 'rect', size: [1.2, 0.35] },
      pos: [2.5, 1.35],
      density: 1.5,
      friction: 0.4,
      asPoint: true,
      group: 'cart-1',
      drive: 0,
      color: '#f59e0b',
      force: [3, 0],
      trace: false,
    },
    {
      id: 'cart-1-w1',
      shape: { kind: 'circle', r: 0.18 },
      pos: [2.08, 1.07],
      density: 5,
      friction: 2,
      restitution: 0.05,
      asPoint: false,
      group: 'cart-1',
      color: '#475569',
    },
    {
      id: 'cart-1-w2',
      shape: { kind: 'circle', r: 0.18 },
      pos: [2.92, 1.07],
      density: 5,
      friction: 2,
      restitution: 0.05,
      asPoint: false,
      group: 'cart-1',
      color: '#475569',
    },
  ],
  joints: [
    { type: 'hinge', a: { body: 'cart-body', local: [-0.42, -0.28] }, b: { body: 'cart-1-w1' }, motor: { speed: 0, torque: 15 } },
    { type: 'hinge', a: { body: 'cart-body', local: [0.42, -0.28] }, b: { body: 'cart-1-w2' }, motor: { speed: 0, torque: 15 } },
  ],
};
