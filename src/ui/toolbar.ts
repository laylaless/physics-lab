import type { Tool } from '../app/state';

interface ToolItem {
  id: Tool;
  ico: string;
  label: string;
}
interface ToolGroup {
  key: string;
  title: string;
  color: string;
  tools: ToolItem[];
}

/** 工具箱分组：每组有专属底色，点击组名可折叠/展开（localStorage 记忆） */
const GROUPS: ToolGroup[] = [
  {
    key: 'objects',
    title: '物体',
    color: '#3b82f6',
    tools: [
      { id: 'point', ico: '•', label: '质点' },
      { id: 'rect', ico: '▭', label: '矩形' },
      { id: 'circle', ico: '⚪', label: '圆形' },
      { id: 'wedge', ico: '◺', label: '斜面体' },
      { id: 'arc', ico: '◡', label: '圆弧' },
    ],
  },
  {
    key: 'terrain',
    title: '平台',
    color: '#64748b',
    tools: [
      { id: 'platform', ico: '▬', label: '平台' },
      { id: 'platformWedge', ico: '◺', label: '斜面' },
      { id: 'platformArc', ico: '◡', label: '圆弧' },
    ],
  },
  {
    key: 'links',
    title: '连接',
    color: '#f59e0b',
    tools: [
      { id: 'rope', ico: '➰', label: '绳' },
      { id: 'rod', ico: '➖', label: '杆' },
      { id: 'spring', ico: '〰️', label: '弹簧' },
      { id: 'hinge', ico: '🔩', label: '铰链' },
    ],
  },
  {
    key: 'agents',
    title: '对象',
    color: '#8b5cf6',
    tools: [
      { id: 'cart', ico: '🚗', label: '小车' },
      { id: 'force', ico: '🡆', label: '施力' },
    ],
  },
  {
    key: 'measure',
    title: '测量',
    color: '#10b981',
    tools: [
      { id: 'ruler', ico: '📏', label: '标尺' },
      { id: 'protractor', ico: '📐', label: '量角' },
    ],
  },
];

const LS_KEY = 'physics-lab.toolbar.collapsed.v1';
/** 圆弧工具开关（已知有 bug，默认关闭） */
const LS_ARC = 'physics-lab.toolbar.arcTools.v1';
const ARC_TOOLS: Tool[] = ['arc', 'platformArc'];

function loadCollapsed(): Set<string> {
  try {
    const arr: unknown = JSON.parse(localStorage.getItem(LS_KEY) ?? '[]');
    return new Set(Array.isArray(arr) ? (arr as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveCollapsed(collapsed: Set<string>): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...collapsed]));
  } catch {
    /* 存储不可用时仅本会话生效 */
  }
}

function loadArcTools(): boolean {
  try {
    return localStorage.getItem(LS_ARC) === '1';
  } catch {
    return false;
  }
}

function saveArcTools(on: boolean): void {
  try {
    localStorage.setItem(LS_ARC, on ? '1' : '0');
  } catch {
    /* 存储不可用时仅本会话生效 */
  }
}

/** #rrggbb → rgba(r,g,b,a)（组头浅色底用） */
function tint(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function initToolbar(onTool: (t: Tool) => void): { setActive(t: Tool): void } {
  const nav = document.getElementById('toolbar')!;
  const btns = new Map<Tool, HTMLButtonElement>();
  const collapsed = loadCollapsed();
  let currentTool: Tool = 'select';

  const setActive = (t: Tool): void => {
    currentTool = t;
    btns.forEach((b, id) => b.classList.toggle('active', id === t));
  };

  const mkToolBtn = (t: ToolItem): HTMLButtonElement => {
    const b = document.createElement('button');
    b.className = 'tool';
    b.innerHTML = `<span class="ico">${t.ico}</span><span>${t.label}</span>`;
    b.addEventListener('click', () => {
      onTool(t.id);
      b.blur();
    });
    btns.set(t.id, b);
    return b;
  };

  // 选择 / 删除 不属于任何组，常驻首尾
  nav.appendChild(mkToolBtn({ id: 'select', ico: '🖱️', label: '选择' }));

  for (const g of GROUPS) {
    const group = document.createElement('div');
    group.className = 'tool-group' + (collapsed.has(g.key) ? ' collapsed' : '');
    const head = document.createElement('button');
    head.className = 'tool-group-head';
    head.style.color = g.color;
    head.style.background = tint(g.color, 0.14);
    head.innerHTML = `<span class="arr">▾</span><span>${g.title}</span>`;
    head.addEventListener('click', () => {
      const fold = !group.classList.contains('collapsed');
      group.classList.toggle('collapsed', fold);
      if (fold) collapsed.add(g.key);
      else collapsed.delete(g.key);
      saveCollapsed(collapsed);
      head.blur();
    });
    const body = document.createElement('div');
    body.className = 'tool-group-body';
    for (const t of g.tools) body.appendChild(mkToolBtn(t));
    group.append(head, body);
    nav.appendChild(group);
  }

  nav.appendChild(mkToolBtn({ id: 'delete', ico: '🗑️', label: '删除' }));

  // 圆弧工具开关：默认关闭，两组"圆弧"按钮隐藏；关闭时若正用圆弧工具则退回"选择"
  const arcBtn = document.createElement('button');
  arcBtn.type = 'button';
  arcBtn.className = 'arc-switch';
  let arcOn = loadArcTools();
  const applyArc = (): void => {
    for (const id of ARC_TOOLS) btns.get(id)!.hidden = !arcOn;
    arcBtn.textContent = arcOn ? '关闭圆弧（有bug）' : '打开圆弧（有bug）';
    arcBtn.classList.toggle('on', arcOn);
    arcBtn.setAttribute('aria-pressed', String(arcOn));
    if (!arcOn && ARC_TOOLS.includes(currentTool)) {
      onTool('select');
      setActive('select');
    }
  };
  arcBtn.addEventListener('click', () => {
    arcOn = !arcOn;
    saveArcTools(arcOn);
    applyArc();
    arcBtn.blur();
  });
  nav.appendChild(arcBtn);
  applyArc();

  return { setActive };
}
