import type { SceneDef } from '../schema';

/** 实验 6：弹力与胡克定律（竖直弹簧挂重物，F = kx） */
export const hooke: SceneDef = {
  meta: {
    name: '胡克定律（F = kx）',
    view: 'vertical',
    knowledge: '相互作用',
    desc: '劲度系数 k = 20 N/m 的弹簧上端固定，下挂 1 kg 砝码（选中砝码可在实时数据读弹簧弹力）。平衡时伸长 x = mg/k = 0.49 m。',
    guides: [
      '平衡时弹簧弹力 |F| 是多少？等于重力吗？',
      '把质量改为 2 kg、3 kg 重置重跑，伸长量等差增加吗？（F-x 图是过原点直线）',
      '把劲度 k 改成 40 N/m，同样质量伸长量变为多少？',
    ],
  },
  world: { gravity: 9.8, viewport: { cx: 6, cy: 6, widthM: 11 } },
  bodies: [
    {
      id: 'mass',
      label: '砝码',
      shape: { kind: 'rect', size: [0.5, 0.5] },
      pos: [6, 8],
      density: 4,
      friction: 0.3,
      restitution: 0.05,
      color: '#f59e0b',
    },
  ],
  joints: [{ type: 'spring', a: { world: [6, 9] }, b: { body: 'mass' }, k: 20, length: 1, damping: 0.8 }],
};
