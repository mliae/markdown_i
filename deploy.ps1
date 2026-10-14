# deploy.ps1 — 一键部署：GitHub 备份 + 服务器更新（1Panel 容器版）
# 用法:  .\deploy.ps1            # 默认提交信息 "update"
#        .\deploy.ps1 -m "修复XX" # 自定义提交信息
param([string]$m = "update")

$ErrorActionPreference = "Stop"
$proj      = "c:\Users\Administrator\Documents\trae_projects\Markdown-i"
$key       = "$env:USERPROFILE\.ssh\markdown_i_deploy"
$server    = "root@118.178.126.217"
$remoteDir = "/opt/1panel/www/sites/ymao.me/index"
$rtDir     = "/opt/1panel/runtime/node/nodejs"
$tmp       = "/tmp/mdi-deploy"

Set-Location $proj

# ---------- 1. Git 提交 + GitHub 备份（失败不阻塞部署） ----------
Write-Host "[1/4] Git 提交并备份到 GitHub..." -ForegroundColor Cyan
git add -A
if (git status --porcelain) {
    git commit -m $m | Out-Null
    git push origin main 2>$null
    if ($LASTEXITCODE -eq 0) { Write-Host "  GitHub 备份完成" -ForegroundColor DarkGray }
    else { Write-Host "  GitHub 推送失败（检查代理全局模式），继续部署服务器" -ForegroundColor Yellow }
} else {
    Write-Host "  无改动，跳过 commit" -ForegroundColor DarkGray
}

# ---------- 2. 上传源码到服务器（src/public/package.json/scripts/.env） ----------
Write-Host "[2/4] 上传源码到服务器..." -ForegroundColor Cyan
ssh -i $key -o StrictHostKeyChecking=no -o ConnectTimeout=20 $server "rm -rf $tmp && mkdir -p $tmp"
scp -i $key -o StrictHostKeyChecking=no -q -r src public package.json scripts .npmrc "${server}:$tmp/"

# ---------- 3. 服务器端：覆盖源码（node_modules/dist 不动），index.html 最后覆盖 ----------
Write-Host "[3/4] 安装源码（index.html 最后覆盖，防 CDN 缓存污染）..." -ForegroundColor Cyan
ssh -i $key $server "cd $remoteDir && cp -r $tmp/src/. src/ && cp $tmp/package.json . && cp $tmp/.npmrc . && cp -r $tmp/scripts/. scripts/ 2>/dev/null; cd $tmp/public && find . -type f ! -name index.html -exec cp --parents {} $remoteDir/public/ \; && cp index.html $remoteDir/public/index.html && rm -rf $tmp && echo staged"

# ---------- 4. 容器内 npm ci + build + 重启 ----------
Write-Host "[4/4] 容器内构建并重启..." -ForegroundColor Cyan
ssh -i $key $server "cd $rtDir && docker compose run --rm node bash -c 'cd /app && npm ci && npm run build' 2>&1 | tail -5 && docker compose restart node && echo deployed"

Write-Host ""
Write-Host "完成：GitHub 已备份，容器已更新" -ForegroundColor Green
Write-Host "提示：若改了 public 下的 css/js，记得升 index.html 的 ?v= 版本号" -ForegroundColor DarkGray
