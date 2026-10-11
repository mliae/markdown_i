# Markdown-i

轻博客 / 碎片化记录系统：图文即刻、长文、相册、评论、友情链接、音乐播放器等。
本仓库是 [moments](../moments)（Cloudflare Workers + D1 + R2 原版）的**自托管 Node 版**，同构核心代码，运行在单台 Node 服务器 + SQLite + 本地磁盘/对象存储上。

线上站点：<https://ymao.me>

---

## 1. 技术栈

- **Hono + TypeScript**：路由/业务逻辑与 Workers 版共用一套写法
- **Node.js 24**（必须 ≥20，better-sqlite3 按 Node ABI 编译）
- **better-sqlite3**：通过 `src/platform/sqlite-d1.ts` 适配为 D1 风格接口
- **本地磁盘 R2 适配器**：`src/platform/disk-r2.ts` 把 R2Bucket API 落到 `data/media/`
- **esbuild**：打包为 ESM 单文件 `dist/server.mjs`（Node 直接跑，无需 ts-node）
- 定时任务：`node-cron`；可选 AI：OpenAI 兼容接口

## 2. 目录结构

```
src/
  index.ts              Hono app 装配、路由注册、错误处理
  settings.ts           站点设置（类型/默认值/校验/读写）
  storage.ts            上传存储总入口（local / R2 / B2 路由、S3 SigV4）
  db.ts                 D1 风格数据层 + ensureSchema + keyToSrc
  media.ts / avatar.ts  媒体代理、评论头像
  markdown.ts           Markdown 渲染（上传链接 key 识别）
  routes/               各业务路由（admin/moments/posts/photos/friends/...）
  platform/
    node-entry.ts       Node 入口（建表、旧数据迁移、HTTP 服务、cron）
    disk-r2.ts          本地磁盘 R2Bucket 适配器
    sqlite-d1.ts        better-sqlite3 的 D1 适配
    assets-fetcher.ts   public/ 静态资源
    memory-cache.ts     内存缓存
    ai-openai.ts        OpenAI 兼容 AI 适配
public/                 前端（app.js 单文件 SPA + index.html/style.css/vendor）
scripts/build.mjs       esbuild 打包
migrations/             SQL 建表脚本（ensureSchema 执行）
data/                   运行时数据（不入库）：markdown-i.db + media/
deploy/                 部署相关（含历史/备份，非运行时）
ecosystem.config.cjs    PM2 配置（备用，当前生产走宝塔 Node 项目）
```

## 3. 本地开发

```powershell
# 需要 Node 24
npm install
copy .env.example .env   # 填入 ADMIN_PASSWORD
npm run dev              # tsx watch，改 src 自动重启，默认 http://127.0.0.1:8787
```

`.env` 变量：

| 变量 | 说明 |
|---|---|
| `ADMIN_PASSWORD` | 后台解锁密码（必填） |
| `PORT` | 监听端口，默认 8787 |
| `SITE_NAME` | 站点名 |
| `DATA_DIR` | 数据库+媒体目录，默认项目内 `data/` |
| `PUBLIC_DIR` | 静态资源目录，默认 `public/` |
| `AI_BASE_URL / AI_API_KEY / AI_MODEL` | AI 评论回复，留空禁用 |

后台入口默认 `/admin`（可在后台设置里改成任意单段秘密路径）。

## 4. 构建与生产运行

```powershell
npm run build    # esbuild -> dist/server.mjs（ESM，external better-sqlite3）
npm start         # node dist/server.mjs
npm run typecheck # tsc --noEmit（有少量历史类型报错，esbuild 不阻塞构建）
```

PM2 方式见 `ecosystem.config.cjs`（`pm2 start ecosystem.config.cjs`）。

## 5. 上传存储策略（重点）

后台「媒体 → 域名与存储」三选一，默认 **本地磁盘**：

| storage_mode | 物理位置 | 新对象 key 前缀 |
|---|---|---|
| `local`（默认） | 服务器 `data/media/`，由本站 `/media/` 输出 | 无前缀，如 `uploads/images/2026/...png` |
| `r2` | Cloudflare R2 远端桶（S3 API） | `r2/`，如 `r2/uploads/...` |
| `b2` | Backblaze B2（S3 API） | `b2/`，如 `b2/uploads/...` |

**核心规则：对象 key 前缀决定物理后端，与当前 storage_mode 无关。**

- 切换存储方式**不影响历史文件**：旧文件按 key 前缀永远能找到原位置，访问、删除都正常
- 新上传（图文/长文图片、视频、头像、评论图、友链头像）只进当前所选后端
- R2/B2 各自独立的 S3 凭证：端点、桶名、Key ID、Secret Key、公开域名
- **公开域名留空（私有桶）**：文件经本站 `/media/` 代理输出（透传 Range，支持视频拖拽），不暴露桶
- **填了公开域名**：页面直接使用桶域名直连，不走服务器流量
- 后台「测试 R2/B2 连接」会写入并删除一个探针对象验证读写权限
- Secret Key 只存服务端，公开 `/api/settings` 永远脱敏不返回
- 历史版本的 `storage_mode=r2` 实际写本地磁盘：Node 端启动时自动迁移为 `local`（日志见 `[migrate] storage_mode r2(本地磁盘) -> local`），旧无前缀文件路径不变

S3 签名（SigV4 path-style，见 `src/storage.ts` 的 `s3Fetch`）两端共用；Node(undici) 下流式 body 自动补 `duplex:"half"`。

## 6. 生产环境（宝塔 Node 项目）

| 项 | 值 |
|---|---|
| 服务器 | 118.178.126.217（SSH 密钥 `~/.ssh/markdown_i_deploy`） |
| 项目目录 | `/www/wwwsites/markdown-i` |
| 宝塔 Node 项目名 | `markdown_i`（下划线，不能带连字符） |
| Node | `/www/server/nodejs/v24.21.0` |
| 应用端口 | 8787（Nginx 反代到此） |
| 域名 | ymao.me，在**宝塔后台 Node 项目里绑定管理**（生成 `node_markdown_i.conf`） |
| 数据 | `/www/wwwsites/markdown-i/data/`（markdown-i.db + media/） |
| 运行日志 | `/www/wwwlogs/nodejs/markdown_i.log`、`/www/wwwlogs/markdown_i.log` |

当前宝塔项目启动方式是 `npm run dev`（tsx watch 直跑源码，保存/上传 src 即自动重启）；
正式化可在宝塔项目设置中改为先 `npm run build` 再 `npm start`。

宝塔接管后的自定义 Nginx 片段（重建配置不会被覆盖）：
`/www/server/panel/vhost/nginx/extension/markdown_i/zz_upload_size.conf`（上传体积 200m，
面板默认仅 1m）。证书续期、强制 HTTPS 等均在宝塔网站/项目后台管理。

**部署新代码**（只动本项目）：

```powershell
# 本地
tar -czf deploy.tar.gz src public/app.js
scp -i $env:USERPROFILE\.ssh\markdown_i_deploy deploy.tar.gz root@118.178.126.217:/tmp/
# 服务器：备份旧代码到 deploy/backups/，解压；tsx watch 会自动重启
#   若为 npm start 模式则需 npm run build 后在宝塔面板重启项目
```

## 7. 数据备份

关键只有 `data/` 一个目录（SQLite + 全部本地上传媒体），建议宝塔计划任务定期打包：

```bash
cd /www/wwwsites/markdown-i
tar czf /backup/markdown-i-$(date +%F).tar.gz data
```

代码旧版备份在服务器 `deploy/backups/`（含 Nginx 旧配置与过期证书副本）。

## 8. 开发记录

见 [docs/开发记录.md](docs/开发记录.md)，按日期追加。
