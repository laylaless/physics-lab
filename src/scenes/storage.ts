import type { SceneDef } from './schema';

/** 用户保存的实验（localStorage 持久化，刷新页面后仍在） */
export interface SavedExperiment {
  id: string;
  name: string;
  savedAt: number;
  def: SceneDef;
}

const KEY = 'physics-lab.my-experiments.v1';

function readAll(): SavedExperiment[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as SavedExperiment[]) : [];
  } catch {
    return []; // 数据损坏时按空库处理
  }
}

function writeAll(list: SavedExperiment[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false; // 隐私模式 / 存储配额满
  }
}

export function listSaved(): SavedExperiment[] {
  return readAll();
}

export function getSaved(id: string): SavedExperiment | undefined {
  return readAll().find(e => e.id === id);
}

export function findSavedByName(name: string): SavedExperiment | undefined {
  return readAll().find(e => e.name === name);
}

/** 新建或按 id 覆盖（保持列表顺序稳定），返回是否写入成功 */
export function putSaved(exp: SavedExperiment): boolean {
  const list = readAll();
  const i = list.findIndex(e => e.id === exp.id);
  if (i >= 0) list[i] = exp;
  else list.push(exp);
  return writeAll(list);
}

export function deleteSaved(id: string): boolean {
  return writeAll(readAll().filter(e => e.id !== id));
}

export function genId(): string {
  return `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
