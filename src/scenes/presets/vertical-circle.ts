import type { SceneDef } from '../schema';

/** 实验 14：竖直面内的圆周运动（过最高点临界速度 √(gr)） */
export const verticalCircle: SceneDef = {
  meta: {
    name: '竖直圆周运动',
    view: 'vertical',
    knowledge: '圆周运动',
    desc: '绳系 1 kg 小球绕固定点做竖直圆周运动。底部速度 8 m/s > 临界 √(5gr) = 7.67 m/s，能过最高点。把 vx 改小试试！',
    guides: [
      'vx = 8 时小球能通过最高点吗？最高点速度多大？',
      '把初速度 vx 改成 6.5 m/s 重置——小球在哪脱离圆轨道做斜抛？（临界 √(5gr)）',
      '最高/最低点绳张力差是 6mg 吗？（选中看"绳张力 T"）',
    ],
  },
  world: { gravity: 9.8, viewport: { cx: 8, cy: 5.5, widthM: 11 } },
  bodies: [
    {
      id: 'ball',
      label: '小球',
      shape: { kind: 'circle', r: 0.15 },
      pos: [8, 5.8],
      v0: [8, 0],
      density: 14.15,
      friction: 0.1,
      restitution: 0.1,
      trace: true,
      color: '#ef4444',
    },
  ],
  joints: [{ type: 'rope', a: { world: [8, 7] }, b: { body: 'ball' }, length: 1.2 }],
};
