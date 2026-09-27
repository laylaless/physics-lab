import type { SceneDef } from '../schema';

/** 实验 20：反冲（人船模型，动量守恒） */
export const recoil: SceneDef = {
  meta: {
    name: '反冲（人船模型）',
    view: 'vertical',
    knowledge: '动量',
    desc: '冰面（μ≈0）上 m₁ = 1 kg 与 m₂ = 2 kg 两滑块被压缩弹簧（k = 40 N/m）弹开。总动量恒为 0：速度比 1:2，位移比 2:1。',
    guides: [
      '图表看 vx：两滑块速度大小之比是 2:1 吗？（与质量成反比；黑色虚线为理论值）',
      '暂停后用 📏 标尺量两滑块的位移 x₁、x₂——x₁/x₂ = m₂/m₁ = 2 吗？（人船模型）',
      '把 m₂ 密度减半（变 1 kg）重置——两边速度、位移还不同吗？',
    ],
  },
  world: { gravity: 9.8, viewport: { cx: 6.5, cy: 1.8, widthM: 15 } },
  bodies: [
    { shape: { kind: 'rect', size: [15, 0.5] }, pos: [6.5, -0.25], isStatic: true, friction: 0.01 },
    {
      id: 'm1',
      label: 'm₁',
      shape: { kind: 'rect', size: [0.4, 0.4] },
      pos: [5.7, 0.95],
      density: 6.25,
      friction: 0.01,
      restitution: 0.05,
      trace: true,
      color: '#ef4444',
    },
    {
      id: 'm2',
      label: 'm₂',
      shape: { kind: 'rect', size: [0.4, 0.4] },
      pos: [6.7, 0.95],
      density: 12.5,
      friction: 0.01,
      restitution: 0.05,
      trace: true,
      color: '#3b82f6',
    },
  ],
  joints: [{ type: 'spring', a: { body: 'm1' }, b: { body: 'm2' }, k: 40, length: 1.6, damping: 0.3 }],
};
