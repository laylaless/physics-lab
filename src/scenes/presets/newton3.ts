import type { SceneDef } from '../schema';

/** 实验 10：牛顿第三定律（碰撞瞬间相互作用力等大反向） */
export const newton3: SceneDef = {
  meta: {
    name: '牛顿第三定律',
    view: 'plane',
    knowledge: '牛顿定律',
    desc: '俯视光滑平面：A 球（1 kg，3 m/s）撞向静止的 B 球（3 kg）。图表选"支持力 |N|–t"观察碰撞瞬间的相互作用力。',
    guides: [
      '选中两球分别看 |N| 峰值——相等吗？（与质量无关，等大反向）',
      '碰撞前后总动量守恒吗？（用 |v|×m 核算）',
      '把 B 球质量改大 10 倍重置，结论变吗？',
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
      shape: { kind: 'circle', r: 0.32 },
      pos: [12, 1],
      density: 9.32,
      friction: 0.02,
      restitution: 1,
      trace: true,
      color: '#3b82f6',
    },
  ],
  joints: [],
};
