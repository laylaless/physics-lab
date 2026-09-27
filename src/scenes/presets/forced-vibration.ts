import type { SceneDef } from '../schema';

/** 实验 24：受迫振动与共振（驱动力频率 → 固有频率时振幅最大） */
export const forcedVibration: SceneDef = {
  meta: {
    name: '受迫振动与共振',
    view: 'vertical',
    knowledge: '振动',
    desc: '0.5 kg 振子由 k = 20 N/m 弹簧悬挂，上端驱动块做简谐驱动（A = 0.15 m，f = 0.5 Hz）。系统固有频率 f₀ = (1/2π)√(k/m) ≈ 1.0 Hz。选中上方驱动块可改频率！图表看 y-t。',
    guides: [
      'f = 0.5 Hz 时振子振幅多大？振动频率等于驱动频率吗？',
      '把驱动频率改成 1.0 Hz（≈f₀）重置重跑——振幅是不是急剧增大（共振）？',
      '选中上方驱动块勾选"扫频模式"并重置：频率自动从 0.3 扫到 2.0 Hz，振幅最大的时刻对应哪个频率？',
    ],
  },
  world: {
    gravity: 9.8,
    viewport: { cx: 6, cy: 6.5, widthM: 9 },
    drivers: [{ type: 'oscY', body: 'motor', amp: 0.15, freq: 0.5 }],
  },
  bodies: [
    {
      id: 'motor',
      label: '驱动',
      shape: { kind: 'rect', size: [0.6, 0.3] },
      pos: [6, 9],
      kinematic: true,
    },
    {
      id: 'ball',
      label: '振子',
      shape: { kind: 'circle', r: 0.18 },
      pos: [6, 7.4],
      density: 4.92,
      friction: 0.1,
      restitution: 0.1,
      trace: true,
      color: '#8b5cf6',
    },
  ],
  joints: [{ type: 'spring', a: { body: 'motor' }, b: { body: 'ball' }, k: 20, length: 1.5, damping: 0.15 }],
};
