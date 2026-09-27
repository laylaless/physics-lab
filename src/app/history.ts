import type { SceneDef } from '../scenes/schema';

/** 历史上限（条）：场景快照很小，100 步足够回溯一次完整搭建 */
const MAX = 100;

/** 快照栈：stack[idx] 恒为"当前状态"，栈底是场景装载时的初始状态 */
let stack: SceneDef[] = [];
let idx = -1;

/** 深拷贝：serialize() 的 bodies 元数据与 live meta 共享引用（shape/force 等），
 *  面板就地修改会污染快照，必须隔离 */
function clone(def: SceneDef): SceneDef {
  return JSON.parse(JSON.stringify(def)) as SceneDef;
}

function resetStack(def: SceneDef): void {
  stack = [clone(def)];
  idx = 0;
}

/** 撤销 / 重做：main.ts 在每次编辑确认（commit）后 push，载入新场景时 reset */
export const history = {
  canUndo: (): boolean => idx > 0,
  canRedo: (): boolean => idx >= 0 && idx < stack.length - 1,
  /** 载入新场景（预设/我的实验/导入/清空/切模式）：历史以该状态为起点 */
  reset(def: SceneDef): void {
    resetStack(def);
  },
  /** 编辑确认后压栈，丢弃重做尾巴 */
  push(def: SceneDef): void {
    if (idx < 0) {
      resetStack(def);
      return;
    }
    stack.length = idx + 1;
    stack.push(clone(def));
    if (stack.length > MAX) stack.shift();
    idx = stack.length - 1;
  },
  /** 取上一状态（栈内位置同步前移）；无可撤销则返回 null */
  undo(): SceneDef | null {
    if (idx <= 0) return null;
    return clone(stack[--idx]);
  },
  /** 取下一状态；无可重做则返回 null */
  redo(): SceneDef | null {
    if (idx < 0 || idx >= stack.length - 1) return null;
    return clone(stack[++idx]);
  },
};
