import type { SceneDef } from '../schema';

/** 实验 3：自由落体（垂直模式，轻重球同高同时释放） */
export const freeFall: SceneDef = {
  meta: {
    name: '自由落体运动',
    view: 'vertical',
    knowledge: '运动学',
    desc: '轻球（约 0.3 kg）与重球（约 4.8 kg）从同一高度同时静止释放。观察它们是否同时落地。',
    guides: [
      '两球是否同时落地？下落快慢与质量有关吗？',
      '加速度矢量的大小是否始终约为 9.8 m/s²、方向竖直向下？',
      '频闪点间距按什么规律递增？（相邻间距差恒定 → 匀加速直线运动）',
    ],
  },
  world: { gravity: 9.8, viewport: { cx: 7, cy: 4.5, widthM: 14 } },
  bodies: [
    {
      id: 'light',
      label: '轻球',
      shape: { kind: 'circle', r: 0.18 },
      pos: [4.5, 8],
      density: 3,
      friction: 0.4,
      restitution: 0.05,
      trace: true,
      color: '#f59e0b',
    },
    {
      id: 'heavy',
      label: '重球',
      shape: { kind: 'circle', r: 0.32 },
      pos: [9.5, 8],
      density: 15,
      friction: 0.4,
      restitution: 0.05,
      trace: true,
      color: '#3b82f6',
    },
    { shape: { kind: 'rect', size: [16, 0.5] }, pos: [7, -0.25], isStatic: true, friction: 0.5 },
  ],
  joints: [],
};
