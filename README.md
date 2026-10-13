# Markdown-i

轻博客 / 碎片化记录系统：图文即刻、长文、相册、评论、友情链接、音乐播放器等。
单台 Node 服务器自托管：Hono + TypeScript + SQLite（better-sqlite3）+ 本地磁盘 / 对象存储。

线上站点：<https://ymao.me>

---

## 1. 技术栈

| 组件 | 说明 |
|---|---|
| Web 框架 | Hono 4 + TypeScript，业务代码与运行时解耦 |
| 运行时 | Node.js 24（要求 ≥20，better-sqlite3 按 Node ABI 编译） |
| 数据库 | SQLite（better-sqlite3），经 `src/platform/sqlite-d1.ts` 适配为 D1 风格接口 |
| 存储 | 本地磁盘（默认）/ Cloudflare R2 / Backblaze B2，S3 SigV4 签名 |
| 构建 | esbuild 打包为 ESM 单文件 `dist/server.mjs` |
| 定时任务 | node-cron（友圈抓取、监控、头像补偿、QQ 保活） |
| AI（可选） | 任意 OpenAI 兼容接口（DeepSeek / 通义千问 / vLLM 等） |

### 目录结构

```
src/
  index.ts              Hono app 装配、路由注册、SSR 首帧直出、错误处理
  settings.ts           站点设置（类型/默认值/校验/读写）
  storage.ts            上传存储总入口（local / R2 / B2 路由、S3 SigV4）
  db.ts                 数据层 + 自动建表（ensureSchema）+ keyToSrc
  seo.ts                SEO / SSR / robots / sitemap / rss
  routes/               各业务路由（admin/moments/posts/photos/friends/...）
  platform/
    node-entry.ts       Node 入口（建表、数据迁移、HTTP 服务、cron）
    sqlite-d1.ts        better-sqlite3 的 D1 适配
    disk-r2.ts          本地磁盘适配器（storage_mode=local 时充当 R2 接口）
    assets-fetcher.ts   public/ 静态资源 + SPA 兜底
    memory-cache.ts     进程内缓存
    ai-openai.ts        OpenAI 兼容 AI 适配
public/                 前端（app.js 单文件 SPA + index.html/style.css/vendor）
scripts/build.mjs       esbuild 打包脚本
data/                   运行时数据（不入库）：markdown-i.db + media/
deploy/                 部署相关（Nginx 示例、历史备份，非运行时）
ecosystem.config.cjs    PM2 配置（备用，生产走宝塔 Node 项目）
```

## 2. 本地开发

要求 Node.js ≥ 20（推荐 24）。

```powershell
npm install
copy .env.example .env   # 填入 ADMIN_PASSWORD
npm run dev              # tsx watch，改 src 自动重启，默认 http://127.0.0.1:8787
```

`.env` 变量：

| 变量 | 说明 |
|---|---|
| `ADMIN_PASSWORD` | 后台解锁密码（必填） |
| `PORT` | 监听端口，默认 8787 |
| `SITE_NAME` | 站点名兜底值（正式站点名以后台设置为准） |
| `DATA_DIR` | 数据库 + 本地媒体目录，默认项目内 `data/` |
| `PUBLIC_DIR` | 静态资源目录，默认 `public/` |
| `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` | OpenAI 兼容 AI 接口，留空自动禁用相关功能 |

后台入口默认 `/admin`（可在后台设置里改成任意单段秘密路径）。

> 存储凭证（R2/B2）不放在 `.env`，全部在后台「存储设置」可视化配置，存于数据库。

## 3. 构建与生产运行

```powershell
npm run build     # esbuild -> dist/server.mjs（ESM，external better-sqlite3）
npm start         # node dist/server.mjs
npm run typecheck # tsc --noEmit（有少量历史类型报错，不影响构建）
```

PM2 方式见 `ecosystem.config.cjs`（`pm2 start ecosystem.config.cjs`），生产环境推荐走宝塔 Node 项目（见第 6 节）。

## 4. 存储配置（local / R2 / B2）

后台「媒体 → 域名与存储」三选一，默认**本地磁盘**：

| storage_mode | 物理位置 | 新对象 key 前缀 |
|---|---|---|
| `local`（默认） | 服务器 `data/media/`，由本站 `/media/` 输出 | 无前缀，如 `uploads/images/2026/...png` |
| `r2` | Cloudflare R2 远端桶（S3 API） | `r2/`，如 `r2/uploads/...` |
| `b2` | Backblaze B2（S3 API） | `b2/`，如 `b2/uploads/...` |

**核心规则：对象 key 前缀决定物理后端，与当前 storage_mode 无关。**

- 切换存储方式**不影响历史文件**：旧文件按 key 前缀永远能找到原位置，访问、删除都正常
- 新上传（图文/长文图片、视频、头像、评论图、友链头像）只进当前所选后端
- **公开域名留空**：文件经本站 `/media/` 代理输出（透传 Range，支持视频拖拽），不暴露桶，私有桶可用
- **填了公开域名**：页面直接使用桶域名直连，不走服务器流量
- Secret Key / Application Key 只存服务端，公开 `/api/settings` 永远脱敏不返回
- 后台「测试 R2 连接」「测试 B2 连接」会写入并删除一个探针对象，验证真实读写权限
- 上传的文件统一只存 key（不含域名），公开域名后台可随时更换，历史内容自动跟随

### 4.1 Cloudflare R2 配置

1. Cloudflare Dashboard → **R2 对象存储** → 创建存储桶（记下桶名）
2. **管理 R2 API 令牌** → 创建 API 令牌（权限：对象读和写）→ 得到三样东西：
   - **访问密钥 ID**（Access Key ID）
   - **机密访问密钥**（Secret Access Key）
   - **S3 端点**，形如 `https://<账户ID>.r2.cloudflarestorage.com`
3. 后台「存储设置」选择 `r2`，填写：

| 字段 | 值 |
|---|---|
| R2 S3 端点 | `https://<账户ID>.r2.cloudflarestorage.com` |
| R2 桶名 | 创建的桶名 |
| Access Key ID | API 令牌的访问密钥 ID |
| Secret Access Key | API 令牌的机密访问密钥 |
| R2 公开访问域名 | 留空走本站代理；绑定自定义域则填 `https://域名` |

4. 点击「测试 R2 连接」，提示读写成功即可保存

### 4.2 Backblaze B2 配置

1. Backblaze 控制台 → **B2 Cloud Storage** → 创建 Bucket（记下桶名）
   - 桶设为 **Private**（推荐，走本站代理）或 Public（配公开域名直连）
2. **App Keys** → Add Application Key（或使用 Master Key），得到：
   - **keyID**：`0` 开头的 25 位字符串
   - **applicationKey**：**`K` 开头的 31~32 位字符串**
   - 桶所在区域的 S3 端点，形如 `https://s3.us-west-004.backblazeb2.com`
3. 后台「存储设置」选择 `b2`，填写：

| 字段 | 值 |
|---|---|
| B2 S3 端点 | 区域 S3 端点（带 `https://`） |
| B2 桶名 | 创建的桶名 |
| Application Key ID | keyID（`0` 开头 25 位） |
| Application Key | applicationKey（**`K` 开头 31~32 位**） |
| B2 公开访问域名 | 留空走本站代理；桶公开且有自定义域则填 `https://域名` |

4. 点击「测试 B2 连接」，提示读写成功即可保存

> **⚠️ 踩坑记录（SignatureDoesNotMatch）**：B2 报 403 `SignatureDoesNotMatch` 时，优先检查 **Application Key 字段是否误填成了 keyID**。两个字段长得像但完全不同：
> - keyID：`0` 开头、25 位（如 `003abc...`）
> - applicationKey：**`K` 开头、31~32 位**（如 `K001abc...`）
>
> 填反会导致所有请求签名验证不通过。不确定时到 Backblaze 后台重新生成一个 Application Key。

## 5. 宝塔部署流程

### 5.1 生产环境信息

| 项 | 值 |
|---|---|
| 服务器 | 118.178.126.217（SSH 密钥 `~/.ssh/markdown_i_deploy`） |
| 项目目录 | `/www/wwwsites/markdown-i` |
| 宝塔 Node 项目名 | `markdown_i`（下划线，不能带连字符） |
| Node 版本 | `/www/server/nodejs/v24.21.0` |
| 应用端口 | 8787（Nginx 反代到此） |
| 域名 | ymao.me，在**宝塔后台 Node 项目里绑定管理** |
| 数据目录 | `/www/wwwsites/markdown-i/data/`（SQLite 库 + 本地媒体） |
| 运行日志 | `/www/wwwlogs/nodejs/markdown_i.log` |

### 5.2 首次部署

1. **上传代码**：本地打包后上传服务器解压（或 git clone）

   ```powershell
   # 本地（PowerShell）
   tar -czf deploy.tar.gz src public package.json package-lock.json scripts tsconfig.json .env.example
   scp -i $env:USERPROFILE\.ssh\markdown_i_deploy deploy.tar.gz root@118.178.126.217:/tmp/
   ```

   ```bash
   # 服务器
   mkdir -p /www/wwwsites/markdown-i
   tar -xzf /tmp/deploy.tar.gz -C /www/wwwsites/markdown-i
   ```

2. **创建 `.env`**：在项目目录创建 `.env`，至少填写 `ADMIN_PASSWORD`（参考 `.env.example`）

3. **安装依赖并构建**：

   ```bash
   cd /www/wwwsites/markdown-i
   npm ci        # 或 npm install
   npm run build
   ```

4. **宝塔面板 → 网站 → Node 项目 → 添加 Node 项目**：
   - 项目目录：`/www/wwwsites/markdown-i`
   - 启动选项：`npm start`（即 `node dist/server.mjs`）
   - 项目名称：`markdown_i`
   - 端口：`8787`
   - 绑定域名：`ymao.me`（宝塔自动签发证书、强制 HTTPS）
   - 运行用户与 Node 版本按面板默认

5. **Nginx 上传体积**：宝塔 Node 项目默认 Nginx 配置限制上传 1m，需追加自定义片段
   `/www/server/panel/vhost/nginx/extension/markdown_i/zz_upload_size.conf`：

   ```nginx
   client_max_body_size 200m;
   ```

   放在 `extension/` 目录下的自定义片段重建配置时不会被覆盖。改完 `nginx -s reload`。

6. **验证**：访问 `https://ymao.me`，进入 `/admin` 用 `.env` 里的密码登录，到「存储设置」配置存储并测试连接。

> **开发模式（可选）**：宝塔项目启动选项也可用 `npm run dev`（tsx watch 直跑源码），
> 上传 `src/` 后自动重启、无需构建。正式生产推荐上面的 `npm start` 模式。

### 5.3 更新部署

```powershell
# 本地：打包变更代码上传
tar -czf deploy.tar.gz src public/app.js
scp -i $env:USERPROFILE\.ssh\markdown_i_deploy deploy.tar.gz root@118.178.126.217:/tmp/
```

```bash
# 服务器：备份旧代码 -> 解压新代码 -> 重启
cd /www/wwwsites/markdown-i
mkdir -p deploy/backups
tar -czf deploy/backups/$(date +%F-%H%M).tar.gz src public
tar -xzf /tmp/deploy.tar.gz -C /www/wwwsites/markdown-i
npm run build          # 仅依赖或源码变更时；tsx watch 模式可跳过
```

然后在宝塔面板重启 `markdown_i` 项目（`npm start` 模式必须重启；`npm run dev` 模式保存 src 即自动重启）。

依赖有变化时（package.json 变更）先执行 `npm ci` 再构建。

## 6. 数据备份

关键只有 `data/` 一个目录（SQLite + 全部本地上传媒体），建议宝塔计划任务定期打包：

```bash
cd /www/wwwsites/markdown-i
tar czf /backup/markdown-i-$(date +%F).tar.gz data
```

- 使用 R2/B2 存储时，`data/` 里只有数据库，媒体文件在远端桶（可另开桶版本化/跨区复制）
- 代码旧版备份在服务器 `deploy/backups/`
- 后台「系统 → 备份恢复」支持按表导出/恢复 JSON（单表 ≤10000 行）

## 7. 故障排查

| 现象 | 排查 |
|---|---|
| 后台打不开 / 502 | `tail -100 /www/wwwlogs/nodejs/markdown_i.log` 看启动报错；确认 `.env` 的 `ADMIN_PASSWORD` 存在 |
| 上传大文件失败 | 检查 Nginx `client_max_body_size`（见 5.2 第 5 步） |
| B2 报 403 SignatureDoesNotMatch | applicationKey 误填成 keyID，见 4.2 踩坑记录 |
| R2/B2 测试连接失败 | 端点必须带 `https://`；桶名区分大小写；令牌权限需含对象写 |
| 换域名后图片 404 | 后台「域名与存储」更新公开域名即可——文件只存 key，域名统一在出口拼接 |
| 视频不能拖拽播放 | 确认公开域名留空走本站 `/media/` 代理（已透传 Range），或桶域名支持 Range |

## 8. 开发记录

见 [docs/开发记录.md](docs/开发记录.md)，按日期追加。
