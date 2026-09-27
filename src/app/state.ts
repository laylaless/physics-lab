import type { BodyRecord } from '../core/bodies';
import type { JointKind } from '../core/joints';

export type Tool =
  | 'select'
  | 'point'
  | 'rect'
  | 'circle'
  | 'wedge'
  | 'arc'
  | 'platform'
  | 'platformWedge'
  | 'platformArc'
  | 'rope'
  | 'rod'
  | 'spring'
  | 'hinge'
  | 'cart'
  | 'force'
  | 'ruler'
  | 'protractor'
  | 'delete';

/** 连接件工具（两击创建） */
export const LINK_TOOLS: Tool[] = ['rope', 'rod', 'spring', 'hinge'];
export const LINK_KIND: Record<string, JointKind> = {
  rope: 'rope',
  rod: 'rod',
  spring: 'spring',
  hinge: 'hinge',
};

/** 全局显示/运行设置 */
export const settings = {
  playing: false,
  timeScale: 1,
  showGrid: true,
  showTrace: true,
  showStrobe: true,
  vecV: true,
  vecA: true,
  vecG: false,
  vecF: false,
  vecN: false,
  vecFric: false,
  /** 默认设置：开启后仅影响此后用户添加的物体（小车豁免） */
  defFrictionZero: false,
  defRestitutionOne: false,
};

/** 连接件创建的挂起端点（第一击之后） */
export interface PendingLink {
  kind: JointKind;
  rec: BodyRecord | null;
  local: [number, number]; // rec 为 null 时即世界坐标
}

/** 屏幕测量（标尺两点 / 量角器三点），world 坐标存储 */
export interface MeasureState {
  kind: 'ruler' | 'protractor';
  pts: [number, number][];
}

export const uiState: {
  tool: Tool;
  selected: BodyRecord | null;
  pendingLink: PendingLink | null;
  measure: MeasureState | null;
} = {
  tool: 'select',
  selected: null,
  pendingLink: null,
  measure: null,
};

/** 秒表（与场景时间无关） */
export const stopwatch = {
  acc: 0, // 累计秒
  running: false,
  lastMark: 0,
};

export const TOOL_HINTS: Record<Tool, string> = {
  select: '点击选中物体；拖动物体（运行中体验鼠标关节），拖拽空白平移视图，滚轮缩放 · 空格 播放/暂停 · Del 删除选中',
  point: '点击画布放置一个质点（默认 1 kg，只平动不转动，可记录轨迹）',
  rect: '在画布上拖拽绘制一个矩形（动态物体）',
  circle: '按住确定圆心，拖拽确定半径（动态物体）',
  wedge: '拖拽绘制一个斜面体（直角三角形，动态物体；高左低右，选中后可改角度）',
  arc: '按住确定圆心，拖拽确定半径，绘制 90° 圆弧轨道（凹面朝上，滑道）；动态物体默认刚体可转动。选中后在右侧属性面板改圆心角（5~360°）、半径、厚度或勾选"有底座"',
  platform: '拖拽绘制固定平台；选中后可在右侧面板改角度，做成斜面',
  platformWedge: '拖拽绘制固定斜面（直角三角形；高左低右，选中后可在面板改角度/尺寸）',
  platformArc: '按住确定圆心，拖拽确定半径，绘制固定 90° 圆弧滑道；选中后在右侧属性面板改圆心角（5~360°）或勾选"有底座（外方内弧）"',
  rope: '两次点击创建绳（第一击：物体或空白=固定锚；第二击：另一物体或空白）',
  rod: '两次点击创建轻杆（刚性，可拉可压——竖直圆周实验用它）',
  spring: '两次点击创建弹簧（随后设置原长与弹性系数 k；胡克定律 F=kx）',
  hinge: '两次点击创建铰链（物体绕锚点转动；小车车轮即为铰链+马达）',
  cart: '点击画布放置一辆小车（车厢+两轮，选中车厢后在面板设置驱动速度）',
  force: '点击动态物体：放置/移除水平恒力 2 N（方向大小在属性面板调整）',
  ruler: '点击两点测量距离（米），结果标注在画布上',
  protractor: '点击三点测量夹角：顶点 → 边1 → 边2（度）',
  delete: '点击要删除的物体（小车等成组对象整组删除）',
};
