import type { SceneDef } from '../schema';

/** 实验 2：匀变速直线运动（平面模式，恒力 F 作用下 a = F/m） */
export const uniformAccel: SceneDef = {
  meta: {
    name: '匀变速直线运动',
    view: 'plane',
    knowledge: '运动学',
    desc: '俯视光滑水平面：滑块 m = 1 kg 受水平恒力 F = 2 N。打开加速度矢量观察 a 的大小与方向。',
    guides: [
      '理论 a = F/m = 2/1 = 2 m/s²，与矢量读数一致吗？',
      '在右侧面板把密度改为 5（质量变为 2 kg），重置重跑，a 变为多少？（F 不变的控制变量）',
      '频闪点间距如何变化？相邻间距之差是否恒定？',
    ],
  },
  world: { viewport: { cx: 6, cy: 1, widthM: 16 } },
  bodies: [
    {
      id: 'block',
      label: '滑块',
      shape: { kind: 'rect', size: [0.8, 0.5] },
      pos: [1, 0.8],
      density: 2.5,
      friction: 0.02,
      restitution: 0.1,
      trace: true,
      color: '#3b82f6',
      force: [2, 0],
    },
  ],
  joints: [],
};
