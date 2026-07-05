/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// Vite + Vitest 合并配置。
// - base './' 让打包后的资源用相对路径，方便直接双击 index.html 或部署到任意子路径。
// - 测试用 node 环境即可：核心逻辑(碰撞/存档/攀爬/场景切换)均为纯函数，不依赖 DOM。
export default defineConfig({
  base: './',
  server: {
    host: true, // 暴露局域网，手机可访问
    port: 5180, // 固定端口，避开生息之链(5173)
    strictPort: true, // 端口被占直接报错，不静默跳号
    open: true,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
