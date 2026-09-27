import { settings } from './state';
import { sim, FIXED_DT } from '../core/sim';

/**
 * 固定步长主循环：按 timeScale 累积时间，以 1/60 s 步进物理，
 * 子步上限 8 防止卡顿时的"死亡螺旋"（超限直接丢弃积压）。
 */
export function startLoop(render: () => void): void {
  let last = performance.now();
  let acc = 0;
  const frame = (now: number): void => {
    const elapsed = Math.min((now - last) / 1000, 0.25);
    last = now;
    if (settings.playing) {
      acc += elapsed * settings.timeScale;
      let n = 0;
      while (acc >= FIXED_DT && n < 8) {
        sim.step(FIXED_DT);
        acc -= FIXED_DT;
        n++;
      }
      if (n === 8) acc = 0;
    }
    render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
