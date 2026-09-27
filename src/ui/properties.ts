import { sim } from '../core/sim';
import { settings, uiState, stopwatch } from '../app/state';
import type { BodyRecord } from '../core/bodies';
import { pointDensity, resizeShape, eachFixture } from '../core/bodies';
import { wedgeArea, arcArea, arcBaseArea, clampArcSpan } from '../core/geometry';
import { JOINT_NAMES, distJointOf, jointEnds, jointReactionMag } from '../core/joints';
import type { JointRecord } from '../core/joints';
import { vec } from '../core/engine';

interface Hooks {
  /** 任何修改场景结构的编辑后调用，更新重置快照 */
  commit(): void;
  /** 场景结构变化（建/删关节、小车）后刷新画布提示等 */
  refresh(): void;
}

let hooks: Hooks;

/** "初始位置"输入框引用：拖拽/运行中由主循环节流同步当前坐标（正在输入的框跳过，避免覆盖键入值） */
let posXEl: HTMLInputElement | null = null;
let posYEl: HTMLInputElement | null = null;
let watchEl: HTMLElement | null = null;

/** 数值显示为最多 3 位小数（与 numInput 初值格式一致） */
function fmt3(v: number): string {
  return String(Math.round(v * 1000) / 1000);
}

function syncPosInputs(): void {
  // 播放中不同步："初始位置"冻结为释放时的值；暂停（可编辑状态）才实时跟随当前坐标
  if (settings.playing) return;
  const rec = uiState.selected;
  if (!rec || !posXEl || !posYEl) return;
  const p = rec.body.GetPosition();
  if (document.activeElement !== posXEl && posXEl.value !== fmt3(p.x)) posXEl.value = fmt3(p.x);
  if (document.activeElement !== posYEl && posYEl.value !== fmt3(p.y)) posYEl.value = fmt3(p.y);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function el<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function section(title: string): HTMLDivElement {
  const d = document.createElement('div');
  d.className = 'panel-section';
  const h = document.createElement('h4');
  h.textContent = title;
  d.appendChild(h);
  return d;
}

function hint(text: string): HTMLDivElement {
  const d = document.createElement('div');
  d.className = 'hint';
  d.textContent = text;
  return d;
}

function row(labelText: string, child: HTMLElement): HTMLDivElement {
  const r = document.createElement('div');
  r.className = 'row';
  const l = document.createElement('label');
  l.textContent = labelText;
  r.append(l, child);
  return r;
}

function numInput(val: number, step: number, onChange: (v: number) => void): HTMLInputElement {
  const i = document.createElement('input');
  i.type = 'number';
  i.step = String(step);
  i.value = String(Math.round(val * 1000) / 1000);
  i.addEventListener('change', () => {
    const v = parseFloat(i.value);
    if (!isNaN(v)) {
      onChange(v);
      hooks.commit();
    }
  });
  return i;
}

function checkInput(val: boolean, onChange: (v: boolean) => void): HTMLInputElement {
  const i = document.createElement('input');
  i.type = 'checkbox';
  i.checked = val;
  i.addEventListener('change', () => onChange(i.checked));
  return i;
}

function smallBtn(text: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'btn mini-btn';
  b.textContent = text;
  b.addEventListener('click', () => {
    onClick();
    b.blur();
  });
  return b;
}

export function initPanel(h: Hooks): void {
  hooks = h;
  const panel = el('panel');
  panel.innerHTML = '';

  // 设置卡片：横向双标签（显示设置 | 默认设置）
  const s1 = document.createElement('div');
  s1.className = 'panel-section';
  const paneDisplay = document.createElement('div');
  const paneDefault = document.createElement('div');
  paneDefault.style.display = 'none';
  const tabBtns = ['显示设置', '默认设置'].map((t, i) => {
    const b = document.createElement('button');
    b.textContent = t;
    if (i === 0) b.classList.add('active');
    b.addEventListener('click', () => {
      for (const x of tabBtns) x.classList.toggle('active', x === b);
      paneDisplay.style.display = tabBtns[0].classList.contains('active') ? '' : 'none';
      paneDefault.style.display = tabBtns[1].classList.contains('active') ? '' : 'none';
    });
    return b;
  });
  const tabs = document.createElement('div');
  tabs.className = 'panel-tabs';
  tabs.append(tabBtns[0], tabBtns[1]);
  s1.append(tabs, paneDisplay, paneDefault);

  type BoolKey = {
    [K in keyof typeof settings]: (typeof settings)[K] extends boolean ? K : never;
  }[keyof typeof settings];
  const TOGGLES: [BoolKey, string][] = [
    ['vecV', '速度矢量 v'],
    ['vecA', '加速度矢量 a'],
    ['vecG', '重力矢量 G'],
    ['vecF', '合力矢量 ΣF'],
    ['vecN', '支持力 N'],
    ['vecFric', '摩擦力 f'],
    ['showTrace', '运动轨迹'],
    ['showStrobe', '频闪打点'],
    ['showGrid', '网格与标尺'],
  ];
  for (const [key, text] of TOGGLES) {
    paneDisplay.appendChild(row(text, checkInput(settings[key] as boolean, v => ((settings as any)[key] = v))));
  }
  paneDefault.appendChild(
    row('默认全体摩擦系数为 0', checkInput(settings.defFrictionZero, v => (settings.defFrictionZero = v))),
  );
  paneDefault.appendChild(
    row('默认全体弹性系数为 1', checkInput(settings.defRestitutionOne, v => (settings.defRestitutionOne = v))),
  );
  paneDefault.appendChild(hint('开启后仅影响之后添加的物体，已添加的物体不变；小车保持原参数（无摩擦车轮无牵引力，故不适用）'));
  panel.appendChild(s1);

  const s2 = section('物体属性');
  const inspector = document.createElement('div');
  inspector.id = 'inspector';
  s2.appendChild(inspector);
  panel.appendChild(s2);

  const s4 = section('秒表');
  const watch = document.createElement('div');
  watch.className = 'kv';
  const wdisp = document.createElement('b');
  wdisp.textContent = '0.00 s';
  wdisp.style.fontSize = '18px';
  watch.append(document.createElement('span'), wdisp);
  watchEl = wdisp;
  const wbtns = document.createElement('div');
  wbtns.className = 'row';
  const bStart = smallBtn('开始/停止', () => {
    if (stopwatch.running) {
      stopwatch.acc += (performance.now() - stopwatch.lastMark) / 1000;
      stopwatch.running = false;
    } else {
      stopwatch.running = true;
      stopwatch.lastMark = performance.now();
    }
  });
  const bReset = smallBtn('归零', () => {
    stopwatch.acc = 0;
    stopwatch.running = false;
    stopwatch.lastMark = performance.now();
  });
  wbtns.append(bStart, bReset);
  s4.append(watch, wbtns);
  panel.appendChild(s4);

  const s3 = section('实时数据');
  const live = document.createElement('div');
  live.id = 'live';
  s3.appendChild(live);
  panel.appendChild(s3);
}

/** 把连接件两端当前距离设为其原长/长度（弹簧/绳/轻杆通用），并回写输入框显示 */
function useCurLenBtn(j: JointRecord, lenEl: HTMLInputElement): HTMLButtonElement {
  return smallBtn('将当前长度视为原长', () => {
    const e = jointEnds(j);
    j.length = Math.max(Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]), 0.05);
    syncDistLength(j);
    lenEl.value = fmt3(j.length);
    hooks.commit();
  });
}

/** rod/rope 改长度后同步引擎约束（派生接口需 castObject，见 distJointOf） */
function syncDistLength(j: JointRecord): void {
  const dj = distJointOf(j);
  if (!dj) return;
  if (j.kind === 'rod') {
    dj.SetMinLength(j.length);
    dj.SetMaxLength(j.length);
  } else {
    dj.SetMaxLength(j.length);
  }
  j.recB.body.SetAwake(true);
}

/** 选中对象变化时重建属性编辑器 */
export function refreshInspector(): void {
  const box = el('inspector');
  box.innerHTML = '';
  posXEl = posYEl = null;
  const rec = uiState.selected;
  if (!rec) {
    box.appendChild(hint('在画布中点击一个物体，查看并编辑它的属性。'));
    return;
  }
  const m = rec.meta;
  const body = rec.body;

  const head = document.createElement('div');
  head.className = 'row';
  const name = document.createElement('b');
  name.textContent = m.label ? `${m.label}（${m.id}）` : m.id;
  const tag = document.createElement('span');
  tag.className = 'tag' + (m.isStatic ? ' static' : m.isKinematic ? ' kinematic' : m.asPoint ? ' point' : '');
  tag.textContent = m.isStatic ? '固定' : m.isKinematic ? '驱动' : m.asPoint ? '质点' : '刚体';
  head.append(name, tag);
  box.appendChild(head);

  /* —— 形状尺寸 —— */
  if (m.shape.kind === 'point') {
    const shape = m.shape;
    const rEl = numInput(shape.r, 0.05, v => {
      shape.r = Math.max(0.01, v);
      rEl.value = fmt3(shape.r);
    });
    box.appendChild(row('显示半径 r (m)', rEl));
    box.appendChild(hint('显示半径仅改变质点外观大小，碰撞与质量不受影响。'));
  } else if (m.shape.kind === 'circle') {
    box.appendChild(
      row(
        '半径 r (m)',
        numInput(m.shape.r, 0.05, v => {
          resizeShape(rec, { kind: 'circle', r: Math.max(0.02, v) });
          // 质量随面积重算：重建面板刷新质量显示
          refreshInspector();
        }),
      ),
    );
    if (!m.isStatic) box.appendChild(hint('改动尺寸后质量按 ρ·面积 重算（密度不变）。'));
  } else if (m.shape.kind === 'wedge') {
    const sh = m.shape;
    box.appendChild(
      row(
        '宽度 w (m)',
        numInput(sh.w, 0.1, v => {
          resizeShape(rec, { kind: 'wedge', w: Math.max(0.05, v), h: sh.h });
          refreshInspector();
        }),
      ),
    );
    box.appendChild(
      row(
        '高度 h (m)',
        numInput(sh.h, 0.1, v => {
          resizeShape(rec, { kind: 'wedge', w: sh.w, h: Math.max(0.05, v) });
          refreshInspector();
        }),
      ),
    );
    if (!m.isStatic) box.appendChild(hint('改动尺寸后质量按 ρ·面积 重算（密度不变）。'));
  } else if (m.shape.kind === 'arc') {
    const sh = m.shape;
    box.appendChild(
      row(
        '外半径 r (m)',
        numInput(sh.r, 0.1, v => {
          // 内半径必须为正：半径缩小时厚度随之收窄
          const r = Math.max(0.15, v);
          resizeShape(rec, { kind: 'arc', r, t: Math.min(sh.t, r - 0.08), span: sh.span });
          refreshInspector();
        }),
      ),
    );
    box.appendChild(
      row(
        '轨道厚度 t (m)',
        numInput(sh.t, 0.05, v => {
          resizeShape(rec, { kind: 'arc', r: sh.r, t: Math.min(Math.max(0.04, v), sh.r - 0.08), span: sh.span });
          refreshInspector();
        }),
      ),
    );
    box.appendChild(
      row(
        '圆心角 (°)',
        numInput(sh.span, 15, v => {
          resizeShape(rec, { kind: 'arc', r: sh.r, t: sh.t, span: clampArcSpan(v), ...(sh.base ? { base: true } : {}) });
          refreshInspector();
        }),
      ),
    );
    box.appendChild(
      row(
        '有底座（外方内弧）',
        checkInput(!!sh.base, v => {
          resizeShape(rec, {
            kind: 'arc',
            r: sh.r,
            t: sh.t,
            span: sh.span,
            ...(v ? { base: true } : {}),
          });
          refreshInspector();
        }),
      ),
    );
    box.appendChild(hint('有底座：外接矩形填充、内弧凹槽——外侧平直、底面平整，动态物体不会翻滚。'));
    if (!m.isStatic) box.appendChild(hint('改动尺寸后质量按 ρ·面积 重算（密度不变）。'));
  } else {
    const sz = m.shape.size;
    box.appendChild(
      row(
        '宽度 w (m)',
        numInput(sz[0], 0.1, v => {
          resizeShape(rec, { kind: 'rect', size: [Math.max(0.05, v), sz[1]] });
          refreshInspector();
        }),
      ),
    );
    box.appendChild(
      row(
        '高度 h (m)',
        numInput(sz[1], 0.1, v => {
          resizeShape(rec, { kind: 'rect', size: [sz[0], Math.max(0.05, v)] });
          refreshInspector();
        }),
      ),
    );
    if (!m.isStatic) box.appendChild(hint('改动尺寸后质量按 ρ·面积 重算（密度不变）。'));
  }

  /* —— 质量/密度 —— */
  if (!m.isStatic && !m.isKinematic) {
    if (m.shape.kind === 'point') {
      // 质点：面积无教学意义，直接编辑质量（密度按 πr² 反推）
      box.appendChild(
        row(
          '质量 m (kg)',
          numInput(body.GetMass(), 0.1, v2 => {
            m.density = pointDensity(v2);
            eachFixture(rec, f => f.SetDensity(m.density));
            body.ResetMassData();
          }),
        ),
      );
    } else {
      // 矩形/圆形/斜面/圆弧：密度为存储基准（序列化只存密度），质量 = 密度 × 面积，两输入框联动
      const area =
        m.shape.kind === 'rect'
          ? m.shape.size[0] * m.shape.size[1]
          : m.shape.kind === 'circle'
            ? Math.PI * m.shape.r * m.shape.r
            : m.shape.kind === 'wedge'
              ? wedgeArea(m.shape.w, m.shape.h)
              : m.shape.base
                ? arcBaseArea(m.shape.r, m.shape.t, m.shape.span)
                : arcArea(m.shape.r, m.shape.t, m.shape.span);
      let massEl: HTMLInputElement;
      let densityEl: HTMLInputElement;
      massEl = numInput(body.GetMass(), 0.1, v2 => {
        const mass = Math.max(0.01, v2); // 质量→密度反推；零/负密度会让动态体失去质量
        m.density = mass / area;
        eachFixture(rec, f => f.SetDensity(m.density));
        body.ResetMassData();
        massEl.value = fmt3(mass);
        densityEl.value = fmt3(m.density);
      });
      densityEl = numInput(m.density, 0.1, v2 => {
        m.density = Math.max(0.01, v2);
        eachFixture(rec, f => f.SetDensity(m.density));
        body.ResetMassData();
        densityEl.value = fmt3(m.density);
        massEl.value = fmt3(body.GetMass());
      });
      box.appendChild(row('质量 m (kg)', massEl));
      box.appendChild(row('密度 ρ (kg/m²)', densityEl));
      box.appendChild(
        row(
          '视为质点',
          checkInput(m.asPoint, v2 => {
            m.asPoint = v2;
            body.SetFixedRotation(v2);
            if (v2) body.SetAngularVelocity(0);
            hooks.commit();
            // 重建面板：标签（刚体↔质点）与角度行的显隐即时生效
            refreshInspector();
          }),
        ),
      );
      box.appendChild(hint('视为质点：固定旋转、只平动，碰撞与摩擦不再使它翻滚（教材质点模型）。'));
    }
  }
  box.appendChild(
    row(
      '摩擦系数 μ',
      numInput(m.friction, 0.05, v2 => {
        m.friction = v2;
        eachFixture(rec, f => f.SetFriction(v2));
      }),
    ),
  );
  box.appendChild(
    row(
      '弹性系数 e',
      numInput(m.restitution, 0.05, v2 => {
        m.restitution = v2;
        eachFixture(rec, f => f.SetRestitution(v2));
      }),
    ),
  );

  /* —— 小车驱动 —— */
  if (m.drive !== undefined) {
    box.appendChild(
      row(
        '驱动速度 v (m/s)',
        numInput(m.drive, 0.5, v2 => {
          sim.setDrive(rec, v2);
          hooks.commit();
        }),
      ),
    );
    box.appendChild(hint('正=向右。0 = 松开马达自由滑行。'));
  }

  /* —— 驱动器（电梯/振动马达） —— */
  const driver = sim.drivers.find(d => d.rec === rec);
  if (driver) {
    const osc = driver.def.type === 'oscY' ? driver.def : null;
    if (osc) {
      box.appendChild(row('驱动振幅 A (m)', numInput(osc.amp, 0.05, v2 => (osc.amp = Math.max(0.01, v2)))));
      box.appendChild(row('驱动频率 f (Hz)', numInput(osc.freq, 0.1, v2 => (osc.freq = Math.max(0.05, v2)))));
      box.appendChild(
        row(
          '扫频模式',
          checkInput(!!osc.sweep, v2 => {
            // 开启后频率从 from 线性扫到 to：自动扫过共振点，画振幅-频率响应
            osc.sweep = v2 ? { from: 0.3, to: 2.0, duration: 30 } : undefined;
            hooks.commit();
            refreshInspector();
          }),
        ),
      );
      if (osc.sweep) {
        box.appendChild(row('起始频率 (Hz)', numInput(osc.sweep.from, 0.1, v2 => (osc.sweep!.from = Math.max(0.05, v2)))));
        box.appendChild(row('终止频率 (Hz)', numInput(osc.sweep.to, 0.1, v2 => (osc.sweep!.to = Math.max(0.1, v2)))));
        box.appendChild(row('扫频时长 (s)', numInput(osc.sweep.duration, 5, v2 => (osc.sweep!.duration = Math.max(5, v2)))));
        box.appendChild(hint('频率随时间从起始扫到终止——振幅最大的位置就是固有频率（共振）。修改后按 ↺ 重置生效。'));
      } else {
        box.appendChild(hint('试试把频率调到系统固有频率附近，或勾选"扫频模式"自动扫出共振曲线。'));
      }
    } else {
      const elev = driver.def.type === 'elevator' ? driver.def : null;
      const ddiv = document.createElement('div');
      ddiv.className = 'row';
      const dl = document.createElement('label');
      dl.textContent = '电梯脚本';
      const dv = document.createElement('span');
      dv.className = 'tag kinematic';
      dv.textContent = (elev ? elev.profile : []).map(p => `${p.ay > 0 ? '+' : ''}${p.ay}`).join(' / ');
      ddiv.append(dl, dv);
      box.appendChild(ddiv);
      box.appendChild(hint('竖直加速度分段（m/s²），运行时循环播放：上升→停→下降→停。'));
    }
  }

  /* —— 施力 —— */
  if (!m.isStatic && !m.isKinematic) {
    const hasForce = !!(m.force || m.forces);
    if (hasForce) {
      if (m.force) {
        box.appendChild(
          row(
            '恒力 Fx (N)',
            numInput(m.force[0], 0.5, v2 => {
              m.force = [v2, m.force![1]];
            }),
          ),
        );
        box.appendChild(
          row(
            '恒力 Fy (N)',
            numInput(m.force[1], 0.5, v2 => {
              m.force = [m.force![0], v2];
            }),
          ),
        );
      }
      if (m.forces) {
        m.forces.forEach((f, i) => {
          box.appendChild(
            row(
              `${f.label ?? `F${i + 1}`} x (N)`,
              numInput(f.v[0], 0.5, v2 => {
                f.v = [v2, f.v[1]];
              }),
            ),
          );
          box.appendChild(
            row(
              `${f.label ?? `F${i + 1}`} y (N)`,
              numInput(f.v[1], 0.5, v2 => {
                f.v = [f.v[0], v2];
              }),
            ),
          );
        });
      }
      const rm = smallBtn('✕ 移除恒力', () => {
        m.force = undefined;
        m.forces = undefined;
        hooks.commit();
        refreshInspector();
      });
      const rr = document.createElement('div');
      rr.className = 'row';
      rr.appendChild(rm);
      box.appendChild(rr);
    } else {
      const add = smallBtn('➕ 施加恒力（2 N →）', () => {
        m.force = [2, 0];
        hooks.commit();
        refreshInspector();
      });
      const ar = document.createElement('div');
      ar.className = 'row';
      ar.appendChild(add);
      box.appendChild(ar);
    }
    if (m.forceRamp) {
      const r = m.forceRamp;
      box.appendChild(hint(`水平力随时间线性增大：${r.from} → ${r.to} N，用时 ${r.duration}s（静摩擦实验）。`));
    }
  }

  /* —— 关联连接件 —— */
  const related = sim.joints.filter(j => j.recA === rec || j.recB === rec);
  if (related.length) {
    const jt = document.createElement('div');
    jt.className = 'row';
    const jl = document.createElement('label');
    jl.textContent = '连接件';
    jt.appendChild(jl);
    box.appendChild(jt);
    for (const j of related) {
      const jr = document.createElement('div');
      jr.className = 'row';
      const jname = document.createElement('label');
      jname.textContent = JOINT_NAMES[j.kind];
      jr.appendChild(jname);
      const jdel = smallBtn('✕', () => {
        sim.removeJoint(j);
        hooks.commit();
        refreshInspector();
        hooks.refresh();
      });
      jr.appendChild(jdel);
      box.appendChild(jr);
      if (j.kind === 'spring') {
        box.appendChild(
          row(
            '劲度 k (N/m)',
            numInput(j.k, 5, v2 => {
              j.k = Math.max(0.5, v2);
            }),
          ),
        );
        const lenEl = numInput(j.length, 0.1, v2 => {
          j.length = Math.max(0.05, v2);
        });
        box.appendChild(row('原长 L₀ (m)', lenEl));
        const btnRow = document.createElement('div');
        btnRow.className = 'row';
        btnRow.appendChild(useCurLenBtn(j, lenEl));
        box.appendChild(btnRow);
      } else if (j.kind === 'rod' || j.kind === 'rope') {
        const lenEl = numInput(j.length, 0.1, v2 => {
          j.length = Math.max(0.05, v2);
          syncDistLength(j);
        });
        box.appendChild(row('长度 L (m)', lenEl));
        const btnRow = document.createElement('div');
        btnRow.className = 'row';
        btnRow.appendChild(useCurLenBtn(j, lenEl));
        box.appendChild(btnRow);
      } else if (j.kind === 'hinge' && j.motor) {
        box.appendChild(hint('该铰链带马达（小车驱动速度在上方"驱动速度"设置）。'));
      }
    }
  }

  /* —— 初始位置 / 角度 / 初速度 —— */
  const p0 = body.GetPosition();
  posXEl = numInput(p0.x, 0.5, v2 => setPos(rec, v2, body.GetPosition().y));
  posYEl = numInput(p0.y, 0.5, v2 => setPos(rec, body.GetPosition().x, v2));
  box.appendChild(row('初始位置 x (m)', posXEl));
  box.appendChild(row('初始位置 y (m)', posYEl));

  // 视为质点的动态物体没有姿态意义，隐藏角度编辑
  if (m.isStatic || !m.asPoint) {
    const deg = ((body.GetAngle() * 180) / Math.PI) % 360;
    box.appendChild(
      row(
        '角度 (°)',
        numInput(deg, 5, v2 => {
          const p = body.GetPosition();
          body.SetTransform(vec(p.x, p.y), (v2 * Math.PI) / 180);
        }),
      ),
    );
  }

  if (!m.isStatic && !m.isKinematic) {
    box.appendChild(row('初速度 vx (m/s)', numInput(m.v0[0], 0.5, v2 => setV0(rec, v2, m.v0[1]))));
    box.appendChild(row('初速度 vy (m/s)', numInput(m.v0[1], 0.5, v2 => setV0(rec, m.v0[0], v2))));
    box.appendChild(row('记录轨迹（含频闪、图表）', checkInput(m.trace, v2 => (m.trace = v2))));
    box.appendChild(hint('修改初始位置或初速度后，按 ↺ 重置重新释放；运行中修改会立即生效。'));
  } else if (m.isKinematic) {
    box.appendChild(row('记录轨迹（含频闪、图表）', checkInput(m.trace, v2 => (m.trace = v2))));
  }

  const del = document.createElement('button');
  del.className = 'btn-danger';
  del.textContent = m.group ? '🗑 删除整组（小车）' : '🗑 删除该物体';
  del.addEventListener('click', () => {
    sim.removeBody(rec);
    uiState.selected = null;
    refreshInspector();
    hooks.commit();
    hooks.refresh();
  });
  box.appendChild(del);
}

function setV0(rec: BodyRecord, vx: number, vy: number): void {
  rec.meta.v0 = [vx, vy];
  rec.body.SetLinearVelocity(vec(vx, vy));
}

function setPos(rec: BodyRecord, x: number, y: number): void {
  // 成组物体（小车）视为整体：按位移增量平移全部成员，保持相对几何
  const p = rec.body.GetPosition();
  const dx = x - p.x;
  const dy = y - p.y;
  const members = rec.meta.group ? sim.records.filter(r => r.meta.group === rec.meta.group) : [rec];
  for (const m of members) {
    const mp = m.body.GetPosition();
    m.body.SetTransform(vec(mp.x + dx, mp.y + dy), m.body.GetAngle());
    // 瞬移后唤醒，避免睡眠中的物体悬在半空不响应重力
    m.body.SetAwake(true);
  }
}

/** 主循环里节流调用：刷新选中物体的实时数据与秒表 */
export function refreshLive(): void {
  syncPosInputs();
  if (watchEl) {
    const t = stopwatch.acc + (stopwatch.running ? (performance.now() - stopwatch.lastMark) / 1000 : 0);
    watchEl.textContent = `${t.toFixed(2)} s`;
  }
  const box = el('live');
  const kv = (k: string, v: string): string => `<div class="kv"><span>${k}</span><b>${v}</b></div>`;
  const rec = uiState.selected;
  if (!rec) {
    box.innerHTML = '<div class="hint">未选中物体。</div>';
    return;
  }
  if (rec.meta.isStatic) {
    box.innerHTML = '<div class="hint">固定物体无运动数据。</div>';
    return;
  }
  const p = rec.body.GetPosition();
  const speed = Math.hypot(rec.vx, rec.vy);
  const acc = Math.hypot(rec.ax, rec.ay);
  const m = rec.body.GetMass();
  const ek = 0.5 * m * speed * speed;
  const pm = m * speed;
  const ep = sim.view === 'vertical' ? m * sim.gravity * Math.max(p.y, 0) * rec.meta.gravityScale : 0;
  const nMag = Math.hypot(rec.cnx, rec.cny);
  const fMag = Math.hypot(rec.cfx, rec.cfy);
  // 关联连接件的弹力/张力（弹簧=胡克弹力；绳/杆=约束反力）
  let jointRows = '';
  for (const j of sim.joints) {
    if (j.recB !== rec && j.recA !== rec) continue;
    const mag = jointReactionMag(j, 60);
    if (j.kind === 'spring') {
      const e = jointEnds(j);
      const curL = Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]);
      jointRows += kv('弹簧弹力 |F|', `${mag.toFixed(2)} N`);
      jointRows += kv('弹簧当前长度 L', `${curL.toFixed(3)} m`);
    }
    else if (j.kind === 'rope') jointRows += kv('绳张力 T', `${mag.toFixed(2)} N`);
    else if (j.kind === 'rod') jointRows += kv('杆作用力 |F|', `${mag.toFixed(2)} N`);
  }
  box.innerHTML =
    kv('位置 (x, y)', `(${p.x.toFixed(2)}, ${p.y.toFixed(2)}) m`) +
    kv('速度 v', `(${rec.vx.toFixed(2)}, ${rec.vy.toFixed(2)})，|v| = ${speed.toFixed(2)} m/s`) +
    kv('加速度 a', `(${rec.ax.toFixed(2)}, ${rec.ay.toFixed(2)})，|a| = ${acc.toFixed(2)} m/s²`) +
    kv('质量 m', `${m.toFixed(2)} kg`) +
    kv('动能 Ek', `${ek.toFixed(2)} J`) +
    (sim.view === 'vertical' ? kv('重力势能 Ep', `${ep.toFixed(2)} J`) : '') +
    kv('动量 p', `${pm.toFixed(2)} kg·m/s`) +
    jointRows +
    kv('支持力 |N|', `${nMag.toFixed(2)} N`) +
    kv('摩擦力 |f|', `${fMag.toFixed(2)} N`) +
    kv('摩擦生热 Q', `${rec.heat.toFixed(2)} J`) +
    kv('外力功 W外', `${rec.workExt.toFixed(2)} J`) +
    kv('摩擦功 Wf', `${rec.workFric.toFixed(2)} J`);
}
