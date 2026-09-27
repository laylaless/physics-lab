import { PRESETS } from '../scenes/presets';
import type { ViewMode } from '../scenes/schema';
import type { SavedExperiment } from '../scenes/storage';

export interface ControlsHandlers {
  onPlayToggle(): void;
  onStep(): void;
  onReset(): void;
  onClearAll(): void;
  onMode(v: ViewMode): void;
  onSpeed(v: number): void;
  onGravity(v: number): void;
  onExperiment(id: string): void;
  onSaveExp(): void;
  onRenameExp(): void;
  onDeleteExp(): void;
  onExportScene(): void;
  onImportScene(): void;
}

export interface ControlsApi {
  setPlaying(p: boolean): void;
  syncMode(v: ViewMode): void;
  setGravityBox(visible: boolean, v: number): void;
  /** value：'' | 预设 id | 'user:<id>' */
  setExperiment(value: string): void;
  refreshMyExperiments(list: SavedExperiment[]): void;
  /** 当前是否为"我的实验"（控制重命名/删除按钮可用性） */
  setUserExpActive(on: boolean): void;
}

function label(text: string): HTMLSpanElement {
  const s = document.createElement('span');
  s.className = 'tb-label';
  s.textContent = text;
  return s;
}

export function initControls(h: ControlsHandlers): ControlsApi {
  const bar = document.getElementById('topbar')!;
  bar.innerHTML = '';

  const brand = document.createElement('div');
  brand.className = 'brand';
  brand.innerHTML = '🧪 物理实验室<small>高中力学模拟</small>';
  bar.appendChild(brand);

  const mkBtn = (text: string, cls: string, onClick: () => void): HTMLButtonElement => {
    const b = document.createElement('button');
    b.className = cls;
    b.textContent = text;
    b.addEventListener('click', () => {
      onClick();
      b.blur();
    });
    return b;
  };

  // 视角模式
  const g1 = document.createElement('div');
  g1.className = 'tb-group';
  g1.appendChild(label('视角'));
  const bPlane = mkBtn('平面·俯视', 'btn', () => h.onMode('plane'));
  const bVert = mkBtn('垂直·侧视', 'btn', () => h.onMode('vertical'));
  g1.append(bPlane, bVert);
  bar.appendChild(g1);

  // 运行控制
  const g2 = document.createElement('div');
  g2.className = 'tb-group';
  g2.appendChild(label('运行'));
  const bPlay = mkBtn('▶ 播放', 'btn play', h.onPlayToggle);
  const bStep = mkBtn('⏭ 单步', 'btn', h.onStep);
  const bReset = mkBtn('↺ 重置', 'btn', h.onReset);
  const bClear = mkBtn('🧹 清屏', 'btn', h.onClearAll);
  bClear.title = '清空画布上所有物体、轨迹与测量（保留视角、重力与缩放）';
  const spSel = document.createElement('select');
  for (const s of [0.1, 0.25, 0.5, 1, 2]) {
    const o = document.createElement('option');
    o.value = String(s);
    o.textContent = `${s}×`;
    if (s === 1) o.selected = true;
    spSel.appendChild(o);
  }
  spSel.addEventListener('change', () => h.onSpeed(parseFloat(spSel.value)));
  g2.append(bPlay, bStep, bReset, bClear, spSel);
  bar.appendChild(g2);

  // 重力（仅垂直模式显示）
  const g3 = document.createElement('div');
  g3.className = 'tb-group';
  g3.appendChild(label('重力 g'));
  const gInp = document.createElement('input');
  gInp.type = 'number';
  gInp.step = '0.1';
  gInp.min = '0';
  gInp.max = '25';
  gInp.value = '9.8';
  gInp.title = '重力加速度（地球 9.8 / 月球 1.63 / 失重 0）';
  gInp.addEventListener('change', () => {
    const v = parseFloat(gInp.value);
    if (!isNaN(v)) h.onGravity(Math.min(25, Math.max(0, v)));
  });
  g3.appendChild(gInp);
  bar.appendChild(g3);

  // 实验库
  const g4 = document.createElement('div');
  g4.className = 'tb-group';
  g4.appendChild(label('实验'));
  const expSel = document.createElement('select');
  expSel.className = 'exp-select';
  const ph = document.createElement('option');
  ph.value = '';
  ph.textContent = '📚 载入实验…';
  expSel.appendChild(ph);
  const groups = new Map<string, HTMLOptGroupElement>();
  for (const p of PRESETS) {
    let og = groups.get(p.group);
    if (!og) {
      og = document.createElement('optgroup');
      og.label = p.group;
      groups.set(p.group, og);
      expSel.appendChild(og);
    }
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = p.def.meta.name;
    og.appendChild(o);
  }
  expSel.addEventListener('change', () => {
    if (expSel.value) h.onExperiment(expSel.value);
  });
  const bSave = mkBtn('💾 保存', 'btn', h.onSaveExp);
  bSave.title = '把当前场景保存为"我的实验"（已是则覆盖更新）';
  const bRename = mkBtn('✏️ 重命名', 'btn', h.onRenameExp);
  bRename.title = '重命名当前"我的实验"';
  const bDelete = mkBtn('🗑 删除', 'btn', h.onDeleteExp);
  bDelete.title = '删除当前"我的实验"';
  const bExport = mkBtn('📤 导出', 'btn', h.onExportScene);
  bExport.title = '把当前场景导出为 .json 文件（分享给他人）';
  const bImport = mkBtn('📥 导入', 'btn', h.onImportScene);
  bImport.title = '从 .json 文件或粘贴的 JSON 导入场景';
  bRename.disabled = true;
  bDelete.disabled = true;
  g4.append(expSel, bSave, bRename, bDelete, bExport, bImport);
  bar.appendChild(g4);

  // "我的实验"分组（localStorage 持久化，重建时保留仍存在的选中项）
  let myGroup: HTMLOptGroupElement | null = null;
  function refreshMyExperiments(list: SavedExperiment[]): void {
    const keep = expSel.value;
    if (myGroup) {
      myGroup.remove();
      myGroup = null;
    }
    if (!list.length) return;
    myGroup = document.createElement('optgroup');
    myGroup.label = '我的实验';
    for (const e of list) {
      const o = document.createElement('option');
      o.value = `user:${e.id}`;
      o.textContent = e.name;
      myGroup.appendChild(o);
    }
    expSel.appendChild(myGroup);
    expSel.value = keep;
  }

  return {
    setPlaying(p) {
      bPlay.textContent = p ? '⏸ 暂停' : '▶ 播放';
      bPlay.classList.toggle('active', p);
    },
    syncMode(v) {
      bPlane.classList.toggle('active', v === 'plane');
      bVert.classList.toggle('active', v === 'vertical');
    },
    setGravityBox(visible, v) {
      g3.style.display = visible ? '' : 'none';
      gInp.value = v.toFixed(1);
    },
    setExperiment(value) {
      expSel.value = value;
    },
    refreshMyExperiments,
    setUserExpActive(on) {
      bRename.disabled = !on;
      bDelete.disabled = !on;
    },
  };
}
