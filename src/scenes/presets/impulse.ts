import type { SceneDef } from '../schema';

/** 实验 21：动量定理（FΔt = Δp，缓冲垫降低峰值力） */
export const impulse: SceneDef = {
  meta: {
    name: '动量定理（缓冲）',
    view: 'vertical',
    knowledge: '动量',
    desc: '两个 1 kg 小球都以 6 m/s 撞向挡板：红球撞硬挡板（e = 0.9，作用时间短），橙球撞软垫（e = 0.05，作用时间长）。图表选"支持力 |N|–t"对比冲击力曲线。',
    guides: [
      '两球 |N|-t 曲线的峰值谁大？持续谁长？',
      '曲线下面积（冲量）谁大？（动量变化 Δp 相近）',
      '这解释了安全气囊的什么原理？',
    ],
  },
  world: { gravity: 9.8, viewport: { cx: 6.5, cy: 2.4, widthM: 13 } },
  bodies: [
    { shape: { kind: 'rect', size: [14, 0.5] }, pos: [6.5, -0.25], isStatic: true, friction: 0.02 },
    {
      id: 'hard',
      label: '硬碰',
      shape: { kind: 'circle', r: 0.18 },
      pos: [2, 1.2],
      v0: [6, 0],
      density: 9.82,
      friction: 0.3,
      restitution: 0.9,
      trace: true,
      color: '#ef4444',
    },
    {
      id: 'soft',
      label: '缓冲',
      shape: { kind: 'circle', r: 0.18 },
      pos: [2, 2.4],
      v0: [6, 0],
      density: 9.82,
      friction: 0.3,
      restitution: 0.05,
      trace: true,
      color: '#f59e0b',
    },
    { id: 'wall1', shape: { kind: 'rect', size: [0.3, 0.6] }, pos: [9.5, 1.2], isStatic: true, friction: 0.3 },
    { id: 'wall2', shape: { kind: 'rect', size: [0.7, 0.8] }, pos: [9.6, 2.4], isStatic: true, friction: 0.3 },
  ],
  joints: [],
};
