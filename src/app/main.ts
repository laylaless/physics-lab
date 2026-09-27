import { initEngine, b2, vec } from '../core/engine';
import { sim, FIXED_DT } from '../core/sim';
import { worldPoint, type BodyRecord } from '../core/bodies';
import { wedgeVerts, pointInWedge, pointInArc, pointInArcBase } from '../core/geometry';
import { sandboxScene } from '../scenes/sandbox';
import { PRESETS } from '../scenes/presets';
import type { SceneDef, ViewMode } from '../scenes/schema';
import { listSaved, getSaved, findSavedByName, putSaved, deleteSaved, genId, type SavedExperiment } from '../scenes/storage';
import { uiPrompt, uiConfirm, uiSpringDialog, uiImportScene } from '../ui/dialog';
import { camera } from '../render/camera';
import { drawGrid, hitTopRightButton } from '../render/grid';
import { history } from './history';
import { drawBody, drawJoints, drawPendingLink, arcBandPath } from '../render/shapes';
import { drawVectors } from '../render/vectors';
import { drawTraces } from '../render/traces';
import { drawMeasure } from '../render/instruments';
import { initCharts, tickCharts, setTheoryPreset } from '../measurement/charts';
import { exportCsv, downloadText } from '../measurement/export';
import { settings, uiState, TOOL_HINTS, LINK_KIND } from './state';
import { startLoop } from './loop';
import { initToolbar } from '../ui/toolbar';
import { initControls, type ControlsApi } from '../ui/controls';
import { initPanel, refreshInspector, refreshLive } from '../ui/properties';
import './style-import';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function $<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

const canvas = $<HTMLCanvasElement>('cv');
const ctx = canvas.getContext('2d')!;
let controls: ControlsApi;

/* ---------------- 场景装载 / 快照 ---------------- */

/** 当前实验来源：内置预设 or "我的实验"；null = 空白场景/未归属 */
type ExpRef = { kind: 'preset' | 'user'; id: string };
let currentExp: ExpRef | null = null;
/** 载入时的描述/引导问题（serialize() 会丢失，保存与重置横幅时补回） */
let metaExtra: { desc?: string; guides?: string[] } | null = null;

function extractMetaExtra(meta: SceneDef['meta']): { desc?: string; guides?: string[] } | null {
  if (!meta.desc && !meta.guides?.length) return null;
  const x: { desc?: string; guides?: string[] } = {};
  if (meta.desc) x.desc = meta.desc;
  if (meta.guides?.length) x.guides = meta.guides;
  return x;
}

/** 当前场景完整定义：serialize() + 保留的描述/引导语 + 当前视口（保存后可还原视角） */
function currentDef(): SceneDef {
  const def = sim.serialize();
  return {
    ...def,
    meta: { ...def.meta, ...(metaExtra ?? {}) },
    world: { ...def.world, viewport: { cx: camera.cx, cy: camera.cy, widthM: camera.w / camera.ppm } },
  };
}

function syncExperimentSel(): void {
  controls.setExperiment(currentExp ? (currentExp.kind === 'user' ? `user:${currentExp.id}` : currentExp.id) : '');
  controls.setUserExpActive(currentExp?.kind === 'user');
}

/** source：显式传入（含 null）时更新实验归属与 metaExtra；省略则保持不变（↺ 重置复用） */
function loadScene(def: SceneDef, resetCam: boolean, source?: ExpRef | null): void {
  if (source !== undefined) {
    currentExp = source;
    metaExtra = extractMetaExtra(def.meta);
  }
  sim.load(def);
  settings.playing = false;
  controls.setPlaying(false);
  controls.syncMode(sim.view);
  controls.setGravityBox(sim.view === 'vertical', sim.gravity);
  if (resetCam && def.world.viewport) {
    camera.setViewport(def.world.viewport.cx, def.world.viewport.cy, def.world.viewport.widthM);
  }
  uiState.selected = null;
  uiState.pendingLink = null;
  uiState.measure = null;
  refreshInspector();
  sim.snapshotDef = sim.serialize();
  // 载入新场景（含清空/导入/切模式）时历史以该状态为起点；
  // source 省略 = ↺ 重置（复用快照），保留历史可继续撤销
  if (source !== undefined) history.reset(sim.snapshotDef);
  updateBanner(currentDef());
  syncExperimentSel();
  // 理论曲线注册表按预设 id 匹配；沙盒/我的实验/导入场景不叠加
  setTheoryPreset(source === undefined ? null : currentExp?.kind === 'preset' ? currentExp.id : null);
}

function commit(): void {
  sim.snapshotDef = sim.serialize();
  history.push(sim.snapshotDef);
}

/** 撤销/重做：重建到历史状态。不动实验归属、横幅、理论曲线与视角（只回溯编辑内容） */
function applyHistory(def: SceneDef): void {
  sim.load(def);
  uiState.selected = null;
  uiState.pendingLink = null;
  refreshInspector();
  controls.setGravityBox(sim.view === 'vertical', sim.gravity);
  sim.snapshotDef = sim.serialize();
}

function doUndoRedo(action: 'undo' | 'redo'): void {
  const def = action === 'undo' ? history.undo() : history.redo();
  if (def) applyHistory(def);
}

/* ---------------- 我的实验：保存 / 重命名 / 删除 ---------------- */

let toastTimer = 0;
function toast(msg: string): void {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), 2200);
}

async function onSaveExp(): Promise<void> {
  // 已是"我的实验"：直接覆盖更新
  if (currentExp?.kind === 'user') {
    const s = getSaved(currentExp.id);
    if (s) {
      s.def = currentDef();
      s.savedAt = Date.now();
      toast(putSaved(s) ? `已保存「${s.name}」` : '保存失败：浏览器存储不可用');
      return;
    }
    currentExp = null; // 存储中的条目已被外部清除，转为另存新实验
  }
  const base = currentDef();
  const input = await uiPrompt('保存实验', base.meta.name || '我的实验');
  const name = input?.trim();
  if (!name) return;
  let id = genId();
  const dup = findSavedByName(name);
  if (dup) {
    if (!(await uiConfirm(`已存在同名实验「${name}」，是否覆盖它？`))) return;
    id = dup.id;
  }
  const exp: SavedExperiment = { id, name, savedAt: Date.now(), def: { ...base, meta: { ...base.meta, name } } };
  if (!putSaved(exp)) {
    toast('保存失败：浏览器存储不可用');
    return;
  }
  currentExp = { kind: 'user', id };
  sim.sceneName = name;
  updateBanner(currentDef());
  controls.refreshMyExperiments(listSaved());
  syncExperimentSel();
  toast(`已保存「${name}」`);
}

async function onRenameExp(): Promise<void> {
  if (currentExp?.kind !== 'user') return;
  const s = getSaved(currentExp.id);
  if (!s) return;
  const input = await uiPrompt('重命名实验', s.name);
  const name = input?.trim();
  if (!name || name === s.name) return;
  if (findSavedByName(name)) {
    toast(`已存在同名实验「${name}」`);
    return;
  }
  s.name = name;
  s.def = { ...s.def, meta: { ...s.def.meta, name } };
  if (!putSaved(s)) {
    toast('保存失败：浏览器存储不可用');
    return;
  }
  sim.sceneName = name;
  updateBanner(currentDef());
  controls.refreshMyExperiments(listSaved());
  syncExperimentSel();
  toast(`已重命名为「${name}」`);
}

async function onDeleteExp(): Promise<void> {
  if (currentExp?.kind !== 'user') return;
  const s = getSaved(currentExp.id);
  if (!s) return;
  if (!(await uiConfirm(`确定删除实验「${s.name}」？此操作不可恢复。`))) return;
  deleteSaved(s.id);
  currentExp = null; // 画布上的场景保留，只是不再归属任何实验
  controls.refreshMyExperiments(listSaved());
  syncExperimentSel();
  toast(`已删除「${s.name}」`);
}

/* ---------------- 场景 JSON 导入 / 导出 ---------------- */

function onExportScene(): void {
  const def = currentDef();
  const name = (def.meta.name || '场景').replace(/[\\/:*?"<>|]/g, '_');
  downloadText(`${name}.scene.json`, JSON.stringify(def, null, 2), 'application/json;charset=utf-8');
  toast('已导出场景 JSON 文件');
}

async function onImportScene(): Promise<void> {
  const text = await uiImportScene();
  if (!text) return;
  let def: SceneDef;
  try {
    def = JSON.parse(text) as SceneDef;
  } catch {
    toast('导入失败：JSON 解析错误');
    return;
  }
  const okView = def?.meta?.view === 'plane' || def?.meta?.view === 'vertical';
  if (!okView || !Array.isArray(def.bodies)) {
    toast('导入失败：不是有效的场景文件（缺 meta.view 或 bodies）');
    return;
  }
  def.joints ??= [];
  def.world ??= { gravity: 9.8 };
  loadScene(def, true, null);
  toast(`已导入「${def.meta.name ?? '场景'}」（可另存到"我的实验"）`);
}

/* ---------------- 实验横幅：探究任务卡（勾选进度，localStorage 持久化） ---------------- */

function guideKey(def: SceneDef): string {
  return `physics-lab.guides.v1:${def.meta.name}|${def.meta.view}`;
}

function loadGuideChecks(key: string, n: number): boolean[] {
  try {
    const arr: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    if (Array.isArray(arr)) {
      const out = new Array<boolean>(n).fill(false);
      for (let i = 0; i < n; i++) out[i] = arr[i] === true;
      return out;
    }
  } catch {
    /* 数据损坏按全未完成处理 */
  }
  return new Array<boolean>(n).fill(false);
}

function updateBanner(def: SceneDef): void {
  const info = $('scene-info');
  const { name, desc, guides } = def.meta;
  if (!desc && !guides?.length) {
    info.hidden = true;
    return;
  }
  info.innerHTML = '';
  const h = document.createElement('h3');
  h.textContent = name;
  info.appendChild(h);
  if (desc) {
    const p = document.createElement('p');
    p.textContent = desc;
    info.appendChild(p);
  }
  if (guides?.length) {
    const key = guideKey(def);
    const checks = loadGuideChecks(key, guides.length);
    const prog = document.createElement('div');
    prog.className = 'guide-progress';
    const list = document.createElement('div');
    list.className = 'guide-list';
    const refresh = (): void => {
      const done = checks.filter(Boolean).length;
      prog.textContent = `探究任务 ${done}/${guides.length}${done === guides.length ? ' ✓ 全部完成' : ''}`;
      prog.classList.toggle('all-done', done === guides.length);
    };
    guides.forEach((g, i) => {
      const item = document.createElement('label');
      item.className = 'guide-item' + (checks[i] ? ' done' : '');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = checks[i];
      const span = document.createElement('span');
      span.textContent = g;
      item.append(cb, span);
      item.addEventListener('change', () => {
        checks[i] = cb.checked;
        item.classList.toggle('done', cb.checked);
        try {
          localStorage.setItem(key, JSON.stringify(checks));
        } catch {
          /* 存储不可用时仅本会话生效 */
        }
        refresh();
      });
      list.appendChild(item);
    });
    refresh();
    info.append(prog, list);
  }
  const close = document.createElement('button');
  close.className = 'close';
  close.textContent = '✕';
  close.addEventListener('click', () => (info.hidden = true));
  info.appendChild(close);
  info.hidden = false;
}

/* ---------------- 画布尺寸 ---------------- */

function setupCanvas(): void {
  const stage = $('stage');
  const resize = (): void => {
    const dpr = window.devicePixelRatio || 1;
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (w === 0 || h === 0) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    camera.resize(w, h);
  };
  new ResizeObserver(resize).observe(stage);
  resize();
}

/* ---------------- 指针交互 ---------------- */

/** 可拖拽绘制的工具（质点/矩形/圆形/斜面体/圆弧 + 对应固定平台版）；
 *  圆弧的圆心角在工具箱选项面板设置（uiState.arcSpan），半圆/圆环不再单列工具 */
type DrawKind =
  | 'point'
  | 'rect'
  | 'circle'
  | 'platform'
  | 'wedge'
  | 'arc'
  | 'platformWedge'
  | 'platformArc';

type Drag =
  | { mode: 'pan'; sx: number; sy: number; moved: boolean }
  | { mode: 'move'; members: { rec: BodyRecord; dx: number; dy: number }[]; moved: boolean }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { mode: 'joint'; rec: BodyRecord; joint: any }
  | { mode: 'draw'; kind: DrawKind; x0: number; y0: number; x1: number; y1: number };

let drag: Drag | null = null;

/** 成组物体（小车）取整组成员；无组则仅自身 */
function groupMembers(rec: BodyRecord): BodyRecord[] {
  const g = rec.meta.group;
  return g ? sim.records.filter(r => r.meta.group === g) : [rec];
}

function isDyn(rec: BodyRecord | null): rec is BodyRecord {
  return !!rec && !rec.meta.isStatic && !rec.meta.isKinematic;
}

function hitBody(wx: number, wy: number): BodyRecord | null {
  for (let i = sim.records.length - 1; i >= 0; i--) {
    const rec = sim.records[i];
    const m = rec.meta;
    const p = rec.body.GetPosition();
    if (m.shape.kind === 'circle' || m.shape.kind === 'point') {
      // 质点本体会太小，放宽拾取半径方便点击
      const r = m.shape.kind === 'point' ? Math.max(m.shape.r, 0.12) : m.shape.r;
      const dx = wx - p.x;
      const dy = wy - p.y;
      if (dx * dx + dy * dy <= r * r) return rec;
    } else {
      const a = rec.body.GetAngle();
      const c = Math.cos(-a);
      const s = Math.sin(-a);
      const dx = wx - p.x;
      const dy = wy - p.y;
      const lx = dx * c - dy * s;
      const ly = dx * s + dy * c;
      if (m.shape.kind === 'rect') {
        if (Math.abs(lx) <= m.shape.size[0] / 2 && Math.abs(ly) <= m.shape.size[1] / 2) return rec;
      } else if (m.shape.kind === 'wedge') {
        if (pointInWedge(lx, ly, m.shape.w, m.shape.h)) return rec;
      } else if (m.shape.base) {
        if (pointInArcBase(lx, ly, m.shape.r, m.shape.t, m.shape.span)) return rec;
      } else {
        if (pointInArc(lx, ly, m.shape.r, m.shape.t, m.shape.span)) return rec;
      }
    }
  }
  return null;
}

/** 连接件：两次点击（物体或空白=固定锚）；弹簧在第二击后询问原长与弹性系数 */
async function handleLinkClick(kind: 'rope' | 'rod' | 'spring' | 'hinge', wx: number, wy: number): Promise<void> {
  const hit = hitBody(wx, wy);
  if (!uiState.pendingLink) {
    uiState.pendingLink = { kind, rec: hit, local: hit ? [0, 0] : [wx, wy] };
    return;
  }
  const a = uiState.pendingLink;
  uiState.pendingLink = null;
  if (!isDyn(a.rec) && !isDyn(hit)) {
    toast('连接件至少一端要连在动态物体上');
    return;
  }
  if (hit && a.rec === hit) {
    toast('不能连接物体自身');
    return;
  }
  let springOpts: { k: number; length: number } | undefined;
  if (kind === 'spring') {
    // 与 addJoint 相同的锚点规则：命中物体则锚在重心，否则为世界坐标点
    const aW = worldPoint(a.rec, a.local);
    const bW = hit ? worldPoint(hit, [0, 0]) : [wx, wy];
    const dist = Math.hypot(bW[0] - aW[0], bW[1] - aW[1]);
    const res = await uiSpringDialog(dist);
    if (!res) return; // 取消：不创建弹簧
    springOpts = { k: res.k ?? 20, length: Math.max(res.length, 0.05) };
  }
  if (isDyn(hit)) {
    sim.addJoint(kind, { rec: a.rec, local: a.local }, { rec: hit, local: [0, 0] }, springOpts);
  } else {
    // 第二端是锚：交换，保证动态物体在 B 端（空白=世界坐标锚，命中物体=锚在其重心）
    sim.addJoint(kind, { rec: hit, local: hit ? [0, 0] : [wx, wy] }, { rec: a.rec!, local: a.local }, springOpts);
  }
  commit();
}

/** 测量工具：标尺两点 / 量角器三点 */
function handleMeasureClick(kind: 'ruler' | 'protractor', wx: number, wy: number): void {
  const need = kind === 'ruler' ? 2 : 3;
  if (!uiState.measure || uiState.measure.kind !== kind || uiState.measure.pts.length >= need) {
    uiState.measure = { kind, pts: [[wx, wy]] };
    return;
  }
  uiState.measure.pts.push([wx, wy]);
}

canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  // 右上角撤销/重做按钮优先于一切画布工具；置灰按钮也吞掉点击（不穿透）
  const cornerBtn = hitTopRightButton(camera.w, e.offsetX, e.offsetY);
  if (cornerBtn) {
    if (cornerBtn.enabled) doUndoRedo(cornerBtn.id);
    return;
  }
  canvas.setPointerCapture(e.pointerId);
  const wx = camera.s2wx(e.offsetX);
  const wy = camera.s2wy(e.offsetY);
  const tool = uiState.tool;

  if (tool in LINK_KIND) {
    handleLinkClick(LINK_KIND[tool] as 'rope' | 'rod' | 'spring' | 'hinge', wx, wy);
    return;
  }
  if (tool === 'force') {
    const hit = hitBody(wx, wy);
    if (isDyn(hit)) {
      if (hit!.meta.force || hit!.meta.forces) {
        hit!.meta.force = undefined;
        hit!.meta.forces = undefined;
      } else {
        hit!.meta.force = [2, 0];
      }
      if (uiState.selected === hit) refreshInspector();
      commit();
    }
    return;
  }
  if (tool === 'cart') {
    const chassis = sim.addCart([wx, wy + 0.4]);
    // 小车豁免"默认设置"：无摩擦车轮无牵引力、马达无法驱动，故保持原摩擦/弹性参数
    if (settings.defFrictionZero || settings.defRestitutionOne) {
      toast('小车不受默认摩擦/弹性设置影响（无摩擦车轮无法驱动），保持原参数');
    }
    uiState.selected = chassis;
    refreshInspector();
    commit();
    return;
  }
  if (tool === 'ruler' || tool === 'protractor') {
    handleMeasureClick(tool, wx, wy);
    return;
  }
  if (tool === 'delete') {
    const rec = hitBody(wx, wy);
    if (rec) {
      sim.removeBody(rec);
      if (uiState.selected === rec) uiState.selected = null;
      refreshInspector();
      commit();
    }
    return;
  }
  if (tool !== 'select') {
    drag = { mode: 'draw', kind: tool as DrawKind, x0: wx, y0: wy, x1: wx, y1: wy };
    return;
  }
  const rec = hitBody(wx, wy);
  if (rec) {
    uiState.selected = rec;
    refreshInspector();
    if (settings.playing && isDyn(rec)) {
      // 运行中拖拽：鼠标关节（可"拎着"物体感受力）；小车视为整体，一律挂在车厢上
      const chassis = rec.meta.group ? groupMembers(rec).find(r => r.meta.drive !== undefined) ?? rec : rec;
      const md = new b2.b2MouseJointDef();
      md.set_bodyA(sim.ground);
      md.set_bodyB(chassis.body);
      md.set_target(vec(wx, wy));
      md.set_maxForce(800 * Math.max(chassis.body.GetMass(), 1));
      const joint = sim.world.CreateJoint(md);
      sim.mouseJoint = joint;
      sim.mouseJointRec = chassis;
      chassis.body.SetAwake(true);
      drag = { mode: 'joint', rec: chassis, joint };
    } else if (!rec.meta.isKinematic || !settings.playing) {
      // 暂停拖拽：每个组成员各自记录抓取偏移，move 时整组平移
      const members = groupMembers(rec).map(r => {
        const p = r.body.GetPosition();
        return { rec: r, dx: p.x - wx, dy: p.y - wy };
      });
      drag = { mode: 'move', members, moved: false };
    } else {
      drag = { mode: 'pan', sx: e.offsetX, sy: e.offsetY, moved: false };
    }
  } else {
    drag = { mode: 'pan', sx: e.offsetX, sy: e.offsetY, moved: false };
  }
});

canvas.addEventListener('pointermove', e => {
  if (!drag) {
    // 悬停右上角按钮时给手型光标，离开则回到工具光标
    const over = hitTopRightButton(camera.w, e.offsetX, e.offsetY);
    canvas.style.cursor = over?.enabled ? 'pointer' : uiState.tool === 'select' ? 'default' : 'crosshair';
    return;
  }
  const wx = camera.s2wx(e.offsetX);
  const wy = camera.s2wy(e.offsetY);
  if (drag.mode === 'pan') {
    if (e.movementX || e.movementY) drag.moved = true;
    camera.panPx(e.movementX, e.movementY);
  } else if (drag.mode === 'move') {
    drag.moved = true;
    for (const m of drag.members) {
      m.rec.body.SetTransform(vec(wx + m.dx, wy + m.dy), m.rec.body.GetAngle());
    }
  } else if (drag.mode === 'joint') {
    drag.joint.SetTarget(vec(wx, wy));
    drag.rec.body.SetAwake(true);
  } else {
    drag.x1 = wx;
    drag.y1 = wy;
  }
});

canvas.addEventListener('pointerup', () => {
  if (!drag) return;
  const d = drag;
  drag = null;
  if (d.mode === 'pan') {
    if (!d.moved && uiState.tool === 'select') {
      uiState.selected = null;
      refreshInspector();
    }
  } else if (d.mode === 'move') {
    if (d.moved) commit();
  } else if (d.mode === 'joint') {
    sim.world.DestroyJoint(d.joint);
    sim.mouseJoint = null;
    sim.mouseJointRec = null;
  } else if (d.mode === 'draw') {
    finishDraw(d);
  }
});

/** "默认设置"开启时为新建物体注入的摩擦/弹性覆盖；小车豁免（见 cart 分支） */
function matDefaults(): { friction?: number; restitution?: number } {
  return {
    ...(settings.defFrictionZero ? { friction: 0 } : {}),
    ...(settings.defRestitutionOne ? { restitution: 1 } : {}),
  };
}

function finishDraw(d: Extract<Drag, { mode: 'draw' }>): void {
  if (d.kind === 'point') {
    uiState.selected = sim.addBody({ shape: { kind: 'point' }, pos: [d.x0, d.y0], trace: true, ...matDefaults() });
  } else if (d.kind === 'circle') {
    const r = Math.max(Math.hypot(d.x1 - d.x0, d.y1 - d.y0), 0.12);
    uiState.selected = sim.addBody({ shape: { kind: 'circle', r }, pos: [d.x0, d.y0], ...matDefaults() });
  } else if (d.kind === 'wedge' || d.kind === 'platformWedge') {
    const x0 = Math.min(d.x0, d.x1);
    const x1 = Math.max(d.x0, d.x1);
    const y0 = Math.min(d.y0, d.y1);
    const y1 = Math.max(d.y0, d.y1);
    const w = Math.max(x1 - x0, 0.15);
    const h = Math.max(y1 - y0, 0.15);
    uiState.selected = sim.addBody({
      shape: { kind: 'wedge', w, h },
      pos: [(x0 + x1) / 2, (y0 + y1) / 2],
      isStatic: d.kind === 'platformWedge',
      friction: d.kind === 'platformWedge' ? 0.5 : 0.3,
      ...matDefaults(),
    });
  } else if (d.kind === 'arc' || d.kind === 'platformArc') {
    const isStatic = d.kind === 'platformArc';
    // 创建默认 90° 弧带（滑道）；圆心角与"有底座"模式选中后在右侧属性面板修改
    const span = 90;
    const r = Math.max(Math.hypot(d.x1 - d.x0, d.y1 - d.y0), 0.3);
    // 轨道厚度随半径取 12~35 cm，保证小弧不至于薄成一条线
    const t = Math.min(0.35, Math.max(0.12, r * 0.15));
    uiState.selected = sim.addBody({
      shape: { kind: 'arc', r, t, span },
      pos: [d.x0, d.y0],
      isStatic,
      friction: isStatic ? 0.5 : 0.3,
      // 弧形物体默认刚体：不固定旋转，可翻滚/摆动（面板"视为质点"可切回）
      ...(isStatic ? {} : { asPoint: false }),
      ...matDefaults(),
    });
  } else {
    const x0 = Math.min(d.x0, d.x1);
    const x1 = Math.max(d.x0, d.x1);
    const y0 = Math.min(d.y0, d.y1);
    const y1 = Math.max(d.y0, d.y1);
    const w = Math.max(x1 - x0, 0.15);
    const h = Math.max(y1 - y0, 0.15);
    uiState.selected = sim.addBody({
      shape: { kind: 'rect', size: [w, h] },
      pos: [(x0 + x1) / 2, (y0 + y1) / 2],
      isStatic: d.kind === 'platform',
      friction: d.kind === 'platform' ? 0.5 : 0.3,
      ...matDefaults(),
    });
  }
  refreshInspector();
  commit();
}

canvas.addEventListener(
  'wheel',
  e => {
    e.preventDefault();
    camera.zoomAt(e.offsetX, e.offsetY, e.deltaY < 0 ? 1.15 : 1 / 1.15);
  },
  { passive: false },
);

window.addEventListener('keydown', e => {
  const t = e.target as HTMLElement | null;
  if (t && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(t.tagName)) return;
  if (e.code === 'Space') {
    e.preventDefault();
    togglePlay();
  } else if (e.code === 'Delete' && uiState.selected) {
    sim.removeBody(uiState.selected);
    uiState.selected = null;
    refreshInspector();
    commit();
  } else if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyZ' || e.code === 'KeyY')) {
    // Ctrl+Z 撤销 / Ctrl+Shift+Z、Ctrl+Y 重做（输入框内不拦截，保留原生撤销）
    e.preventDefault();
    doUndoRedo(e.code === 'KeyY' || e.shiftKey ? 'redo' : 'undo');
  } else if (e.code === 'Escape') {
    uiState.pendingLink = null;
    uiState.measure = null;
  }
});

/* ---------------- 渲染 ---------------- */

function togglePlay(): void {
  settings.playing = !settings.playing;
  controls.setPlaying(settings.playing);
}

function drawGhost(): void {
  if (!drag || drag.mode !== 'draw') return;
  const x0 = camera.w2sx(drag.x0);
  const y0 = camera.w2sy(drag.y0);
  const x1 = camera.w2sx(drag.x1);
  const y1 = camera.w2sy(drag.y1);
  ctx.save();
  ctx.strokeStyle = '#2563eb';
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1.5;
  if (drag.kind === 'circle') {
    ctx.beginPath();
    ctx.arc(x0, y0, Math.hypot(x1 - x0, y1 - y0), 0, Math.PI * 2);
    ctx.stroke();
  } else if (drag.kind === 'point') {
    ctx.beginPath();
    ctx.arc(x0, y0, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(37,99,235,0.55)';
    ctx.fill();
  } else if (drag.kind === 'wedge' || drag.kind === 'platformWedge') {
    // 拖拽包围盒 → 其中的直角三角形（局部 y 向上 → 画布 y 取负）
    const cx = (Math.min(x0, x1) + Math.max(x0, x1)) / 2;
    const cy = (Math.min(y0, y1) + Math.max(y0, y1)) / 2;
    const w = Math.abs(x1 - x0);
    const h = Math.abs(y1 - y0);
    const verts = wedgeVerts(w / camera.ppm, h / camera.ppm);
    ctx.beginPath();
    verts.forEach(([vx, vy], i) => {
      const px = cx + vx * camera.ppm;
      const py = cy - vy * camera.ppm;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.stroke();
  } else if (drag.kind === 'arc' || drag.kind === 'platformArc') {
    const span = 90;
    const rPx = Math.max(Math.hypot(x1 - x0, y1 - y0), 0.3 * camera.ppm);
    // 与 finishDraw 相同的默认厚度，预览所见即所得
    const tPx = Math.min(0.35, Math.max(0.12, (rPx / camera.ppm) * 0.15)) * camera.ppm;
    ctx.save();
    ctx.translate(x0, y0);
    arcBandPath(ctx, rPx, rPx - tPx, span);
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
  }
  ctx.restore();
}

function render(): void {
  ctx.clearRect(0, 0, camera.w, camera.h);
  drawGrid(ctx, sim.view, sim.gravity);
  drawJoints(ctx, sim.joints);
  if (settings.showTrace || settings.showStrobe) {
    for (const r of sim.records) if (r.meta.trace) drawTraces(ctx, r);
  }
  for (const r of sim.records) drawBody(ctx, r, r === uiState.selected);
  for (const r of sim.records) drawVectors(ctx, r, sim.view, sim.gravity);
  if (uiState.pendingLink) drawPendingLink(ctx, uiState.pendingLink);
  if (uiState.measure) drawMeasure(ctx, uiState.measure);
  drawGhost();
  $('st-time').textContent = `t = ${sim.t.toFixed(2)} s`;
  $('st-bodies').textContent = `物体 ${sim.records.length} · 连接件 ${sim.joints.length}`;
  $('st-view').textContent = sim.view === 'vertical' ? '垂直·侧视' : '平面·俯视';
  $('st-hint').textContent = uiState.pendingLink
    ? '已选定第一端（虚线圆标记）——点击另一端完成连接；Esc 取消'
    : TOOL_HINTS[uiState.tool];
}

let liveTimer = 0;
function tickLive(): void {
  const now = performance.now();
  if (now - liveTimer > 150) {
    liveTimer = now;
    refreshLive();
  }
}

/* ---------------- 装配入口 ---------------- */

async function boot(): Promise<void> {
  await initEngine();
  // 开发期调试暴露口（浏览器控制台/自动化验证用）
  if (import.meta.env.DEV) {
    (window as unknown as { __sim: typeof sim }).__sim = sim;
    (window as unknown as { __camera: typeof camera }).__camera = camera;
  }
  controls = initControls({
    onPlayToggle: togglePlay,
    onStep: () => sim.step(FIXED_DT),
    onReset: () => {
      if (sim.snapshotDef) loadScene(sim.snapshotDef, false);
    },
    onClearAll: async () => {
      if (!sim.records.length && !sim.joints.length && !uiState.measure) {
        toast('画布已经是空白的');
        return;
      }
      const ok = await uiConfirm(
        '确定要清空整个场景吗？所有物体、连接件、轨迹与测量数据都会被清除。',
      );
      if (!ok) return;
      loadScene(
        {
          meta: { name: '空白场景', view: sim.view, desc: '画布已清空，用左侧工具重新搭建实验吧。' },
          world: { gravity: sim.gravity },
          bodies: [],
          joints: [],
        },
        false, // 不重置相机
        null, // 脱离当前预设/我的实验归属
      );
    },
    onMode: async (v: ViewMode) => {
      if (v === sim.view) return;
      const ok = await uiConfirm(
        `切换到「${v === 'plane' ? '平面·俯视' : '垂直·侧视'}」将重建场景，当前搭建会被清空。确定切换吗？`,
      );
      if (ok) loadScene(sandboxScene(v), true, null);
    },
    onSpeed: v => (settings.timeScale = v),
    onGravity: v => {
      sim.setGravity(v);
      commit();
    },
    onExperiment: id => {
      if (id.startsWith('user:')) {
        const s = getSaved(id.slice(5));
        if (s) loadScene(s.def, true, { kind: 'user', id: s.id });
      } else {
        const p = PRESETS.find(x => x.id === id);
        if (p) loadScene(p.def, true, { kind: 'preset', id: p.id });
      }
    },
    onSaveExp,
    onRenameExp,
    onDeleteExp,
    onExportScene,
    onImportScene,
  });
  const tb = initToolbar(t => {
    uiState.tool = t;
    uiState.pendingLink = null;
    uiState.measure = null;
    tb.setActive(t);
    canvas.style.cursor = t === 'select' ? 'default' : 'crosshair';
  });
  tb.setActive('select');
  initPanel({ commit, refresh: () => undefined });
  setupCanvas();
  initCharts(() => {
    if (exportCsv(sim.sceneName)) toast('已导出 CSV 数据文件');
    else toast('暂无可导出的数据：先播放，并给物体勾选"记录轨迹"');
  });
  controls.refreshMyExperiments(listSaved());
  loadScene(sandboxScene('vertical'), true, null);
  startLoop(() => {
    render();
    tickLive();
    tickCharts();
  });
}

boot();
