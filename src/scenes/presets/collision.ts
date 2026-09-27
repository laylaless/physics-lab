import type { SceneDef } from '../schema';

/** 实验 19：一维碰撞（平面模式，弹性/非弹性对比） */
export const collision: SceneDef = {
  meta: {
    name: '一维碰撞',
    view: 'plane',
    knowledge: '动量',
    desc:
      '俯视光滑水平面：A 球（1 kg，3 m/s 向右）与 B 球（2 kg，1 m/s 向左）发生弹性正碰（e = 1）。' +
      '选中球体可在实时数据中读出动量与速度。',
    guides: [
      '碰撞前后系统总动量各是多少？相等吗？',
      '弹性碰撞动能是否也守恒？（用 |v| 和质量核算）',
      '把两个球的弹性系数 e 都改成 0，按 ↺ 重置重跑——完全非弹性碰撞后两球如何运动？',
    ],
  },
  world: { viewport: { cx: 8, cy: 1.5, widthM: 16 } },
  bodies: [
    {
      id: 'ballA',
      label: 'A',
      shape: { kind: 'circle', r: 0.25 },
      pos: [4, 1],
      v0: [3, 0],
      density: 5.09,
      friction: 0.02,
      restitution: 1,
      trace: true,
      color: '#ef4444',
    },
    {
      id: 'ballB',
      label: 'B',
      shape: { kind: 'circle', r: 0.3 },
      pos: [12, 1],
      v0: [-1, 0],
      density: 7.07,
      friction: 0.02,
      restitution: 1,
      trace: true,
      color: '#3b82f6',
    },
  ],
  joints: [],
};
