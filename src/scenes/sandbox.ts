import type { SceneDef, ViewMode } from './schema';

export function sandboxScene(view: ViewMode): SceneDef {
  if (view === 'plane') {
    return {
      meta: {
        name: '沙盒 · 平面（俯视）',
        view: 'plane',
        desc:
          '俯视水平桌面，重力垂直屏幕向内、不参与平面内运动。适合：惯性、摩擦、碰撞与动量守恒。' +
          '用左侧工具拖拽创建物体，右侧面板调参数。',
      },
      world: { viewport: { cx: 0, cy: 0, widthM: 18 } },
      bodies: [],
      joints: [],
    };
  }
  return {
    meta: {
      name: '沙盒 · 垂直（侧视）',
      view: 'vertical',
      desc:
        '侧视竖直面，重力沿屏幕向下（顶部可调 g，试试 1.63 月球）。' +
        '适合：自由落体、抛体、斜面、单摆、能量转化。',
    },
    world: { gravity: 9.8, viewport: { cx: 0, cy: 4, widthM: 16 } },
    bodies: [
      { shape: { kind: 'rect', size: [30, 0.5] }, pos: [0, -0.25], isStatic: true, friction: 0.6 },
      {
        label: '木块',
        shape: { kind: 'rect', size: [0.6, 0.6] },
        pos: [-3, 0.6],
        density: 1,
        friction: 0.35,
        restitution: 0.3,
        color: '#c89f6a',
        trace: true,
      },
      {
        label: '小球',
        shape: { kind: 'circle', r: 0.3 },
        pos: [1, 3],
        density: 1,
        friction: 0.3,
        restitution: 0.6,
        color: '#ef4444',
        trace: true,
      },
    ],
    joints: [],
  };
}
