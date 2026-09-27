import type { SceneDef } from '../schema';

/** 实验 18：摩擦生热与能量守恒（Q = μmg·d） */
export const frictionHeat: SceneDef = {
  meta: {
    name: '摩擦生热（Q = μmg·d）',
    view: 'vertical',
    knowledge: '机械能',
    desc: '滑块 m = 1 kg 以 6 m/s 冲上 μ ≈ 0.4 的粗糙水平面。滑行距离 d = v²/(2μg) ≈ 4.6 m 后停止，全部动能转化为内能（选中看"摩擦生热 Q"）。',
    guides: [
      '停下时 Q ≈ ½mv² = 18 J 吗？（能量账本对平）',
      '实测滑行距离 ≈ 4.6 m 吗？（用标尺量）',
      '把初速度改成 12 m/s 重置，滑行距离变为几倍？（∝ v²）',
    ],
  },
  world: { gravity: 9.8, viewport: { cx: 7, cy: 1.8, widthM: 16 } },
  bodies: [
    { shape: { kind: 'rect', size: [18, 0.5] }, pos: [7, -0.25], isStatic: true, friction: 0.4 },
    {
      id: 'block',
      label: '滑块',
      shape: { kind: 'rect', size: [0.5, 0.4] },
      pos: [1.5, 0.95],
      v0: [6, 0],
      density: 5,
      friction: 0.4,
      restitution: 0.05,
      trace: true,
      color: '#f97316',
    },
  ],
  joints: [],
};
