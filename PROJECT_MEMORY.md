# Markdown-i 项目记忆文件

> 下次继续开发时，直接说"唤醒记忆"并让我读取本文件，即可恢复全部上下文。

## 项目概况

- 项目名：Markdown-i（个人博客 + 说说 + 相册 + 音乐）
- 技术栈：Hono + TypeScript + Node.js 22，better-sqlite3（D1 风格垫片），esbuild 打包 `dist/server.mjs`
- 本地路径：`c:\Users\Administrator\Documents\trae_projects\Markdown-i`
- 构建命令：`npm run build`（node scripts/build.mjs）

## 服务器（生产环境）

- IP：`118.178.126.217`，SSH 密钥：`%USERPROFILE%\.ssh\markdown_i_deploy`
- 系统：Ubuntu 26.04.1 LTS + 1Panel 面板
- 域名：ymao.me（主站）、music.jxe.me（中央音乐）
- 面板 URL：`http://118.178.126.217:13322/jxe2026`（安全入口，**注意不是旧的 jxen5qp0oyq**）
  - 入口只在根路径生效，子页面刷新会返回 Access Temporarily Unavailable，别在子页按 F5
- 1Panel 用户：mliae，API Key：`0894b9d2a318632ef25fbc773d3c8af4`（白名单所有 IP）

## 架构

访客 → CDN → OpenResty 容器(80/443，1Panel 反向代理站点，面板 ID=3) → 1panel-nodejs 容器(8787) → Node 应用

- 站点目录：`/opt/1panel/www/sites/ymao.me/index`
- Node 运行环境：`/opt/1panel/runtime/node/nodejs`（docker compose 管理）
- 数据：SQLite `/opt/1panel/www/sites/ymao.me/index/data/markdown-i.db`，后台配置存 `site_config` 表
- 其他容器：blog-radar(8899)、1Panel-openresty-W2Rb

## GitHub 备份

- 私有仓库：`https://github.com/mliae/markdown_i`（用户名 mliae）
- 用途：只做备份，部署仍走 scp 直传服务器
- 推送需代理：`git config http.proxy http://127.0.0.1:10808` + `http.version=HTTP/1.1`（HTTP/2 会被 reset）
- SSL 后端：schannel

## 部署

- 一键脚本：`deploy.ps1`（commit + push GitHub + npm build + scp 上传 + 容器内构建重启）
- 注意：deploy.ps1 内部 ssh 命令含 `&&`，PowerShell 5 会报错（不影响，可手动执行各步骤）
- **部署顺序固定：先传资源，最后传 index.html**（防 CDN 缓存污染）
- 版本号策略：`public/index.html` 中 `style.css` / `app.js` 的 `?v=` 必须递增，当前基准 `20261015a`

## 最近改动（2026-10-15 ~ 2026-10-17）

- 音乐胶囊改为 hover 展开 / 鼠标移走 260ms 延迟收起（仅 `(hover:hover) and (pointer:fine)` 设备）
- 展开态点击封面 → 播放/暂停（`togglePlay`）
- **修复友圈抓取只写入最后一条文章的严重 bug**：
  - 根因：`src/friendfeed.ts` 中 `stmt.bind()` 在 D1 垫片里是原地修改，`items.map(it => stmt.bind(...))` 生成的全是同一对象且 binds 被最后一条覆盖，导致每轮只写入 feed 前 20 条中的最后一条
  - `src/routes/photos.ts` 批量同步照片有同样 bug，一并修复
  - 修复方式：每条 item 新建 `env.DB.prepare(insertSql).bind(...)`
  - 验证：近 2 天新增文章从 0 变 29 篇，friend 6 从 1 条变 11 条
  - 已部署，GitHub 已推送（commit 4c255a9 / 108caac）

## 待办 / 未完成事项

- 1Panel 面板慢：根因是本地移动宽带 → 阿里云跨网丢包（20%+）/限速 2~4Mbps，非服务器问题
  - 本机 MTU 已从 1500 改为 1480（避免分片丢包），网卡协商 100Mbps，建议换六类线/千兆口
  - 建议：面板挂域名 + CDN，或代理访问；DNS 建议改 223.5.5.5 + 119.29.29.29
- 中央音乐：已用 `music.jxe.me` 解决 Cloudflare 封锁，结论不反代
- 1Panel 数据库管理：可选配"计划任务"每日自动备份 SQLite
- 安全：SSH 密码登录是否关闭、安全入口是否保留（未确认）
- 旧目录 `/www/wwwsites/markdown-i` 保留作备份，稳定后可删

## 关键账号/密钥（谨慎）

- 后台管理员密码：`7mbxv6vVPizzJNaLpp9CWz`
- 备份目录：`c:\Users\Administrator\Documents\server-backup-markdown-i-20261013\`
  - `mdi-backup.tar.gz`（.env + PM2 + deploy + data 数据库+媒体）、`mdi-nginx.tar.gz`、`mdi-cert.tar.gz`、`settings-export.json`
- 1Panel root 密码：`wf920720@`（重装系统时的面板密码，勿外泄）

## 网络/代理备忘

- 用户本机代理：v2rayN，端口 `10808`（系统代理开着，国内 IP 走直连）
- git 推送失败时：检查代理是否开启全局模式，然后重试