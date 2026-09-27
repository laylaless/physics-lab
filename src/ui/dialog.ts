/** 应用内统一样式的弹窗：uiPrompt 输入名称 / uiConfirm 确认操作 / uiSpringDialog 弹簧参数（Promise 风格） */

function buildShell(title: string): { overlay: HTMLDivElement; card: HTMLDivElement } {
  const overlay = document.createElement('div');
  overlay.className = 'dlg-overlay';
  const card = document.createElement('div');
  card.className = 'dlg';
  const h = document.createElement('div');
  h.className = 'dlg-title';
  h.textContent = title;
  card.appendChild(h);
  overlay.appendChild(card);
  return { overlay, card };
}

function mkAction(label: string, primary: boolean, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = primary ? 'btn dlg-ok' : 'btn';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

/** 输入框弹窗：确认返回输入值（原样，不去空格），取消/Esc/点遮罩返回 null */
export function uiPrompt(title: string, defaultValue = ''): Promise<string | null> {
  return new Promise(resolve => {
    const { overlay, card } = buildShell(title);
    const input = document.createElement('input');
    input.className = 'dlg-input';
    input.type = 'text';
    input.value = defaultValue;
    input.maxLength = 30;
    input.placeholder = '请输入实验名称';
    const actions = document.createElement('div');
    actions.className = 'dlg-actions';
    const close = (v: string | null): void => {
      overlay.remove();
      resolve(v);
    };
    actions.append(
      mkAction('取消', false, () => close(null)),
      mkAction('确定', true, () => close(input.value)),
    );
    card.append(input, actions);
    overlay.addEventListener('pointerdown', e => {
      if (e.target === overlay) close(null);
    });
    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  });
}

/** uiSpringDialog 的结果：length 为解析后的原长（m），k 为 undefined 表示用默认值 */
export interface SpringDialogResult {
  length: number;
  k?: number;
}

/** 一个"预设项 / 手动输入"二选一字段：两行单选，手动行内嵌数字输入 */
function mkChoiceField(
  groupName: string,
  autoLabel: string,
  manualDefault: string,
): { root: HTMLDivElement; isManual: () => boolean; manualValue: () => number | null } {
  const root = document.createElement('div');
  root.className = 'dlg-field';

  const mkRow = (checked: boolean, label: string): { row: HTMLLabelElement; radio: HTMLInputElement } => {
    const row = document.createElement('label');
    row.className = 'dlg-opt';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = groupName;
    radio.checked = checked;
    const span = document.createElement('span');
    span.textContent = label;
    row.append(radio, span);
    return { row, radio };
  };

  const auto = mkRow(true, autoLabel);
  const manual = mkRow(false, '手动输入');
  const num = document.createElement('input');
  num.className = 'dlg-num';
  num.type = 'number';
  num.min = '0';
  num.step = 'any';
  num.value = manualDefault;
  num.disabled = true;
  manual.row.appendChild(num);

  manual.radio.addEventListener('change', () => {
    num.disabled = !manual.radio.checked;
    if (manual.radio.checked) {
      num.focus();
      num.select();
    }
  });

  root.append(auto.row, manual.row);
  return {
    root,
    isManual: () => manual.radio.checked,
    manualValue: () => {
      const v = Number(num.value);
      return Number.isFinite(v) && v > 0 ? v : null;
    },
  };
}

/**
 * 弹簧参数弹窗：原长可选"将两物体现在的距离视为原长"或手动输入；
 * 弹性系数可选"默认（20 N/m）"或手动输入。取消/Esc/点遮罩返回 null。
 */
export function uiSpringDialog(dist: number): Promise<SpringDialogResult | null> {
  const DEFAULT_K = 20;
  return new Promise(resolve => {
    const { overlay, card } = buildShell('设置弹簧参数');

    const lenTitle = document.createElement('div');
    lenTitle.className = 'dlg-field-title';
    lenTitle.textContent = '原长 L₀ (m)';
    const lenField = mkChoiceField('spring-len', `将两物体现在的距离视为原长（≈ ${dist.toFixed(2)} m）`, dist.toFixed(2));

    const kTitle = document.createElement('div');
    kTitle.className = 'dlg-field-title';
    kTitle.textContent = '弹性系数 k (N/m)';
    const kField = mkChoiceField('spring-k', `默认（${DEFAULT_K} N/m）`, String(DEFAULT_K));

    const err = document.createElement('div');
    err.className = 'dlg-err';

    const actions = document.createElement('div');
    actions.className = 'dlg-actions';
    const close = (v: SpringDialogResult | null): void => {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(v);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close(null);
    };
    const submit = (): void => {
      err.textContent = '';
      const length = lenField.isManual() ? lenField.manualValue() : dist;
      if (length === null) {
        err.textContent = '原长需为正数';
        return;
      }
      let k: number | undefined;
      if (kField.isManual()) {
        const kv = kField.manualValue();
        if (kv === null) {
          err.textContent = '弹性系数需为正数';
          return;
        }
        k = kv;
      }
      close({ length, k });
    };
    actions.append(
      mkAction('取消', false, () => close(null)),
      mkAction('确定', true, submit),
    );

    card.append(lenTitle, lenField.root, kTitle, kField.root, err, actions);
    overlay.addEventListener('pointerdown', e => {
      if (e.target === overlay) close(null);
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
  });
}

/** 确认弹窗：确定返回 true，取消/Esc/点遮罩返回 false */
export function uiConfirm(message: string): Promise<boolean> {
  return new Promise(resolve => {
    const { overlay, card } = buildShell(message);
    const actions = document.createElement('div');
    actions.className = 'dlg-actions';
    const close = (v: boolean): void => {
      overlay.remove();
      resolve(v);
    };
    const bOk = mkAction('确定', true, () => close(true));
    actions.append(
      mkAction('取消', false, () => close(false)),
      bOk,
    );
    card.appendChild(actions);
    overlay.addEventListener('pointerdown', e => {
      if (e.target === overlay) close(false);
    });
    document.body.appendChild(overlay);
    requestAnimationFrame(() => bOk.focus());
  });
}

/** 场景导入弹窗：粘贴 JSON 文本或选择 .json 文件；返回 JSON 文本，取消返回 null */
export function uiImportScene(): Promise<string | null> {
  return new Promise(resolve => {
    const { overlay, card } = buildShell('导入场景 JSON');
    const tip = document.createElement('div');
    tip.className = 'dlg-tip';
    tip.textContent = '粘贴场景 JSON 文本，或选择此前导出的 .json 文件。';
    const ta = document.createElement('textarea');
    ta.className = 'dlg-textarea';
    ta.placeholder = '{ "meta": { "name": "...", "view": "vertical" }, "bodies": [...] }';
    ta.spellcheck = false;
    const fileRow = document.createElement('div');
    fileRow.className = 'dlg-file';
    const fileBtn = mkAction('选择文件…', false, () => fileInput.click());
    const fileName = document.createElement('span');
    fileName.className = 'dlg-filename';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,application/json';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', () => {
      const f = fileInput.files?.[0];
      if (!f) return;
      fileName.textContent = f.name;
      const reader = new FileReader();
      reader.onload = () => {
        ta.value = String(reader.result ?? '');
      };
      reader.readAsText(f);
    });
    fileRow.append(fileBtn, fileName, fileInput);

    const err = document.createElement('div');
    err.className = 'dlg-err';
    const actions = document.createElement('div');
    actions.className = 'dlg-actions';
    const close = (v: string | null): void => {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(v);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close(null);
    };
    const submit = (): void => {
      const text = ta.value.trim();
      if (!text) {
        err.textContent = '请先粘贴 JSON 或选择文件';
        return;
      }
      close(text);
    };
    actions.append(
      mkAction('取消', false, () => close(null)),
      mkAction('导入', true, submit),
    );
    card.append(tip, ta, fileRow, err, actions);
    overlay.addEventListener('pointerdown', e => {
      if (e.target === overlay) close(null);
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => ta.focus());
  });
}
