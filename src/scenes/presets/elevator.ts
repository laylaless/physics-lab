import type { SceneDef } from '../schema';

/** 实验 11：超重与失重（电梯 + 测力计读数 = 支持力 N） */
export const elevator: SceneDef = {
  meta: {
    name: '超重与失重（电梯）',
    view: 'vertical',
    knowledge: '牛顿定律',
    desc: '物块 m = 2 kg 站在电梯上。电梯按脚本运动：上升加速→匀速→减速→停→下降加速→匀速→减速。选中物块，实时数据里的"支持力 |N|"就是测力计读数（静止时 19.6 N），也可打开支持力 N 矢量或看 |N|–t 图。',
    guides: [
      '哪个阶段 |N| > 19.6 N（超重）？哪个阶段 < 19.6 N（失重）？',
      '加速阶段 |N| = m(g+a) = 2×(9.8+1.5) = 22.6 N，与读数一致吗？',
      '下降加速阶段是超重还是失重？',
    ],
  },
  world: {
    gravity: 9.8,
    viewport: { cx: 6, cy: 3.6, widthM: 10 },
    drivers: [
      {
        type: 'elevator',
        body: 'lift',
        profile: [
          { ay: 1.5, dt: 2 },
          { ay: 0, dt: 2 },
          { ay: -1.5, dt: 2 },
          { ay: 0, dt: 1.5 },
          { ay: -1.5, dt: 2 },
          { ay: 0, dt: 2 },
          { ay: 1.5, dt: 2 },
          { ay: 0, dt: 2 },
        ],
      },
    ],
  },
  bodies: [
    { shape: { kind: 'rect', size: [10, 0.5] }, pos: [6, -0.25], isStatic: true, friction: 1 },
    { id: 'lift', shape: { kind: 'rect', size: [3, 0.3] }, pos: [6, 1], kinematic: true, friction: 0.9 },
    {
      id: 'box',
      label: '物块',
      shape: { kind: 'rect', size: [0.5, 0.5] },
      pos: [6, 1.41],
      density: 8,
      friction: 0.9,
      restitution: 0,
      trace: false,
      color: '#0ea5e9',
    },
  ],
  joints: [],
};
