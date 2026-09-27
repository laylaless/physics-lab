import type { SceneDef } from '../schema';

/** 实验 22：弹簧振子（简谐运动，T = 2π√(m/k)，平面无重力无摩擦） */
export const springOscillator: SceneDef = {
  meta: {
    name: '弹簧振子（简谐运动）',
    view: 'plane',
    knowledge: '振动',
    desc: '俯视光滑平面：1 kg 滑块被 k = 20 N/m 的弹簧拉着，从偏离平衡 0.8 m 处释放。周期 T = 2π√(m/k) ≈ 1.40 s。图表看 x-t 正弦曲线。',
    guides: [
      'x-t 图是正弦曲线吗？实测周期 ≈ 1.40 s 吗？',
      '平衡位置处速度最大、加速度为零？（对照 v、a 矢量）',
      '把滑块拉开距离改为 0.4 m 重置——周期变吗？（等时性：与振幅无关）',
    ],
  },
  world: { viewport: { cx: 0.8, cy: 0, widthM: 12 } },
  bodies: [
    {
      id: 'block',
      label: '滑块',
      shape: { kind: 'rect', size: [0.5, 0.4] },
      pos: [1.6, 0],
      density: 5,
      friction: 0.02,
      restitution: 0.1,
      trace: true,
      color: '#3b82f6',
    },
  ],
  joints: [{ type: 'spring', a: { world: [-0.7, 0] }, b: { body: 'block' }, k: 20, length: 1.5, damping: 0.1 }],
};
