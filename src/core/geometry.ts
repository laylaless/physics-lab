import { b2 } from './engine';

/**
 * 斜面 / 圆弧轨道的共享几何：物理 fixture、渲染、拾取都从这里取局部几何，
 * 保证三者永远一致。局部坐标一律 y 向上，与世界坐标同向（画布绘制时另行翻转）。
 */

/* ---------------- 斜面（直角三角形） ---------------- */

/** 斜面体局部顶点（CCW，原点 = 包围盒中心）：竖直边在左，斜边自左上向右下，
 *  与 incline 预设的"高左低右"滑动方向一致 */
export function wedgeVerts(w: number, h: number): [number, number][] {
  return [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [-w / 2, h / 2],
  ];
}

export function wedgeArea(w: number, h: number): number {
  return (w * h) / 2;
}

/** 凸多边形 containment（局部坐标，ε 为米级容差方便点选） */
function pointInConvexPoly(lx: number, ly: number, verts: [number, number][]): boolean {
  const eps = 0.02;
  for (let i = 0; i < verts.length; i++) {
    const [x0, y0] = verts[i];
    const [x1, y1] = verts[(i + 1) % verts.length];
    const cross = (x1 - x0) * (ly - y0) - (y1 - y0) * (lx - x0);
    if (cross < -eps * Math.hypot(x1 - x0, y1 - y0)) return false;
  }
  return true;
}

export function pointInWedge(lx: number, ly: number, w: number, h: number): boolean {
  return pointInConvexPoly(lx, ly, wedgeVerts(w, h));
}

/* ---------------- 圆弧轨道（有厚度的弧带，凹面朝上） ---------------- */

/**
 * 弧带的圆心角域：世界角 θ ∈ [π, π + spanRad]，凹面朝上。
 * span 为圆心角（度，5~360）：90=竖直壁在左、底部水平出口（滑道）；180=圆心正下方 U 形槽；
 * 270/360=环形轨道（球在环内滚动）。θ ∈ [π, π+span] 经 atan2 映射到 [-π, -π+span] ⊆ [-π, π]，无回绕。
 */
export function arcStartAngle(): number {
  return Math.PI;
}

/** 圆心角钳制到有效范围（0° 弧退化无意义，下限 5°） */
export function clampArcSpan(span: number): number {
  return Math.min(360, Math.max(5, Math.round(span)));
}

export function arcSpanRad(span: number): number {
  return (clampArcSpan(span) * Math.PI) / 180;
}

export function arcArea(r: number, t: number, span: number): number {
  const r0 = r - t;
  return (arcSpanRad(span) / 2) * (r * r - r0 * r0);
}/** 弧带 → 微段盒子参数（局部坐标）。物理上用偏移旋转盒子拼出弧带；每段约 7.5° */
export interface ArcSeg {
  cx: number;
  cy: number;
  /** 盒子 x 轴与局部 x 轴的夹角（弧度），沿弧切向 */
  angle: number;
  halfLen: number;
  halfTh: number;
}

export function arcSegments(r: number, t: number, span: number): ArcSeg[] {
  const spanRad = arcSpanRad(span);
  const n = Math.min(48, Math.max(8, Math.ceil(span / 7.5)));
  const dth = arcSpanRad(span) / n;
  const midR = r - t / 2;
  const out: ArcSeg[] = [];
  for (let i = 0; i < n; i++) {
    const th = arcStartAngle() + (i + 0.5) * dth;
    out.push({
      cx: midR * Math.cos(th),
      cy: midR * Math.sin(th),
      angle: th + Math.PI / 2,
      // 段长略放大与相邻段重叠，封住接缝避免高速小球卡缝
      halfLen: midR * Math.sin(dth / 2) * 1.06,
      halfTh: t / 2,
    });
  }
  return out;
}

/** 局部坐标点是否在弧带内（半径带 + 角度域；atan2 值域 (-π,π]，与 [π, π+span] 的
 *  表示 [-π, -π+span] 同域，无回绕问题） */
export function pointInArc(lx: number, ly: number, r: number, t: number, span: number): boolean {
  const eps = 0.02;
  const d = Math.hypot(lx, ly);
  if (d < r - t - eps || d > r + eps) return false;
  return inVoidAngle(ly, lx, d, span, eps);
}

/** 点是否落在弧形内域（凹槽/孔）的角度范围内 */
function inVoidAngle(ly: number, lx: number, d: number, span: number, eps: number): boolean {
  const th = Math.atan2(ly, lx);
  const a0 = -Math.PI;
  const a1 = -Math.PI + arcSpanRad(span);
  // 角度容差 = ε 米 / 当前半径，端盖附近更宽松
  const da = eps / Math.max(d, 0.05);
  return th >= a0 - da && th <= a1 + da;
}

/** 弧带中心线采样点（渲染用，局部坐标 y 向上），degStep 为采样步长（度） */
export function arcSamplePoints(radius: number, span: number, degStep = 6): [number, number][] {
  const spanRad = arcSpanRad(span);
  const n = Math.max(8, Math.ceil((spanRad / (Math.PI / 180)) / degStep));
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const th = arcStartAngle() + (spanRad * i) / n;
    out.push([radius * Math.cos(th), radius * Math.sin(th)]);
  }
  return out;
}

/* ---------------- 圆弧轨道·有底座模式（外方内弧） ---------------- */

/** 有底座模式的外接矩形（局部坐标，y 向上）：外弧扇形的包围盒。
 *  left/bottom 恒为 −r；right/top 随圆心角逐边扩展到 r（跨过 180°/270° 后弧经过右/上极值点） */
export interface ArcRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function arcBaseRect(r: number, span: number): ArcRect {
  const s = arcSpanRad(span);
  const right = span >= 180 ? r : r * Math.max(0, -Math.cos(s));
  const top = span >= 270 ? r : span >= 180 ? r * -Math.sin(s) : 0;
  return { left: -r, right, top, bottom: -r };
}

/** 从圆心沿方向 th 的射线到外接矩形边缘的距离 */
function rayExit(th: number, rc: ArcRect): number {
  const c = Math.cos(th);
  const s = Math.sin(th);
  const tx = c > 1e-9 ? rc.right / c : c < -1e-9 ? rc.left / c : Infinity;
  const ty = s > 1e-9 ? rc.top / s : s < -1e-9 ? rc.bottom / s : Infinity;
  return Math.min(tx, ty);
}

/** 有底座模式的面积 = 外接矩形 − 内域扇形 */
export function arcBaseArea(r: number, t: number, span: number): number {
  const rc = arcBaseRect(r, span);
  const r0 = r - t;
  return (rc.right - rc.left) * (rc.top - rc.bottom) - (arcSpanRad(span) / 2) * r0 * r0;
}

/** 有底座模式的凸多边形分解：以圆心为极点做径向切片——
 *  弧带角度域内从内半径 r−t 切到矩形边缘（弧带 + 角部填充），域外从圆心切到边缘（补齐矩形）。
 *  在域边界与矩形角点方向插入精确分割角，保证每片外边落在同一条矩形边上（严格凸） */
export interface ArcPiece {
  verts: [number, number][];
}

export function arcBasePieces(r: number, t: number, span: number): ArcPiece[] {
  const rc = arcBaseRect(r, span);
  const spanRad = arcSpanRad(span);
  const inner = r - t;
  // 角度网格：7.5° 等分 + 域边界 π/π+span + 矩形四角方向
  const dirs = new Set<number>();
  for (let k = 0; k < 48; k++) dirs.add((2 * Math.PI * k) / 48);
  dirs.add(Math.PI);
  let a1 = Math.PI + spanRad;
  dirs.add(a1 % (2 * Math.PI));
  for (const [cx, cy] of [
    [rc.left, rc.bottom],
    [rc.right, rc.bottom],
    [rc.right, rc.top],
    [rc.left, rc.top],
  ] as const) {
    if (cx === 0 && cy === 0) continue; // 与圆心重合的退化角
    let d = Math.atan2(cy, cx);
    if (d < 0) d += 2 * Math.PI;
    dirs.add(d);
  }
  const list = [...dirs].sort((x, y) => x - y);
  // 方向 φ 是否在弧带角度域内（把 φ 平移到 [π, π+2π) 后与 (π, π+span) 比较）
  const inSpan = (phi: number): boolean => {
    const p = phi < Math.PI ? phi + 2 * Math.PI : phi;
    return p > Math.PI && p < Math.PI + spanRad;
  };
  const out: ArcPiece[] = [];
  for (let i = 0; i < list.length; i++) {
    const p0 = list[i];
    const p1 = i + 1 < list.length ? list[i + 1] : list[0] + 2 * Math.PI;
    if (p1 - p0 < 1e-6) continue;
    const innerR = inSpan((p0 + p1) / 2 % (2 * Math.PI)) ? inner : 0;
    const l0 = rayExit(p0, rc);
    const l1 = rayExit(p1, rc);
    // 辐射长度近零 = 矩形外的方向（span<180 时上半平面、浮点尾差的 top≈0 等）；
    // 退化切片会生成两顶点多边形，Box2D 质量计算会失真，必须跳过
    if (l0 < 1e-4 || l1 < 1e-4) continue;
    const u = (th: number, rad: number): [number, number] => [rad * Math.cos(th), rad * Math.sin(th)];
    const verts: [number, number][] = innerR > 0
      ? [u(p0, innerR), u(p0, l0), u(p1, l1), u(p1, innerR)] // 内弧边 + 矩形边的四边形
      : [[0, 0], u(p0, l0), u(p1, l1)]; // 从圆心出发的三角补片
    out.push({ verts });
  }
  return out;
}

/** 有底座模式的外轮廓（局部坐标 y 向上）。span ≤ 180 内域贯通上缘为单回路；
 *  span > 180 内弧整体缩进矩形内成孔，返回矩形外圈 + 孔两段（渲染用 evenodd 填充） */
export function arcBaseOutline(
  r: number,
  t: number,
  span: number,
): { outer: [number, number][]; hole: [number, number][] | null } {
  const rc = arcBaseRect(r, span);
  const spanRad = arcSpanRad(span);
  if (spanRad > Math.PI) {
    const hole = arcSamplePoints(r - t, span);
    hole.push([0, 0]); // 内弧 + 两条半径围成孔
    return {
      outer: [
        [rc.left, rc.bottom],
        [rc.right, rc.bottom],
        [rc.right, rc.top],
        [rc.left, rc.top],
      ],
      hole,
    };
  }
  // 单回路：内弧 A→B → 出射线到边缘 → 沿矩形边缘（角点按方向降序）→ 入射点 → 闭合
  const pts: [number, number][] = arcSamplePoints(r - t, span);
  const a1 = Math.PI + spanRad;
  const exit = rayExit(a1, rc);
  pts.push([exit * Math.cos(a1), exit * Math.sin(a1)]);
  const corners: [number, number][] = [
    [rc.left, rc.bottom],
    [rc.right, rc.bottom],
    [rc.right, rc.top],
    [rc.left, rc.top],
  ];
  const onPath = corners
    .map(c => {
      let d = Math.atan2(c[1], c[0]);
      if (d < 0) d += 2 * Math.PI;
      return { c, d };
    })
    .filter(o => o.d > Math.PI + 1e-9 && o.d < a1 - 1e-9)
    .sort((x, y) => y.d - x.d)
    .map(o => o.c);
  pts.push(...onPath);
  pts.push([rc.left, 0]); // θstart=π 方向的边缘点
  return { outer: pts, hole: null };
}

/** 局部坐标点是否在有底座弧内（矩形内 且 不在弧形内域/孔中） */
export function pointInArcBase(lx: number, ly: number, r: number, t: number, span: number): boolean {
  const rc = arcBaseRect(r, span);
  const eps = 0.02;
  if (lx < rc.left - eps || lx > rc.right + eps || ly < rc.bottom - eps || ly > rc.top + eps) return false;
  const d = Math.hypot(lx, ly);
  if (d >= r - t - eps) return true; // 弧带及其以外的角部填充
  return !inVoidAngle(ly, lx, d, span, eps);
}

/* ---------------- Box2D 多边形顶点写入 ---------------- */

/** b2PolygonShape.Set 只接受 WASM 连续内存指针（b2Vec2 数组），
 *  这里用 _malloc + HEAPF32 逐顶点写入后传入，Set 内部会拷贝故立即释放安全。
 *  已探针验证：顶点原样存储（不重定位质心），仅可能重排起始点。 */
export function setPolygonVerts(shape: any, verts: [number, number][]): void {
  const n = verts.length;
  const ptr = b2._malloc(n * 8);
  for (let i = 0; i < n; i++) {
    b2.HEAPF32[(ptr >> 2) + 2 * i] = verts[i][0];
    b2.HEAPF32[(ptr >> 2) + 2 * i + 1] = verts[i][1];
  }
  shape.Set(ptr, n);
  b2._free(ptr);
}
