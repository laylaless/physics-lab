import type { SceneDef } from '../schema';

/** 实验 13：水平面内的匀速圆周运动（F = mv²/r） */
export const horizontalCircle: SceneDef = {
  meta: {
    name: '水平圆周运动',
    view: 'plane',
    knowledge: '圆周运动',
    desc: '俯视：轻绳一端固定于圆心，另一端系 1 kg 小球，以 3 m/s 切向速度绕行。向心力 = 绳张力 = mv²/r = 4.5 N（选中球看实时数据"绳张力 T"）。',
    guides: [
      '加速度矢量始终指向圆心吗？大小 ≈ v²/r = 4.5 m/s² 吗？',
      '把初速度 vx 改成 4.5 m/s 重置，张力 T 变为多少？（∝ v²）',
      '绳张力 T 的读数与 mv²/r 一致吗？',
    ],
  },
  world: { viewport: { cx: 8, cy: 2, widthM: 11 } },
  bodies: [
    {
      id: 'ball',
      label: '小球',
      shape: { kind: 'circle', r: 0.2 },
      pos: [10, 2],
      v0: [0, 3],
      density: 7.96,
      friction: 0.1,
      restitution: 0.1,
      trace: true,
      color: '#8b5cf6',
    },
  ],
  joints: [{ type: 'rope', a: { world: [8, 2] }, b: { body: 'ball' }, length: 2 }],
};
