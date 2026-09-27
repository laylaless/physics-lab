import { sim } from '../core/sim';
import type { Sample } from '../core/bodies';

/** CSV 导出的采样列（与图表探针字段一致） */
const COLS: { key: string; label: string; pick: (s: Sample) => number }[] = [
  { key: 'x', label: 'x(m)', pick: s => s.x },
  { key: 'y', label: 'y(m)', pick: s => s.y },
  { key: 'vx', label: 'vx(m/s)', pick: s => s.vx },
  { key: 'vy', label: 'vy(m/s)', pick: s => s.vy },
  { key: 'sp', label: '|v|(m/s)', pick: s => s.sp },
  { key: 'ax', label: 'ax(m/s²)', pick: s => s.ax },
  { key: 'ay', label: 'ay(m/s²)', pick: s => s.ay },
  { key: 'ek', label: 'Ek(J)', pick: s => s.ek },
  { key: 'ep', label: 'Ep(J)', pick: s => s.ep },
  { key: 'en', label: '|N|(N)', pick: s => s.en },
];

/** 触发浏览器下载一个文本文件 */
export function downloadText(filename: string, text: string, mime = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 把所有探针物体（勾选"记录轨迹"且已有采样）的数据导出为 CSV：
 * 每行一个采样时刻（各物体在同一物理步采样，天然对齐），列 = 物体 × 字段。
 * 带返回值：false = 没有任何数据可导出。
 */
export function exportCsv(sceneName: string): boolean {
  const recs = sim.records.filter(r => !r.meta.isStatic && r.samples.length > 0);
  if (!recs.length) return false;
  const maxLen = Math.max(...recs.map(r => r.samples.length));
  const esc = (s: string): string => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines: string[] = [];
  const header = ['t(s)'];
  for (const r of recs) {
    const n = r.meta.label ? `${r.meta.label}(${r.meta.id})` : r.meta.id;
    for (const c of COLS) header.push(esc(`${n} ${c.label}`));
  }
  lines.push(header.join(','));
  for (let i = 0; i < maxLen; i++) {
    const cells: string[] = [];
    let t: number | null = null;
    for (const r of recs) {
      if (t === null && r.samples[i]) t = r.samples[i].t;
      for (const c of COLS) {
        cells.push(r.samples[i] ? c.pick(r.samples[i]).toFixed(3) : '');
      }
    }
    lines.push([(t ?? 0).toFixed(3), ...cells].join(','));
  }
  const name = sceneName.replace(/[\\/:*?"<>|]/g, '_') || '实验';
  // BOM：让 Excel 正确识别 UTF-8 中文表头
  downloadText(`${name}-数据.csv`, '\ufeff' + lines.join('\n'), 'text/csv;charset=utf-8');
  return true;
}
