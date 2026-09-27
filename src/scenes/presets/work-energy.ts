import type { SceneDef } from '../schema';

/** 实验 15：动能定理（W合 = ΔEk，外力功/摩擦功对账） */
export const workEnergy: SceneDef = {
  meta: {
    name: '动能定理（W合 = ΔEk）',
    view: 'vertical',
    knowledge: '机械能',
    desc: '滑块 m = 1 kg 受恒力 F = 3 N 从光滑段（μ≈0）滑入粗糙段（μ≈0.55）。选中滑块看实时数据：外力功 W外、摩擦功 Wf、动能 Ek——三者满足 Ek = W外 + Wf。',
    guides: [
      '光滑段：Ek ≈ W外 吗？（只有外力做功）',
      '进入粗糙段后 Wf 变负，Ek 增速如何变化？',
      '最终停下时（把 F 改成 0 试），Ek = 0，W外 + Wf = 0 对吗？',
    ],
  },
  world: { gravity: 9.8, viewport: { cx: 7, cy: 1.8, widthM: 16 } },
  bodies: [
    { shape: { kind: 'rect', size: [6.4, 0.5] }, pos: [2.7, -0.25], isStatic: true, friction: 0.02 },
    { shape: { kind: 'rect', size: [9, 0.5] }, pos: [10.4, -0.25], isStatic: true, friction: 0.55 },
    {
      id: 'block',
      label: '滑块',
      shape: { kind: 'rect', size: [0.5, 0.4] },
      pos: [0.8, 0.95],
      density: 5,
      friction: 0.3,
      restitution: 0.05,
      trace: true,
      color: '#3b82f6',
      force: [3, 0],
    },
  ],
  joints: [],
};
