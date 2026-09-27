import { b2, vec } from './engine';
import type { SceneBodyDef, ForceItem } from '../scenes/schema';
import { wedgeVerts, arcSegments, arcBasePieces, setPolygonVerts } from './geometry';

/** 图表采样点（探针数据，30 Hz） */
export interface Sample {
  t: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  sp: number;
  ax: number;
  ay: number;
  ek: number;
  ep: number;
  /** 接触法向力合力 |N|（N） */
  en: number;
}

export const SAMPLE_MAX = 1800; // 60 s @30Hz

/** 运行期挂在每个刚体上的记录：元数据 + 轨迹 + 度量缓存 */
export interface BodyRecord {
  body: any;
  meta: {
    id: string;
    shape:
      | { kind: 'rect'; size: [number, number] }
      | { kind: 'circle'; r: number }
      /** 质点的 r 仅为显示半径（外观），碰撞半径恒为 POINT_R */
      | { kind: 'point'; r: number }
      | { kind: 'wedge'; w: number; h: number }
      | { kind: 'arc'; r: number; t: number; span: number; base?: true };
    isStatic: boolean;
    isKinematic: boolean;
    /** 视为质点：固定旋转只平动；质点形状恒为 true */
    asPoint: boolean;
    density: number;
    friction: number;
    restitution: number;
    gravityScale: number;
    trace: boolean;
    color?: string;
    label?: string;
    /** 初始速度：序列化/重置用，编辑 vx/vy 时更新 */
    v0: [number, number];
    /** 恒力（N），每步施加 */
    force?: [number, number];
    /** 多个命名恒力（力的合成） */
    forces?: ForceItem[];
    /** 水平力随时间线性增大（静摩擦实验） */
    forceRamp?: { from: number; to: number; duration: number };
    /** 复合对象分组（小车）：删除任一成员整组移除 */
    group?: string;
    /** 小车车厢驱动速度（m/s） */
    drive?: number;
  };
  tracePts: { x: number; y: number }[];
  strobePts: { x: number; y: number }[];
  lastStrobeT: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  prevVx: number;
  prevVy: number;
  /* —— 接触反推量（contacts.ts 每步更新） —— */
  /** 本步支持力合力（N），世界坐标方向 */
  cnx: number;
  cny: number;
  /** 本步摩擦力合力（N） */
  cfx: number;
  cfy: number;
  /** 显示用平滑值 */
  dnx: number;
  dny: number;
  dfx: number;
  dfy: number;
  /** 摩擦生热累积（J） */
  heat: number;
  /** 外力做功累积（J）：force/forces/forceRamp 的功率积分 */
  workExt: number;
  /** 摩擦力对物体做功累积（J，负值） */
  workFric: number;
  /** 本步施加的外力（N，力平衡反推用） */
  appFx: number;
  appFy: number;
  /** 本步弹簧施加的胡克力（N） */
  sprFx: number;
  sprFy: number;
  /** 图表采样序列 */
  samples: Sample[];
}

/** 质点的碰撞半径（米）：物理上取极小圆，绘制时保证最小像素尺寸 */
export const POINT_R = 0.06;
/** 质点工具的默认质量（kg），密度按此反推（质点面积无教学意义，直接以质量为准） */
export const POINT_DEFAULT_MASS = 1;

export function pointDensity(mass: number): number {
  return mass / (Math.PI * POINT_R * POINT_R);
}

export const PALETTE = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#6366f1'];

let idSeq = 1;

/** 按形状在刚体上创建全部 fixture（弧形轨道 = 多段偏移旋转盒子拼合）；
 *  顶点几何统一来自 geometry.ts，与渲染/拾取共享同一来源 */
function buildFixtures(
  body: any,
  shape: SceneBodyDef['shape'],
  density: number,
  friction: number,
  restitution: number,
): void {
  const mkFd = (): any => {
    const fd = new b2.b2FixtureDef();
    fd.set_density(density);
    fd.set_friction(friction);
    fd.set_restitution(restitution);
    return fd;
  };
  if (shape.kind === 'rect') {
    const fd = mkFd();
    const s = new b2.b2PolygonShape();
    s.SetAsBox(shape.size[0] / 2, shape.size[1] / 2);
    fd.set_shape(s);
    body.CreateFixture(fd);
  } else if (shape.kind === 'wedge') {
    const fd = mkFd();
    const s = new b2.b2PolygonShape();
    setPolygonVerts(s, wedgeVerts(shape.w, shape.h));
    fd.set_shape(s);
    body.CreateFixture(fd);
  } else if (shape.kind === 'arc') {
    if (shape.base) {
      // 有底座：径向切片拼出"外接矩形 − 内弧凹槽"
      for (const p of arcBasePieces(shape.r, shape.t, shape.span)) {
        const fd = mkFd();
        const s = new b2.b2PolygonShape();
        setPolygonVerts(s, p.verts);
        fd.set_shape(s);
        body.CreateFixture(fd);
      }
    } else {
      for (const seg of arcSegments(shape.r, shape.t, shape.span)) {
        const fd = mkFd();
        const s = new b2.b2PolygonShape();
        s.SetAsBox(seg.halfLen, seg.halfTh, vec(seg.cx, seg.cy), seg.angle);
        fd.set_shape(s);
        body.CreateFixture(fd);
      }
    }
  } else {
    // 圆形与质点共用圆 fixture；质点碰撞半径恒为 POINT_R，shape.r 只是显示半径（外观）
    const fd = mkFd();
    const s = new b2.b2CircleShape();
    s.set_m_radius(shape.kind === 'point' ? POINT_R : shape.r);
    fd.set_shape(s);
    body.CreateFixture(fd);
  }
}

export function createBody(world: any, def: SceneBodyDef): BodyRecord {
  const id = def.id ?? `b${idSeq++}`;
  const asPoint = def.shape.kind === 'point' || def.asPoint !== false;
  const bd = new b2.b2BodyDef();
  bd.set_type(def.kinematic ? b2.b2_kinematicBody : def.isStatic ? b2.b2_staticBody : b2.b2_dynamicBody);
  bd.set_position(vec(def.pos[0], def.pos[1]));
  bd.set_angle(def.angle ?? 0);
  bd.set_gravityScale(def.gravityScale ?? 1);
  const body = world.CreateBody(bd);

  const density =
    def.isStatic || def.kinematic
      ? 0
      : (def.density ?? (def.shape.kind === 'point' ? pointDensity(POINT_DEFAULT_MASS) : 1));
  buildFixtures(body, def.shape, density, def.friction ?? 0.3, def.restitution ?? 0.2);

  const v0: [number, number] = def.v0 ?? [0, 0];
  if (!def.isStatic && !def.kinematic) body.SetLinearVelocity(vec(v0[0], v0[1]));
  // 教学模拟禁用睡眠：避免"悬空睡着不动"、暂停编辑后不响应等怪象
  if (!def.isStatic) body.SetSleepingAllowed(false);
  // 视为质点 → 固定旋转：只平动、不转动，碰撞/摩擦力矩不再产生角加速度
  if (!def.isStatic && asPoint) body.SetFixedRotation(true);

  return {
    body,
    meta: {
      id,
      shape: def.shape.kind === 'point' ? { kind: 'point', r: def.shape.r ?? POINT_R } : def.shape,
      isStatic: !!def.isStatic,
      isKinematic: !!def.kinematic,
      asPoint,
      density,
      friction: def.friction ?? 0.3,
      restitution: def.restitution ?? 0.2,
      gravityScale: def.gravityScale ?? 1,
      trace: def.trace ?? false,
      color: def.color ?? (def.isStatic ? '#94a3b8' : PALETTE[idSeq % PALETTE.length]),
      label: def.label,
      v0,
      force: def.force,
      forces: def.forces,
      forceRamp: def.forceRamp,
      group: def.group,
      drive: def.drive,
    },
    tracePts: [],
    strobePts: [],
    lastStrobeT: -1,
    vx: v0[0],
    vy: v0[1],
    ax: 0,
    ay: 0,
    prevVx: v0[0],
    prevVy: v0[1],
    cnx: 0,
    cny: 0,
    cfx: 0,
    cfy: 0,
    dnx: 0,
    dny: 0,
    dfx: 0,
    dfy: 0,
    heat: 0,
    workExt: 0,
    workFric: 0,
    appFx: 0,
    appFy: 0,
    sprFx: 0,
    sprFy: 0,
    samples: [],
  };
}

export function destroyBody(world: any, rec: BodyRecord): void {
  world.DestroyBody(rec.body);
}

/** 可手动改尺寸的形状（质点除外——质点改尺寸只动显示半径，不重建 fixture） */
export type ResizableShape = Extract<
  BodyRecord['meta']['shape'],
  { kind: 'rect' | 'circle' | 'wedge' | 'arc' }
>;

/** 当前形状对应的 fixture 数量（销毁重建用；弧形轨道是多 fixture） */
function fixtureCount(shape: BodyRecord['meta']['shape']): number {
  if (shape.kind === 'arc') {
    return shape.base
      ? arcBasePieces(shape.r, shape.t, shape.span).length
      : arcSegments(shape.r, shape.t, shape.span).length;
  }
  return 1;
}

/** 手动输入改尺寸：fixture 不可原地缩放，按 meta 中的密度/摩擦/弹性销毁重建；
 *  密度不变、质量 = 密度 × 新面积自动重算，位置/角度/速度/固定旋转等 body 级状态全部保留 */
export function resizeShape(rec: BodyRecord, shape: ResizableShape): void {
  const body = rec.body;
  // 逐个取链表头销毁（DestroyFixture 后节点失效，不能边遍历边删）；
  // 次数由当前形状确定（链表尾部是真值哨兵，不能用真值判断结尾）
  const n = fixtureCount(rec.meta.shape);
  for (let i = 0; i < n; i++) body.DestroyFixture(body.GetFixtureList());
  buildFixtures(body, shape, rec.meta.isStatic ? 0 : rec.meta.density, rec.meta.friction, rec.meta.restitution);
  body.ResetMassData();
  // 尺寸变化可能解除/新增接触，唤醒参与求解
  body.SetAwake(true);
  rec.meta.shape = shape;
}

/** 遍历刚体全部 fixture（弧形轨道是多 fixture；SetFriction/SetDensity 等需逐个应用）。
 *  注意：链表尾部 GetNext() 返回真值哨兵对象（非 JS null），不能靠真值判断结尾；
 *  fixture 只在 buildFixtures 创建，数量可由形状确定推出，按数量有界迭代 */
export function eachFixture(rec: BodyRecord, fn: (f: any) => void): void {
  let f = rec.body.GetFixtureList();
  for (let i = 0; i < fixtureCount(rec.meta.shape) && f; i++) {
    fn(f);
    f = f.GetNext();
  }
}

/** 世界坐标下刚体上某局部锚点的位置（手算，避免引擎每帧分配） */
export function worldPoint(rec: BodyRecord | null, local: [number, number]): [number, number] {
  if (!rec) return local; // 世界锚（ground 恒位于原点、无旋转，local 即世界坐标）
  const p = rec.body.GetPosition();
  const a = rec.body.GetAngle();
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [p.x + local[0] * c - local[1] * s, p.y + local[0] * s + local[1] * c];
}
