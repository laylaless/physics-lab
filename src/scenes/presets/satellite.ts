import type { SceneDef } from '../schema';

/** 实验 25（进阶）：万有引力与卫星轨道（F = GMm/r²） */
export const satellite: SceneDef = {
  meta: {
    name: '卫星轨道（万有引力）',
    view: 'vertical',
    knowledge: '进阶',
    desc: '中央行星（GM = 60）与 5 m 高度发射的卫星。切向速度恰为圆轨道速度 v = √(GM/r) = 3.46 m/s 时做匀速圆周运动。注意：此场景世界重力为 0，引力由中心力场按 F = GMm/r² 施加。',
    guides: [
      'v₀ = 3.46 m/s 时轨道是圆吗？（向心加速度 = GM/r²）',
      '把 vy 改成 4.5 m/s 重置——轨道变成什么形状？（椭圆，远地点变远）',
      '改成 2.5 m/s 呢？（坠落撞向行星）',
    ],
  },
  world: {
    gravity: 0,
    viewport: { cx: 7, cy: 5.5, widthM: 13 },
    fields: [{ type: 'centralGravity', gm: 60, center: 'planet' }],
  },
  bodies: [
    {
      id: 'planet',
      label: '行星',
      shape: { kind: 'point', r: 0.45 },
      pos: [7, 5.5],
      isStatic: true,
      color: '#0f172a',
    },
    {
      id: 'sat',
      label: '卫星',
      shape: { kind: 'point' },
      pos: [12, 5.5],
      v0: [0, 3.46],
      trace: true,
      color: '#ef4444',
    },
  ],
  joints: [],
};
