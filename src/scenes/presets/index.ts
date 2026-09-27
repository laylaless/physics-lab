import type { SceneDef } from '../schema';
import { uniformMotion } from './uniform-motion';
import { uniformAccel } from './uniform-accel';
import { freeFall } from './free-fall';
import { projectile } from './projectile';
import { obliqueThrow } from './oblique-throw';
import { hooke } from './hooke';
import { frictionStatic } from './friction-static';
import { forceComposition } from './force-composition';
import { newton2 } from './newton2';
import { newton3 } from './newton3';
import { elevator } from './elevator';
import { incline } from './incline';
import { inclinePulley } from './incline-pulley';
import { horizontalCircle } from './horizontal-circle';
import { verticalCircle } from './vertical-circle';
import { workEnergy } from './work-energy';
import { energyConservation } from './energy-conservation';
import { springEnergy } from './spring-energy';
import { frictionHeat } from './friction-heat';
import { collision } from './collision';
import { recoil } from './recoil';
import { impulse } from './impulse';
import { springOscillator } from './spring-oscillator';
import { pendulum } from './pendulum';
import { forcedVibration } from './forced-vibration';
import { satellite } from './satellite';

export interface PresetEntry {
  id: string;
  group: string;
  def: SceneDef;
}

/** 预设实验注册表：按教材知识点分组（对应 docs/FEATURES.md 第四章，24+1 个全量） */
export const PRESETS: PresetEntry[] = [
  { id: 'uniform-motion', group: '运动学', def: uniformMotion },
  { id: 'uniform-accel', group: '运动学', def: uniformAccel },
  { id: 'free-fall', group: '运动学', def: freeFall },
  { id: 'projectile', group: '运动学', def: projectile },
  { id: 'oblique-throw', group: '运动学', def: obliqueThrow },
  { id: 'hooke', group: '相互作用与牛顿定律', def: hooke },
  { id: 'friction-static', group: '相互作用与牛顿定律', def: frictionStatic },
  { id: 'force-composition', group: '相互作用与牛顿定律', def: forceComposition },
  { id: 'newton2', group: '相互作用与牛顿定律', def: newton2 },
  { id: 'newton3', group: '相互作用与牛顿定律', def: newton3 },
  { id: 'elevator', group: '相互作用与牛顿定律', def: elevator },
  { id: 'incline', group: '相互作用与牛顿定律', def: incline },
  { id: 'incline-pulley', group: '相互作用与牛顿定律', def: inclinePulley },
  { id: 'horizontal-circle', group: '圆周运动', def: horizontalCircle },
  { id: 'vertical-circle', group: '圆周运动', def: verticalCircle },
  { id: 'work-energy', group: '机械能', def: workEnergy },
  { id: 'energy-conservation', group: '机械能', def: energyConservation },
  { id: 'spring-energy', group: '机械能', def: springEnergy },
  { id: 'friction-heat', group: '机械能', def: frictionHeat },
  { id: 'collision', group: '动量', def: collision },
  { id: 'recoil', group: '动量', def: recoil },
  { id: 'impulse', group: '动量', def: impulse },
  { id: 'spring-oscillator', group: '振动', def: springOscillator },
  { id: 'pendulum', group: '振动', def: pendulum },
  { id: 'forced-vibration', group: '振动', def: forcedVibration },
  { id: 'satellite', group: '进阶', def: satellite },
];
