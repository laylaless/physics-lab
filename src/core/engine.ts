import Box2DFactory from 'box2d-wasm';

/**
 * box2d-wasm 的 embind 运行时类型在 TS 中难以精确表达，
 * 引擎对象统一在本模块收口为 any，业务代码不直接依赖其类型细节。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type B2Module = any;

export let b2: B2Module = null as unknown as B2Module;

export async function initEngine(): Promise<void> {
  if (b2) return;
  b2 = await Box2DFactory();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const vec = (x: number, y: number): any => new b2.b2Vec2(x, y);
