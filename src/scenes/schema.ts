export type ViewMode = 'plane' | 'vertical';

/* ---------------- 物体 ---------------- */

export interface ForceItem {
  v: [number, number];
  label?: string;
}

export interface SceneBodyDef {
  id?: string;
  shape:
    | { kind: 'rect'; size: [number, number] }
    | { kind: 'circle'; r: number }
    /** 质点：物理上是碰撞半径恒为 POINT_R 的极小圆，恒视为质点、不转动；r 仅为显示半径（外观，缺省 POINT_R） */
    | { kind: 'point'; r?: number }
    /** 斜面（直角三角形实心块）：w/h 为包围盒宽高，局部原点在包围盒中心 */
    | { kind: 'wedge'; w: number; h: number }
    /** 圆弧轨道（有厚度的弧带，凹面朝上）：r 外半径、t 厚度、span 圆心角（度，5~360；
     *  90=四分之一滑道，180=U 形槽，270/360=环形轨道），静态/动态通用。
     *  base=true 有底座模式：外接矩形填充、内弧凹槽（外方内弧，动态物体不会翻滚） */
    | { kind: 'arc'; r: number; t: number; span: number; base?: true };
  /** 世界坐标（米），y 轴向上，原点在画布中央附近 */
  pos: [number, number];
  /** 弧度 */
  angle?: number;
  isStatic?: boolean;
  /** 运动学物体：不受力但可按脚本运动（电梯平台、振动马达） */
  kinematic?: boolean;
  /**
   * 是否视为质点（矩形/圆形用）：视为质点则固定旋转、只平动，运动学按质心处理。
   * 缺省 true；质点形状恒为 true。小车车轮等需要滚动的物体必须显式 false。
   */
  asPoint?: boolean;
  /** kg/m²（面积密度），动态物体的质量 = 密度 × 面积 */
  density?: number;
  friction?: number;
  restitution?: number;
  /** 初速度 m/s */
  v0?: [number, number];
  /** 重力缩放：0 表示不受重力（平抛实验的无重力参考球） */
  gravityScale?: number;
  /** 恒力（N），运行期间每步施加（匀变速等实验）；与 forces 可并存 */
  force?: [number, number];
  /** 多个命名恒力（力的合成实验），与 force 可并存 */
  forces?: ForceItem[];
  /** 水平力随时间线性增大（静摩擦实验）：从 from → to 用时 duration 秒，替代 force/forces 的 x 分量叠加 */
  forceRamp?: { from: number; to: number; duration: number };
  /** 是否记录轨迹与频闪点（同时作为图表探针） */
  trace?: boolean;
  color?: string;
  label?: string;
  /** 复合对象分组（如小车）：删除时任一分组成员会整组移除 */
  group?: string;
  /** 小车车厢的目标驱动速度（m/s，0 = 不驱动），驱动两轮马达 */
  drive?: number;
}

/* ---------------- 关节（连接件） ---------------- */

/** 关节端点：世界固定锚点 或 物体上的局部锚点（局部坐标，缺省物体中心 [0,0]） */
export type JointEnd = { world: [number, number] } | { body: string; local?: [number, number] };

export interface JointMotor {
  speed: number;
  torque: number;
}

export type SceneJointDef =
  /** 旧类型（等价 rod + 世界锚点），为已保存的"我的实验"保留兼容 */
  | { type: 'distance'; anchor: [number, number]; body: string; length?: number }
  | { type: 'rod'; a: JointEnd; b: JointEnd; length?: number }
  | { type: 'rope'; a: JointEnd; b: JointEnd; length?: number }
  | { type: 'spring'; a: JointEnd; b: JointEnd; k: number; length?: number; damping?: number }
  | { type: 'hinge'; a: JointEnd; b: JointEnd; motor?: JointMotor }
  | { type: 'slider'; a: JointEnd; b: JointEnd; axis?: [number, number] }
  | {
      type: 'pulley';
      a: JointEnd;
      b: JointEnd;
      groundAnchorA: [number, number];
      groundAnchorB: [number, number];
      ratio?: number;
    };

/* ---------------- 驱动器（运动学脚本体） ---------------- */

/** 电梯：竖直方向按 a–t 分段脚本运动（kinematic） */
export interface ElevatorPhase {
  /** 竖直加速度 m/s²（正=向上） */
  ay: number;
  /** 该阶段持续秒数 */
  dt: number;
}

export type SceneDriverDef =
  | { type: 'elevator'; body: string; profile: ElevatorPhase[]; loop?: boolean }
  /** 竖直简谐驱动（受迫振动的马达）；sweep 开启后频率从 from 线性扫到 to（共振曲线用） */
  | {
      type: 'oscY';
      body: string;
      amp: number;
      freq: number;
      sweep?: { from: number; to: number; duration: number };
    };

/* ---------------- 力场 ---------------- */

export type SceneFieldDef = { type: 'centralGravity'; gm: number; center: string };

/* ---------------- 场景 ---------------- */

export interface SceneDef {
  meta: {
    name: string;
    view: ViewMode;
    knowledge?: string;
    desc?: string;
    guides?: string[];
  };
  world: {
    /** 垂直模式重力大小（m/s²，正值向下） */
    gravity?: number;
    /** 初始视口：中心（米）与宽度（米） */
    viewport?: { cx: number; cy: number; widthM: number };
    /** 驱动器（电梯/振动马达） */
    drivers?: SceneDriverDef[];
    /** 自定义力场（中心引力等） */
    fields?: SceneFieldDef[];
  };
  bodies: SceneBodyDef[];
  joints?: SceneJointDef[];
}
