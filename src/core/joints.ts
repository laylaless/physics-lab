import { b2, vec } from './engine';
import type { BodyRecord } from './bodies';
import { worldPoint } from './bodies';
import type { SceneJointDef, JointEnd } from '../scenes/schema';

export type JointKind = 'rod' | 'rope' | 'spring' | 'hinge' | 'slider' | 'pulley';

export const JOINT_NAMES: Record<JointKind, string> = {
  rod: '轻杆',
  rope: '绳',
  spring: '弹簧',
  hinge: '铰链',
  slider: '滑轨',
  pulley: '滑轮',
};

/** 运行期关节记录：spring 无引擎关节（应用层胡克力），其余挂 Box2D joint */
export interface JointRecord {
  kind: JointKind;
  joint: any | null;
  /** CreateJoint 返回的是基类包装，派生方法需 castObject 后缓存（如铰链马达） */
  revJoint?: any;
  /** rod/rope 距离关节派生接口缓存（改长度需 SetMinLength/SetMaxLength） */
  distJoint?: any;
  /** A 端：null = 世界固定锚（引擎侧挂 ground，localA 即世界坐标） */
  recA: BodyRecord | null;
  recB: BodyRecord;
  localA: [number, number];
  localB: [number, number];
  /** 杆/绳/弹簧的自然长度（m） */
  length: number;
  k: number;
  damping: number;
  /** slider 世界轴向（单位向量） */
  axis: [number, number];
  /** pulley */
  ratio: number;
  groundAnchorA?: [number, number];
  groundAnchorB?: [number, number];
  /** hinge 马达（小车驱动） */
  motor?: { speed: number; torque: number };
  /** spring 当前弹力大小（N，显示用） */
  forceMag: number;
}

export interface CreateJointOpts {
  length?: number;
  k?: number;
  damping?: number;
  axis?: [number, number];
  ratio?: number;
  groundAnchorA?: [number, number];
  groundAnchorB?: [number, number];
  motor?: { speed: number; torque: number };
}

function unit(v: [number, number]): [number, number] {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
}

/**
 * 创建关节。端点局部锚点：recA 为 null 时 localA 即世界坐标（ground 恒在原点无旋转）。
 * rope/rod/spring/slider/hinge 要求 recB 为动态/运动学物体。
 */
export function createJoint(
  world: any,
  ground: any,
  kind: JointKind,
  recA: BodyRecord | null,
  recB: BodyRecord,
  localA: [number, number],
  localB: [number, number],
  opts: CreateJointOpts = {},
): JointRecord {
  const bodyA = recA ? recA.body : ground;
  const bodyB = recB.body;
  const aW = worldPoint(recA, localA);
  const bW = worldPoint(recB, localB);
  const length = opts.length ?? Math.max(Math.hypot(bW[0] - aW[0], bW[1] - aW[1]), 0.05);

  const rec: JointRecord = {
    kind,
    joint: null,
    recA,
    recB,
    localA,
    localB,
    length,
    k: opts.k ?? 20,
    damping: opts.damping ?? 0.5,
    axis: unit(opts.axis ?? [1, 0]),
    ratio: opts.ratio ?? 1,
    groundAnchorA: opts.groundAnchorA,
    groundAnchorB: opts.groundAnchorB,
    motor: opts.motor,
    forceMag: 0,
  };

  switch (kind) {
    case 'rod': {
      const jd = new b2.b2DistanceJointDef();
      jd.Initialize(bodyA, bodyB, vec(aW[0], aW[1]), vec(bW[0], bW[1]));
      // 刚性杆：长度被双向锁定（可拉可压）
      jd.set_minLength(length);
      jd.set_maxLength(length);
      rec.joint = world.CreateJoint(jd);
      break;
    }
    case 'rope': {
      const jd = new b2.b2DistanceJointDef();
      jd.Initialize(bodyA, bodyB, vec(aW[0], aW[1]), vec(bW[0], bW[1]));
      // 绳：0 ~ length 内松弛自由，超过即张紧（不可伸长、不可推送）
      jd.set_minLength(0);
      jd.set_maxLength(length);
      rec.joint = world.CreateJoint(jd);
      break;
    }
    case 'spring':
      rec.joint = null; // 应用层胡克力（sim.step 中施加，力值可直接读出用于 F-x 图）
      break;
    case 'hinge': {
      const jd = new b2.b2RevoluteJointDef();
      jd.Initialize(bodyA, bodyB, vec(bW[0], bW[1]));
      if (opts.motor) {
        jd.set_enableMotor(true);
        jd.set_motorSpeed(opts.motor.speed);
        jd.set_maxMotorTorque(opts.motor.torque);
      }
      rec.joint = world.CreateJoint(jd);
      break;
    }
    case 'slider': {
      const jd = new b2.b2PrismaticJointDef();
      jd.Initialize(bodyA, bodyB, vec(bW[0], bW[1]), vec(rec.axis[0], rec.axis[1]));
      rec.joint = world.CreateJoint(jd);
      break;
    }
    case 'pulley': {
      const ga = opts.groundAnchorA ?? aW;
      const gb = opts.groundAnchorB ?? bW;
      const jd = new b2.b2PulleyJointDef();
      jd.Initialize(
        bodyA,
        bodyB,
        vec(ga[0], ga[1]),
        vec(gb[0], gb[1]),
        vec(aW[0], aW[1]),
        vec(bW[0], bW[1]),
        rec.ratio,
      );
      rec.groundAnchorA = ga;
      rec.groundAnchorB = gb;
      rec.joint = world.CreateJoint(jd);
      break;
    }
  }
  return rec;
}

/** 每步施加弹簧胡克力：F = -k·(L - L0) - c·v_rel（沿轴线） */
export function applySpringForce(rec: JointRecord): void {
  const aW = worldPoint(rec.recA, rec.localA);
  const bW = worldPoint(rec.recB, rec.localB);
  const dx = bW[0] - aW[0];
  const dy = bW[1] - aW[1];
  const dist = Math.max(Math.hypot(dx, dy), 1e-6);
  const ux = dx / dist;
  const uy = dy / dist;
  // 相对速度沿轴分量（伸长为正）
  const vA = rec.recA ? rec.recA.body.GetLinearVelocity() : { x: 0, y: 0 };
  const vB = rec.recB.body.GetLinearVelocity();
  const vRel = (vB.x - vA.x) * ux + (vB.y - vA.y) * uy;
  const f = rec.k * (dist - rec.length) + rec.damping * vRel; // >0 = 拉伸
  rec.forceMag = Math.abs(f);
  // 拉伸时把两端拉回：B 受 -u·f，A 受 +u·f（记录在物体上供力平衡反推）
  rec.recB.body.ApplyForceToCenter(vec(-ux * f, -uy * f), true);
  rec.recB.sprFx += -ux * f;
  rec.recB.sprFy += -uy * f;
  if (rec.recA) {
    rec.recA.body.ApplyForceToCenter(vec(ux * f, uy * f), true);
    rec.recA.sprFx += ux * f;
    rec.recA.sprFy += uy * f;
  }
}

/** 关节当前两端世界坐标（渲染用） */
export function jointEnds(rec: JointRecord): { a: [number, number]; b: [number, number] } {
  return { a: worldPoint(rec.recA, rec.localA), b: worldPoint(rec.recB, rec.localB) };
}

/** 引擎关节的约束反力大小（绳张力/杆力，N）；spring 用 forceMag */
export function jointReactionMag(rec: JointRecord, invDt: number): number {
  if (rec.kind === 'spring') return rec.forceMag;
  if (!rec.joint || !rec.joint.GetReactionForce) return 0;
  const f = rec.joint.GetReactionForce(invDt);
  return Math.hypot(f.x, f.y);
}

/** 取 rod/rope 的距离关节派生接口（基类包装无 SetMinLength/SetMaxLength，需 castObject） */
export function distJointOf(rec: JointRecord): any | null {
  if (!rec.joint) return null;
  rec.distJoint = rec.distJoint ?? b2.castObject(rec.joint, b2.b2DistanceJoint);
  return rec.distJoint;
}

/* ---------------- 场景定义 ⇄ 运行记录 ---------------- */

interface ResolvedEnd {
  rec: BodyRecord | null;
  local: [number, number];
}

function resolveEnd(end: JointEnd, byId: Map<string, BodyRecord>): ResolvedEnd {
  if ('world' in end) return { rec: null, local: end.world };
  return { rec: byId.get(end.body) ?? null, local: end.local ?? [0, 0] };
}

/** 从场景定义创建（含旧 distance 类型兼容：等价 rod + 世界锚） */
export function createJointFromDef(
  world: any,
  ground: any,
  def: SceneJointDef,
  byId: Map<string, BodyRecord>,
): JointRecord | null {
  if (def.type === 'distance') {
    const recB = byId.get(def.body);
    if (!recB) return null;
    const aW: [number, number] = def.anchor;
    const bW = worldPoint(recB, [0, 0]);
    const length = def.length ?? Math.max(Math.hypot(bW[0] - aW[0], bW[1] - aW[1]), 0.05);
    return createJoint(world, ground, 'rod', null, recB, aW, [0, 0], { length });
  }
  const ea = resolveEnd(def.a, byId);
  const eb = resolveEnd(def.b, byId);
  const opts = jointOptsOf(def);
  if (!ea.rec && !eb.rec) return null; // 两端都是世界锚：无效
  if (!eb.rec) {
    // B 端是世界锚：交换端点，保证动态物体在 B 端
    return createJoint(world, ground, def.type, null, ea.rec!, ea.local, eb.local, opts);
  }
  return createJoint(world, ground, def.type, ea.rec, eb.rec, ea.local, eb.local, opts);
}

function jointOptsOf(def: SceneJointDef): CreateJointOpts {
  const o: CreateJointOpts = {};
  if ((def.type === 'rod' || def.type === 'rope' || def.type === 'spring') && def.length !== undefined) {
    o.length = def.length;
  }
  if (def.type === 'spring') {
    o.k = def.k;
    if (def.damping !== undefined) o.damping = def.damping;
  }
  if (def.type === 'hinge' && def.motor) o.motor = { ...def.motor };
  if (def.type === 'slider' && def.axis) o.axis = def.axis;
  if (def.type === 'pulley') {
    o.groundAnchorA = def.groundAnchorA;
    o.groundAnchorB = def.groundAnchorB;
    if (def.ratio !== undefined) o.ratio = def.ratio;
  }
  return o;
}

/** 序列化（世界锚保持原坐标；物体端点存 body id + local） */
export function jointToDef(rec: JointRecord): SceneJointDef {
  const a: JointEnd = rec.recA ? { body: rec.recA.meta.id, local: rec.localA } : { world: rec.localA };
  const b: JointEnd = { body: rec.recB.meta.id, local: rec.localB };
  switch (rec.kind) {
    case 'rod':
      return { type: 'rod', a, b, length: rec.length };
    case 'rope':
      return { type: 'rope', a, b, length: rec.length };
    case 'spring':
      return { type: 'spring', a, b, k: rec.k, length: rec.length, damping: rec.damping };
    case 'hinge':
      return { type: 'hinge', a, b, motor: rec.motor ? { ...rec.motor } : undefined };
    case 'slider':
      return { type: 'slider', a, b, axis: rec.axis };
    case 'pulley':
      return {
        type: 'pulley',
        a,
        b,
        groundAnchorA: rec.groundAnchorA ?? [0, 0],
        groundAnchorB: rec.groundAnchorB ?? [0, 0],
        ratio: rec.ratio,
      };
  }
}
