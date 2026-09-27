import type { SceneDef } from '../schema';

/** 实验 16：机械能守恒（Ek + Ep 恒定，图表看两条曲线互补） */
export const energyConservation: SceneDef = {
  meta: {
    name: '机械能守恒（摆）',
    view: 'vertical',
    knowledge: '机械能',
    desc: '摆长 3 m 的单摆从 40° 释放。图表切到"动能 Ek"与"重力势能 Ep"对比：两曲线此消彼长，总和不变（只有重力做功）。',
    guides: [
      '最低点 Ek 最大吗？Ek(max) = mgΔh 吗？',
      '任意时刻 Ek + Ep 是常量吗？',
      '把摆球 μ……空气阻力不存在，那能量去哪了？（理想模型：不去哪）',
    ],
  },
  world: { gravity: 9.8, viewport: { cx: 7, cy: 4.5, widthM: 11 } },
  bodies: [
    {
      id: 'ball',
      label: '摆球',
      shape: { kind: 'circle', r: 0.2 },
      pos: [8.93, 5.7],
      density: 7.96,
      friction: 0.1,
      restitution: 0.1,
      trace: true,
      color: '#8b5cf6',
    },
  ],
  joints: [{ type: 'rope', a: { world: [7, 8] }, b: { body: 'ball' }, length: 3 }],
};
