import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // box2d-wasm 的 emscripten glue 按相对路径加载 .wasm，
  // 预打包会破坏该路径（请求变成 HTML 回退），需排除
  optimizeDeps: {
    exclude: ['box2d-wasm'],
  },
  server: {
    port: 5173,
  },
});
