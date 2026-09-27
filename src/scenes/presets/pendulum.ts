import type { SceneDef } from '../schema';

/** 实验 23：单摆（垂直模式，验证 T = 2π√(L/g)） */
export const pendulum: SceneDef = {
  meta: {
    name: '单摆',
    view: 'vertical',
    knowledge: '振动',
    desc: '摆长 L = 3 m、摆球 m = 1 kg，从偏离竖直方向 35° 处静止释放。周期理论值 T = 2π√(L/g) ≈ 3.47 s。',
    guides: [
      '摆球在最低点速度最大吗？此刻合力（绳的拉力与重力的合力）指向哪里？',
      '把顶部重力 g 改为 1.63（月球），重置后周期变长还是变短？',
      '暂停后拖动摆球改变释放角，周期变化吗？（小角度内几乎不变——等时性）',
    ],
  },
  world: { gravity: 9.8, viewport: { cx: 6, cy: 5, widthM: 12 } },
  bodies: [
    {
      id: 'ball',
      label: '摆球',
      shape: { kind: 'circle', r: 0.2 },
      pos: [7.72, 5.54],
      density: 7.96,
      friction: 0.1,
      restitution: 0.1,
      trace: true,
      color: '#8b5cf6',
    },
  ],
  joints: [{ type: 'distance', anchor: [6, 8], body: 'ball', length: 3 }],
};
