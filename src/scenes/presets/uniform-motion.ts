import type { SceneDef } from '../schema';

/** 实验 1：匀速直线运动（牛顿第一定律 / 惯性）——等效教材侧视图（μ≈0 冰面） */
export const uniformMotion: SceneDef = {
  meta: {
    name: '匀速直线运动（惯性）',
    view: 'vertical',
    knowledge: '运动学',
    desc: '冰面（μ≈0）上的滑块以 3 m/s 初速度滑出。不受合力时，运动状态保持不变。',
    guides: [
      'x-t 图是倾斜直线吗？速度矢量的大小方向变了吗？',
      '合力矢量 ΣF 是多少？（不受力也能一直运动——惯性）',
      '把 μ 调大重置，滑块还能匀速吗？',
    ],
  },
  world: { gravity: 9.8, viewport: { cx: 7, cy: 1.5, widthM: 16 } },
  bodies: [
    {
      id: 'block',
      label: '滑块',
      shape: { kind: 'rect', size: [0.6, 0.4] },
      pos: [2, 0.95],
      v0: [3, 0],
      density: 2.5,
      friction: 0.001,
      restitution: 0.1,
      trace: true,
      color: '#3b82f6',
    },
    { shape: { kind: 'rect', size: [18, 0.5] }, pos: [8, -0.25], isStatic: true, friction: 0.001 },
  ],
  joints: [],
};
