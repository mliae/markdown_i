// esbuild 打包：src/platform/node-entry.ts → dist/server.mjs
// better-sqlite3 是原生模块，必须 external，运行时从 node_modules import
// 用 ESM 输出：node-cron 顶层依赖 import.meta.url 定位其 daemon（本项目只跑前台任务，不启动 daemon）
import { build } from "esbuild";

await build({
  entryPoints: ["src/platform/node-entry.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "dist/server.mjs",
  sourcemap: true,
  external: ["better-sqlite3"],
  logLevel: "info",
});
