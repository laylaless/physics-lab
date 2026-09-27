import type { SceneDef } from '../schema';

/** 实验 5：斜抛运动（射程与抛射角，45° 最大） */
export const obliqueThrow: SceneDef = {
  meta: {
    name: '斜抛运动',
    view: 'vertical',
    knowledge: '运动学',
    desc: '小球以 8 m/s、45° 抛射角射出。修改初速度 vx/vy（保持合速度 8 不变）比较射程。',
    guides: [
      '45° 时射程约多少？（R = v₀²·sin2θ/g）',
      '把 vx、vy 互换（60°↔30°），射程如何变化？',
      '轨迹对称吗？最高点速度是多少？',
    ],
  },
  world: { gravity: 9.8, viewport: { cx: 7, cy: 3.2, widthM: 16 } },
  bodies: [
    {
      id: 'ball',
      label: '小球',
      shape: { kind: 'circle', r: 0.15 },
      pos: [4, 1],
      v0: [5.66, 5.66],
      density: 5,
      friction: 0.3,
      restitution: 0.3,
      trace: true,
      color: '#ef4444',
    },
    { shape: { kind: 'rect', size: [18, 0.5] }, pos: [8, -0.25], isStatic: true, friction: 0.5 },
  ],
  joints: [],
};
