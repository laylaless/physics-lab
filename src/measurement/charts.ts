import { sim } from '../core/sim';
import type { Sample } from '../core/bodies';
import { THEORY, type CurveFn } from './theory';

/** 图表曲线（采样字段） */
export interface SeriesDef {
  id: string;
  label: string;
  unit: string;
  pick: (s: Sample) => number;
}

export const SERIES: SeriesDef[] = [
  { id: 'x', label: '位移 x', unit: 'm', pick: s => s.x },
  { id: 'y', label: '位移 y', unit: 'm', pick: s => s.y },
  { id: 'vx', label: '速度 vx', unit: 'm/s', pick: s => s.vx },
  { id: 'vy', label: '速度 vy', unit: 'm/s', pick: s => s.vy },
  { id: 'sp', label: '速率 |v|', unit: 'm/s', pick: s => s.sp },
  { id: 'acc', label: '加速度 |a|', unit: 'm/s²', pick: s => Math.hypot(s.ax, s.ay) },
  { id: 'ek', label: '动能 Ek', unit: 'J', pick: s => s.ek },
  { id: 'ep', label: '重力势能 Ep', unit: 'J', pick: s => s.ep },
  { id: 'en', label: '支持力 |N|', unit: 'N', pick: s => s.en },
];

export const chartState = {
  seriesId: 'vx',
  collapsed: false,
  showTheory: true,
};

/** 当前场景对应的预设 id（理论曲线注册表键）；null = 非预设场景 */
let activePreset: string | null = null;

export function setTheoryPreset(id: string | null): void {
  activePreset = id;
}

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let lastDraw = 0;
let onExportCsv: (() => void) | null = null;
let theoryToggle: HTMLInputElement | null = null;

export function initCharts(exportHook?: () => void): void {
  onExportCsv = exportHook ?? null;
  const bar = document.getElementById('chartbar');
  if (!bar) return;
  bar.innerHTML = '';

  const head = document.createElement('div');
  head.className = 'chart-head';
  const title = document.createElement('span');
  title.className = 'chart-title';
  title.textContent = '图表探针（勾选"记录轨迹"的物体）';
  const sel = document.createElement('select');
  sel.id = 'chart-series';
  for (const s of SERIES) {
    const o = document.createElement('option');
    o.value = s.id;
    o.textContent = `${s.label} – t`;
    if (s.id === chartState.seriesId) o.selected = true;
    sel.appendChild(o);
  }
  sel.addEventListener('change', () => (chartState.seriesId = sel.value));
  const theoryLabel = document.createElement('label');
  theoryLabel.className = 'chart-theory';
  const tgl = document.createElement('input');
  tgl.type = 'checkbox';
  tgl.checked = chartState.showTheory;
  tgl.addEventListener('change', () => (chartState.showTheory = tgl.checked));
  theoryToggle = tgl;
  theoryLabel.append(tgl, document.createTextNode('理论曲线'));
  const csv = document.createElement('button');
  csv.className = 'btn chart-btn';
  csv.textContent = '⬇ CSV';
  csv.title = '把所有探针物体的数据导出为 CSV（Excel 可开）';
  csv.addEventListener('click', () => onExportCsv?.());
  const clear = document.createElement('button');
  clear.className = 'btn chart-btn';
  clear.textContent = '清空数据';
  clear.addEventListener('click', () => {
    for (const r of sim.records) r.samples.length = 0;
  });
  const fold = document.createElement('button');
  fold.className = 'btn chart-btn';
  fold.textContent = chartState.collapsed ? '▴ 展开' : '▾ 收起';
  fold.addEventListener('click', () => {
    chartState.collapsed = !chartState.collapsed;
    bar.classList.toggle('folded', chartState.collapsed);
    fold.textContent = chartState.collapsed ? '▴ 展开' : '▾ 收起';
  });
  head.append(title, sel, theoryLabel, csv, clear, fold);
  bar.appendChild(head);

  const wrap = document.createElement('div');
  wrap.className = 'chart-wrap';
  canvas = document.createElement('canvas');
  canvas.id = 'chart';
  wrap.appendChild(canvas);
  bar.appendChild(wrap);
  ctx = canvas.getContext('2d')!;
  const resize = (): void => {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (w === 0 || h === 0) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  new ResizeObserver(resize).observe(wrap);
  resize();
}

/** 主循环节流调用（≈15 Hz 重绘足够） */
export function tickCharts(): void {
  const now = performance.now();
  if (now - lastDraw < 66 || !canvas || !ctx || chartState.collapsed) return;
  lastDraw = now;
  draw();
}

function draw(): void {
  const c = canvas!;
  const g2 = ctx!;
  const W = c.clientWidth;
  const H = c.clientHeight;
  g2.clearRect(0, 0, W, H);
  const series = SERIES.find(s => s.id === chartState.seriesId) ?? SERIES[0];

  const pad = { l: 52, r: 10, t: 10, b: 20 };
  const plotW = Math.max(W - pad.l - pad.r, 10);
  const plotH = Math.max(H - pad.t - pad.b, 10);

  // 采集所有带样本的物体
  const active = sim.records.filter(r => r.meta.trace && r.samples.length > 0 && !r.meta.isStatic);
  if (!active.length) {
    g2.fillStyle = '#94a3b8';
    g2.font = '12px system-ui';
    g2.textAlign = 'center';
    g2.fillText('播放后这里显示曲线（在属性面板勾选"记录轨迹"的物体会被采集）', W / 2, H / 2);
    return;
  }

  // 理论曲线（当前预设 + 当前序列）
  const theories: CurveFn[] = chartState.showTheory && activePreset ? THEORY[activePreset]?.[series.id] ?? [] : [];

  let tMin = Infinity;
  let tMax = -Infinity;
  let vMin = Infinity;
  let vMax = -Infinity;
  for (const r of active) {
    for (const s of r.samples) {
      if (s.t < tMin) tMin = s.t;
      if (s.t > tMax) tMax = s.t;
      const v = series.pick(s);
      if (v < vMin) vMin = v;
      if (v > vMax) vMax = v;
    }
  }
  // 理论值参与量程（只取范围内有限值）
  for (const th of theories) {
    const n = 60;
    for (let i = 0; i <= n; i++) {
      const t = tMin + ((tMax - tMin) * i) / n;
      const v = th(t, sim);
      if (v === null || !Number.isFinite(v)) continue;
      if (v < vMin) vMin = v;
      if (v > vMax) vMax = v;
    }
  }
  if (tMax - tMin < 0.5) tMax = tMin + 0.5;
  if (vMax - vMin < 1e-6) {
    vMax += 1;
    vMin -= 1;
  } else {
    const m = (vMax - vMin) * 0.08;
    vMax += m;
    vMin -= m;
  }

  // 网格与轴
  g2.strokeStyle = 'rgba(100,116,139,0.25)';
  g2.fillStyle = '#64748b';
  g2.font = '10px system-ui';
  g2.lineWidth = 1;
  g2.textAlign = 'right';
  g2.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (plotH * i) / 4;
    g2.beginPath();
    g2.moveTo(pad.l, y + 0.5);
    g2.lineTo(pad.l + plotW, y + 0.5);
    g2.stroke();
    const v = vMax - ((vMax - vMin) * i) / 4;
    g2.fillText(fmt(v), pad.l - 6, y);
  }
  g2.textAlign = 'center';
  g2.textBaseline = 'top';
  for (let i = 0; i <= 4; i++) {
    const x = pad.l + (plotW * i) / 4;
    const t = tMin + ((tMax - tMin) * i) / 4;
    g2.fillText(`${t.toFixed(1)}s`, x, H - pad.b + 4);
  }

  // 曲线（每物体一条）
  g2.lineWidth = 1.8;
  for (const r of active) {
    g2.strokeStyle = r.meta.color ?? '#3b82f6';
    g2.beginPath();
    let started = false;
    for (const s of r.samples) {
      const x = pad.l + ((s.t - tMin) / (tMax - tMin)) * plotW;
      const y = pad.t + (1 - (series.pick(s) - vMin) / (vMax - vMin)) * plotH;
      if (!started) {
        g2.moveTo(x, y);
        started = true;
      } else {
        g2.lineTo(x, y);
      }
    }
    g2.stroke();
  }

  // 理论曲线：黑色虚线
  if (theories.length) {
    g2.save();
    g2.strokeStyle = 'rgba(17,24,39,0.85)';
    g2.lineWidth = 1.6;
    g2.setLineDash([7, 4]);
    for (const th of theories) {
      g2.beginPath();
      let started = false;
      const n = 160;
      for (let i = 0; i <= n; i++) {
        const t = tMin + ((tMax - tMin) * i) / n;
        const v = th(t, sim);
        if (v === null || !Number.isFinite(v)) {
          started = false;
          continue;
        }
        const x = pad.l + ((t - tMin) / (tMax - tMin)) * plotW;
        const y = pad.t + (1 - (v - vMin) / (vMax - vMin)) * plotH;
        if (!started) {
          g2.moveTo(x, y);
          started = true;
        } else {
          g2.lineTo(x, y);
        }
      }
      g2.stroke();
    }
    g2.restore();
  }

  // 图例（左上角）
  g2.font = '11px system-ui';
  g2.textAlign = 'left';
  g2.textBaseline = 'middle';
  let lx = pad.l + 8;
  const ly = pad.t + 10;
  for (const r of active.slice(0, 6)) {
    const name = r.meta.label ?? r.meta.id;
    g2.fillStyle = r.meta.color ?? '#3b82f6';
    g2.fillRect(lx, ly - 4, 9, 9);
    g2.fillStyle = '#334155';
    g2.fillText(name, lx + 13, ly);
    lx += 13 + g2.measureText(name).width + 14;
    if (lx > pad.l + plotW - 120) break;
  }
  if (theories.length) {
    g2.strokeStyle = 'rgba(17,24,39,0.85)';
    g2.setLineDash([5, 3]);
    g2.lineWidth = 1.6;
    g2.beginPath();
    g2.moveTo(lx, ly);
    g2.lineTo(lx + 16, ly);
    g2.stroke();
    g2.setLineDash([]);
    g2.fillStyle = '#334155';
    g2.fillText('理论（公式）', lx + 21, ly);
  }
  // 单位标注（右上角）
  g2.fillStyle = '#475569';
  g2.textAlign = 'right';
  g2.fillText(`${series.label} (${series.unit})`, pad.l + plotW - 4, pad.t + 10);
}

function fmt(v: number): string {
  const a = Math.abs(v);
  if (a >= 100) return v.toFixed(0);
  if (a >= 10) return v.toFixed(1);
  return v.toFixed(2);
}
