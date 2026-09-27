import { b2, vec } from './engine';
import { createBody, type BodyRecord, type Sample } from './bodies';
import {
  createJoint,
  createJointFromDef,
  jointToDef,
  applySpringForce,
  type JointRecord,
  type JointKind,
  type CreateJointOpts,
} from './joints';
import { accumulateContacts } from './contacts';
import type {
  SceneDef,
  SceneBodyDef,
  SceneDriverDef,
  SceneFieldDef,
  ViewMode,
} from '../scenes/schema';

export const FIXED_DT = 1 / 60; // 物理固定步长（s）
export const STROBE_DT = 0.1; // 频闪打点间隔（s）
export const TRACE_MAX = 2400; // 轨迹点上限

/** 驱动器运行状态（电梯 / 振动马达） */
interface DriverState {
  def: SceneDriverDef;
  rec: BodyRecord;
  vy: number; // elevator 当前速度
  phaseI: number;
  phaseT: number;
  x0: number;
  baseY: number; // oscY 平衡位置
  /** oscY 相位累积（rad），扫频时避免 sin(2πf·t) 的相位跳变 */
  phase: number;
}

export class Sim {
  world: any = null as any;
  /** 静止参考体：鼠标关节 bodyA / 世界锚载体，无 fixture 不参与碰撞 */
  ground: any = null as any;
  records: BodyRecord[] = [];
  joints: JointRecord[] = [];
  drivers: DriverState[] = [];
  fields: SceneFieldDef[] = [];
  t = 0;
  view: ViewMode = 'vertical';
  gravity = 9.8;
  sceneName = '场景';
  /** 重置用的场景快照（最近一次编辑确认后的状态） */
  snapshotDef: SceneDef | null = null;
  /** body 包装对象 → 记录（接触反推用；embind 保证同 C++ 对象返回同一 JS 包装） */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bodyByPtr = new Map<any, BodyRecord>();
  /** 运行中拖拽的鼠标关节（力平衡反推需计入其反力） */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mouseJoint: any = null;
  mouseJointRec: BodyRecord | null = null;
  private cartSeq = 0;
  private sampleTick = 0;

  load(def: SceneDef): void {
    this.view = def.meta.view;
    this.gravity = def.world.gravity ?? 9.8;
    this.sceneName = def.meta.name;
    // 平面模式（俯视水平桌面）：重力垂直屏幕向内，2D 世界中为 0
    this.world = new b2.b2World(vec(0, this.view === 'vertical' ? -this.gravity : 0));
    const gd = new b2.b2BodyDef();
    this.ground = this.world.CreateBody(gd);
    this.records = [];
    this.joints = [];
    this.drivers = [];
    this.t = 0;
    this.cartSeq = 0;
    this.sampleTick = 0;
    this.bodyByPtr.clear();
    // 鼠标关节属于被丢弃的旧世界，引用一并作废
    this.mouseJoint = null;
    this.mouseJointRec = null;

    for (const bdef of def.bodies) {
      const rec = createBody(this.world, bdef);
      this.records.push(rec);
      this.bodyByPtr.set(rec.body, rec);
    }
    const byId = new Map(this.records.map(r => [r.meta.id, r] as const));
    // 小车序号越过已恢复的 cart-N 分组，避免之后新增小车与旧车同组
    // （同组会被整组选中/删除，重置与撤销后都必须避开）
    for (const r of this.records) {
      const m = /^cart-(\d+)/.exec(r.meta.group ?? '');
      if (m) this.cartSeq = Math.max(this.cartSeq, Number(m[1]));
    }
    for (const jdef of def.joints ?? []) {
      const j = createJointFromDef(this.world, this.ground, jdef, byId);
      if (j) this.joints.push(j);
    }
    for (const ddef of def.world.drivers ?? []) {
      const rec = byId.get(ddef.body);
      if (!rec) continue;
      const p = rec.body.GetPosition();
      this.drivers.push({ def: ddef, rec, vy: 0, phaseI: 0, phaseT: 0, x0: p.x, baseY: p.y, phase: 0 });
    }
    this.fields = (def.world.fields ?? []).filter(f => byId.has(f.center) || f.center === undefined);
  }

  addBody(def: SceneBodyDef): BodyRecord {
    const rec = createBody(this.world, def);
    this.records.push(rec);
    this.bodyByPtr.set(rec.body, rec);
    return rec;
  }

  addJoint(
    kind: JointKind,
    a: { rec: BodyRecord | null; local: [number, number] },
    b: { rec: BodyRecord; local: [number, number] },
    opts?: CreateJointOpts,
  ): JointRecord {
    const j = createJoint(this.world, this.ground, kind, a.rec, b.rec, a.local, b.local, opts);
    this.joints.push(j);
    return j;
  }

  removeJoint(j: JointRecord): void {
    if (j.joint) this.world.DestroyJoint(j.joint);
    this.joints = this.joints.filter(x => x !== j);
  }

  removeBody(rec: BodyRecord): void {
    // 成组物体（小车）：删除任一成员 → 整组移除
    const group = rec.meta.group;
    const victims = group ? this.records.filter(r => r.meta.group === group) : [rec];
    for (const v of victims) {
      this.joints = this.joints.filter(j => {
        if (j.recA === v || j.recB === v) {
          if (j.joint) this.world.DestroyJoint(j.joint);
          return false;
        }
        return true;
      });
      this.world.DestroyBody(v.body);
      this.bodyByPtr.delete(v.body);
    }
    this.records = this.records.filter(r => !victims.includes(r));
    this.drivers = this.drivers.filter(d => !victims.includes(d.rec));
  }

  setGravity(g: number): void {
    this.gravity = g;
    this.world.SetGravity(vec(0, -g));
  }

  /* ---------------- 小车（复合对象） ---------------- */

  addCart(pos: [number, number]): BodyRecord {
    const gid = `cart-${++this.cartSeq}`;
    const chassis = this.addBody({
      id: `${gid}-body`,
      label: '小车',
      shape: { kind: 'rect', size: [1.2, 0.35] },
      pos: [pos[0], pos[1]],
      density: 1.5,
      friction: 0.4,
      asPoint: true,
      group: gid,
      drive: 0,
      color: '#f59e0b',
    });
    const wr = 0.18;
    const ax = 0.42;
    const ay = -0.28;
    for (const [suffix, dx] of [
      ['w1', -ax],
      ['w2', ax],
    ] as const) {
      const wheel = this.addBody({
        id: `${gid}-${suffix}`,
        shape: { kind: 'circle', r: wr },
        pos: [pos[0] + dx, pos[1] + ay],
        density: 5,
        friction: 2,
        restitution: 0.05,
        asPoint: false, // 车轮必须可转动
        group: gid,
        color: '#475569',
      });
      this.addJoint('hinge', { rec: chassis, local: [dx, ay] }, { rec: wheel, local: [0, 0] }, {
        motor: { speed: 0, torque: 15 },
      });
    }
    return chassis;
  }

  /** 设置小车驱动速度（m/s，正=向右）；通过两轮马达实现 */
  setDrive(chassis: BodyRecord, v: number): void {
    chassis.meta.drive = v;
    const gid = chassis.meta.group;
    if (!gid) return;
    for (const j of this.joints) {
      if (j.kind !== 'hinge' || !j.joint || j.recA !== chassis) continue;
      const wheel = j.recB;
      if (wheel.meta.group !== gid) continue;
      const r = wheel.meta.shape.kind === 'circle' ? wheel.meta.shape.r : 0.18;
      // 世界 y 向上：向右滚动 = 顺时针 = 负角速度
      const w = -v / r;
      // CreateJoint 返回基类包装，需 castObject 取派生马达接口
      j.revJoint = j.revJoint ?? b2.castObject(j.joint, b2.b2RevoluteJoint);
      j.revJoint.SetMotorSpeed(w);
      j.motor = { speed: w, torque: j.motor?.torque ?? 15 };
    }
  }

  /* ---------------- 步进 ---------------- */

  step(dt: number): void {
    // 本步外力/弹簧力累计清零（力平衡反推用）
    for (const rec of this.records) {
      rec.appFx = 0;
      rec.appFy = 0;
      rec.sprFx = 0;
      rec.sprFy = 0;
    }
    this.applyDrivers(dt);
    this.applyFields();
    for (const j of this.joints) if (j.kind === 'spring') applySpringForce(j);
    for (const rec of this.records) this.applyBodyForces(rec, dt);
    this.world.Step(dt, 8, 3);
    this.t += dt;
    // 接触反推（N/f/Q/Wf）：力平衡法，需在 updateMetrics 覆盖 prevV 之前执行
    accumulateContacts(this, dt);
    this.updateMetrics(dt);
  }

  private applyDrivers(dt: number): void {
    for (const d of this.drivers) {
      if (d.def.type === 'elevator') {
        const profile = d.def.profile;
        let { phaseI, phaseT, vy } = d;
        if (phaseI < profile.length) {
          const ph = profile[phaseI];
          vy += ph.ay * dt;
          phaseT += dt;
          if (phaseT >= ph.dt) {
            phaseT = 0;
            phaseI++;
            if (phaseI >= profile.length && d.def.loop) {
              phaseI = 0;
              vy = 0;
            }
          }
        } else {
          vy = 0;
        }
        d.phaseI = phaseI;
        d.phaseT = phaseT;
        d.vy = phaseI < profile.length ? vy : 0;
        d.rec.body.SetLinearVelocity(vec(0, d.vy));
      } else {
        // oscY：竖直简谐驱动（受迫振动马达）；扫频时频率随时间线性变化（相位累积避免跳变）
        const { amp } = d.def;
        let freq = d.def.freq;
        if (d.def.sweep) {
          const s = d.def.sweep;
          const k = Math.min(this.t, s.duration) / s.duration;
          freq = s.from + (s.to - s.from) * k;
        }
        d.phase += 2 * Math.PI * freq * dt;
        const y = d.baseY + amp * Math.sin(d.phase);
        d.rec.body.SetTransform(vec(d.x0, y), 0);
        d.rec.body.SetLinearVelocity(vec(0, amp * 2 * Math.PI * freq * Math.cos(d.phase)));
      }
    }
  }

  private applyFields(): void {
    for (const f of this.fields) {
      if (f.type !== 'centralGravity') continue;
      const center = this.records.find(r => r.meta.id === f.center);
      if (!center) continue;
      const cp = center.body.GetPosition();
      for (const rec of this.records) {
        if (rec === center || rec.meta.isStatic || rec.meta.isKinematic) continue;
        const p = rec.body.GetPosition();
        const dx = cp.x - p.x;
        const dy = cp.y - p.y;
        const r2 = Math.max(dx * dx + dy * dy, 0.04);
        const r = Math.sqrt(r2);
        const F = (f.gm * rec.body.GetMass()) / r2;
        const fx = (dx / r) * F;
        const fy = (dy / r) * F;
        rec.body.ApplyForceToCenter(vec(fx, fy), true);
        rec.appFx += fx; // 计入已知外力，供力平衡反推
        rec.appFy += fy;
      }
    }
  }

  private applyBodyForces(rec: BodyRecord, dt: number): void {
    if (rec.meta.isStatic || rec.meta.isKinematic) return;
    const m = rec.meta;
    let fx = 0;
    let fy = 0;
    if (m.force) {
      fx += m.force[0];
      fy += m.force[1];
    }
    if (m.forces) for (const f of m.forces) {
      fx += f.v[0];
      fy += f.v[1];
    }
    if (m.forceRamp) {
      const r = m.forceRamp;
      fx += r.from + ((r.to - r.from) * Math.min(this.t, r.duration)) / r.duration;
    }
    if (fx || fy) {
      rec.body.ApplyForceToCenter(vec(fx, fy), true);
      rec.workExt += (fx * rec.vx + fy * rec.vy) * dt;
      rec.appFx = fx;
      rec.appFy = fy;
    }
  }

  private updateMetrics(dt: number): void {
    this.sampleTick ^= 1;
    for (const rec of this.records) {
      const v = rec.body.GetLinearVelocity();
      const iax = (v.x - rec.prevVx) / dt;
      const iay = (v.y - rec.prevVy) / dt;
      // 指数平滑：接触瞬间速度突变时避免加速度矢量抖动
      rec.ax += (iax - rec.ax) * 0.25;
      rec.ay += (iay - rec.ay) * 0.25;
      rec.prevVx = v.x;
      rec.prevVy = v.y;
      rec.vx = v.x;
      rec.vy = v.y;
      if (rec.meta.trace) {
        const p = rec.body.GetPosition();
        rec.tracePts.push({ x: p.x, y: p.y });
        if (rec.tracePts.length > TRACE_MAX) rec.tracePts.shift();
        if (this.t - rec.lastStrobeT >= STROBE_DT) {
          rec.strobePts.push({ x: p.x, y: p.y });
          rec.lastStrobeT = this.t;
        }
        if (this.sampleTick === 0) this.sample(rec);
      }
    }
  }

  private sample(rec: BodyRecord): void {
    if (rec.meta.isStatic) return;
    const p = rec.body.GetPosition();
    const m = rec.body.GetMass();
    const sp = Math.hypot(rec.vx, rec.vy);
    const s: Sample = {
      t: this.t,
      x: p.x,
      y: p.y,
      vx: rec.vx,
      vy: rec.vy,
      sp,
      ax: rec.ax,
      ay: rec.ay,
      ek: 0.5 * m * sp * sp,
      ep:
        this.view === 'vertical'
          ? m * this.gravity * Math.max(p.y, 0) * rec.meta.gravityScale
          : 0,
      en: Math.hypot(rec.cnx, rec.cny),
    };
    rec.samples.push(s);
    if (rec.samples.length > 1800) rec.samples.shift();
  }

  /** 把当前世界序列化为场景定义。速度取"初始速度"（meta.v0），保证 ↺ 重置语义 */
  serialize(): SceneDef {
    return {
      meta: { name: this.sceneName, view: this.view },
      world: {
        gravity: this.gravity,
        drivers: this.drivers.map(d => d.def),
        fields: this.fields,
      },
      bodies: this.records.map(
        rec =>
          ({
            id: rec.meta.id,
            shape: rec.meta.shape,
            pos: [rec.body.GetPosition().x, rec.body.GetPosition().y] as [number, number],
            angle: rec.body.GetAngle(),
            isStatic: rec.meta.isStatic,
            kinematic: rec.meta.isKinematic,
            asPoint: rec.meta.asPoint,
            density: rec.meta.density,
            friction: rec.meta.friction,
            restitution: rec.meta.restitution,
            gravityScale: rec.meta.gravityScale,
            trace: rec.meta.trace,
            color: rec.meta.color,
            label: rec.meta.label,
            v0: rec.meta.v0,
            force: rec.meta.force,
            forces: rec.meta.forces,
            forceRamp: rec.meta.forceRamp,
            group: rec.meta.group,
            drive: rec.meta.drive,
          }) satisfies SceneBodyDef,
      ),
      joints: this.joints.map(jointToDef),
    };
  }
}

export const sim = new Sim();
