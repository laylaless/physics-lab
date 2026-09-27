import type { SceneDef } from '../schema';

/** 实验 17：弹性势能与动能转化（½kx² = ½mv²） */
export const springEnergy: SceneDef = {
  meta: {
    name: '弹性势能转化',
    view: 'vertical',
    knowledge: '机械能',
    desc: 'k = 50 N/m 的弹簧压缩 0.4 m 后释放，弹出 1 kg 滑块。理论最大速度 v = x√(k/m) = 2.83 m/s（图表看 vx）。',
    guides: [
      'vx 的最大值 ≈ 2.83 m/s 吗？（½kx² = ½mv²）',
      '把压缩量增大一倍（滑块初始位置往左挪 0.4 m），v 变为几倍？（∝ x）',
      '把 k 改成 200 N/m，v 变为几倍？（∝ √k）',
    ],
  },
  world: { gravity: 9.8, viewport: { cx: 6, cy: 1.8, widthM: 14 } },
  bodies: [
    { shape: { kind: 'rect', size: [14, 0.5] }, pos: [6, -0.25], isStatic: true, friction: 0.01 },
    {
      id: 'block',
      label: '滑块',
      shape: { kind: 'rect', size: [0.4, 0.4] },
      pos: [4.6, 0.95],
      density: 6.25,
      friction: 0.01,
      restitution: 0.05,
      trace: true,
      color: '#3b82f6',
    },
  ],
  joints: [{ type: 'spring', a: { world: [3.8, 0.95] }, b: { body: 'block' }, k: 50, length: 1.2, damping: 0.2 }],
};
