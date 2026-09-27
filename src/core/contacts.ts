import { b2 } from './engine';
import type { Sim } from './sim';
import type { BodyRecord } from './bodies';

/**
 * 接触力反推（力平衡法，比逐点冲量求和稳健）：
 *
 *   F_接触 = m·(v_后 − v_前)/dt − F_重力 − F_外力 − F_弹簧 − F_关节 − F_鼠标关节
 *
 * 盒底多点接触、固定旋转（"视为质点"）导致求解器把冲量任意分布时，
 * 逐点读取会失真；而物体级动量守恒永远精确。
 * N/f 的方向：从接触世界流形累计法向 d̂（指向该物体），把 F_接触 分解为
 * 法向 N = (F·d̂)d̂ 与切向 f = F − N。
 * 摩擦生热 Q += |f|·|v_切向相对|·dt；摩擦功 Wf += −(f·v)·dt。
 */
export function accumulateContacts(sim: Sim, dt: number): void {
  const recs = sim.records;
  // 1) 收集接触法向方向与触摸标志（走流形，只取方向——方向不受冲量分布影响）
  const dirs = new Map<BodyRecord, { x: number; y: number }>();
  const touching = new Set<BodyRecord>();
  const wm = new b2.b2WorldManifold();
  let c = sim.world.GetContactList();
  let guard = 0;
  while (c && guard++ < 256) {
    if (c.IsTouching()) {
      const rA: BodyRecord | undefined = sim.bodyByPtr.get(c.GetFixtureA().GetBody());
      const rB: BodyRecord | undefined = sim.bodyByPtr.get(c.GetFixtureB().GetBody());
      if (rA && !rA.meta.isStatic) touching.add(rA);
      if (rB && !rB.meta.isStatic) touching.add(rB);
      if (rA || rB) {
        c.GetWorldManifold(wm);
        const n = wm.normal; // A→B
        if (rA) {
          const d = dirs.get(rA) ?? { x: 0, y: 0 };
          d.x -= n.x;
          d.y -= n.y;
          dirs.set(rA, d);
        }
        if (rB) {
          const d = dirs.get(rB) ?? { x: 0, y: 0 };
          d.x += n.x;
          d.y += n.y;
          dirs.set(rB, d);
        }
      }
    }
    c = c.GetNext();
  }

  // 2) 关节反力（弹簧除外——弹簧力已在施力时记录在物体上）
  const invDt = 1 / dt;
  const jointF = new Map<BodyRecord, { x: number; y: number }>();
  for (const j of sim.joints) {
    if (j.kind === 'spring' || !j.joint?.GetReactionForce) continue;
    const f = j.joint.GetReactionForce(invDt); // 作用在 bodyB 上
    const add = (rec: BodyRecord | null, sx: number, sy: number): void => {
      if (!rec || rec.meta.isStatic) return;
      const d = jointF.get(rec) ?? { x: 0, y: 0 };
      d.x += sx;
      d.y += sy;
      jointF.set(rec, d);
    };
    add(j.recB, f.x, f.y);
    add(j.recA, -f.x, -f.y);
  }
  if (sim.mouseJoint?.GetReactionForce) {
    const f = sim.mouseJoint.GetReactionForce(invDt);
    const rec = sim.mouseJointRec;
    if (rec && !rec.meta.isStatic) {
      const d = jointF.get(rec) ?? { x: 0, y: 0 };
      d.x += f.x;
      d.y += f.y;
      jointF.set(rec, d);
    }
  }

    // 3) 力平衡求接触力并分解
    const g = sim.view === 'vertical' ? -sim.gravity : 0;
    for (const rec of recs) {
      if (rec.meta.isStatic || rec.meta.isKinematic) continue;
      const m = rec.body.GetMass();
      const v = rec.body.GetLinearVelocity();
      // prevVx/prevVy 为本步开始前速度（updateMetrics 在本函数之后才会覆盖）
      let fx = (m * (v.x - rec.prevVx)) / dt;
      let fy = (m * (v.y - rec.prevVy)) / dt;
      fy -= m * g * rec.meta.gravityScale; // 重力（竖直方向）
      fx -= rec.appFx; // 外力（force/forces/forceRamp）
      fy -= rec.appFy;
      fx -= rec.sprFx; // 弹簧胡克力
      fy -= rec.sprFy;
    const jf = jointF.get(rec);
    if (jf) {
      fx -= jf.x;
      fy -= jf.y;
    }
    if (!touching.has(rec)) {
      // 无接触：残差归零（数值噪声）
      fx = 0;
      fy = 0;
    }
    rec.cnx = fx;
    rec.cny = fy;
    // 沿接触法向分解
    const d = dirs.get(rec) ?? { x: 0, y: 0 };
    const dl = Math.hypot(d.x, d.y);
    if (dl > 1e-6) {
      const ux = d.x / dl;
      const uy = d.y / dl;
      const nMag = fx * ux + fy * uy;
      rec.cnx = nMag * ux;
      rec.cny = nMag * uy;
      rec.cfx = fx - rec.cnx;
      rec.cfy = fy - rec.cny;
    } else {
      rec.cfx = 0;
      rec.cfy = 0;
    }
    // 显示平滑
    rec.dnx += (rec.cnx - rec.dnx) * 0.4;
    rec.dny += (rec.cny - rec.dny) * 0.4;
    rec.dfx += (rec.cfx - rec.dfx) * 0.4;
    rec.dfy += (rec.cfy - rec.dfy) * 0.4;
    // 摩擦生热：|f| × 切向相对滑动速率（近似取对法向的切向分量）
    const fMag = Math.hypot(rec.cfx, rec.cfy);
    if (fMag > 0.01 && dl > 1e-6) {
      const ux = d.x / dl;
      const uy = d.y / dl;
      const vt = -rec.vx * uy + rec.vy * ux; // 速度切向分量（对静止地面即滑速）
      rec.heat += fMag * Math.abs(vt) * dt;
      rec.workFric += -(rec.cfx * rec.vx + rec.cfy * rec.vy) * dt;
    }
  }
}
