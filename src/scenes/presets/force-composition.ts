import type { SceneDef } from '../schema';

/** 实验 8：力的合成与分解（平行四边形定则，平面无重力） */
export const forceComposition: SceneDef = {
  meta: {
    name: '力的合成与分解',
    view: 'plane',
    knowledge: '相互作用',
    desc: '俯视无重力平面上的质点（m = 1 kg）同时受 F₁ = (3, 0) N 与 F₂ = (0, 4) N。紫红箭头为两分力，红色 ΣF 为合力。',
    guides: [
      '合力 ΣF 的大小与方向？（3-4-5：5 N，53°）——满足平行四边形定则吗？',
      '在属性面板把 F₂ 改成 (−3, 0)，合力变为多少？（反向相减）',
      '把 F₁ 改成 (4, 0)、F₂ 改成 (3, 0)，合力多大？（同向相加）',
    ],
  },
  world: { viewport: { cx: 4, cy: 3, widthM: 16 } },
  bodies: [
    {
      id: 'pt',
      label: '质点',
      shape: { kind: 'point' },
      pos: [2, 3],
      trace: true,
      color: '#3b82f6',
      forces: [
        { v: [3, 0], label: 'F₁' },
        { v: [0, 4], label: 'F₂' },
      ],
    },
  ],
  joints: [],
};
