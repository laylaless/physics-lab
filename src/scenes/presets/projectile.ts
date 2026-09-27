import type { SceneDef } from '../schema';

/** 实验 4：平抛运动（垂直模式，三个参考球对比分解运动） */
export const projectile: SceneDef = {
  meta: {
    name: '平抛运动',
    view: 'vertical',
    knowledge: '运动学',
    desc:
      '红球从平台边缘以水平初速度 5 m/s 抛出；深灰球同时同高自由下落；' +
      '上方浅灰球不受重力、以相同水平速度匀速飞行。三者对比揭示：平抛 = 水平匀速 + 竖直自由落体。',
    guides: [
      '平抛球与自由落体球是否始终同高？（竖直分运动 = 自由落体）',
      '平抛球与无重力球是否始终在同一竖直线上？（水平分运动 = 匀速）',
      '轨迹是什么曲线？下落时间由什么决定，与水平初速度有关吗？',
    ],
  },
  world: { gravity: 9.8, viewport: { cx: 8, cy: 3.8, widthM: 17 } },
  bodies: [
    { shape: { kind: 'rect', size: [3.2, 0.3] }, pos: [2.2, 5.85], isStatic: true, friction: 0.2 },
    {
      id: 'main',
      label: '平抛',
      shape: { kind: 'circle', r: 0.2 },
      pos: [4.2, 6.4],
      v0: [5, 0],
      density: 5,
      friction: 0.2,
      restitution: 0.05,
      trace: true,
      color: '#ef4444',
    },
    {
      id: 'refFall',
      label: '自由落体',
      shape: { kind: 'circle', r: 0.2 },
      pos: [9.2, 6.4],
      density: 5,
      friction: 0.2,
      restitution: 0.05,
      trace: true,
      color: '#64748b',
    },
    {
      id: 'refNoG',
      label: '无重力',
      shape: { kind: 'circle', r: 0.2 },
      pos: [4.2, 7.1],
      v0: [5, 0],
      gravityScale: 0,
      density: 5,
      friction: 0.2,
      restitution: 0.05,
      trace: true,
      color: '#94a3b8',
    },
    { shape: { kind: 'rect', size: [24, 0.5] }, pos: [10, -0.25], isStatic: true, friction: 0.5 },
  ],
  joints: [],
};
