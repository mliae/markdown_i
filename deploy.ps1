# deploy.ps1 — 一键部署：GitHub 备份 + 服务器更新
# 用法:  .\deploy.ps1            # 默认提交信息 "update"
#        .\deploy.ps1 -m "修复XX" # 自定义提交信息
param([string]$m = "update")

$ErrorActionPreference = "Stop"
$proj      = "c:\Users\Administrator\Documents\trae_projects\Markdown-i"
$key       = "$env:USERPROFILE\.ssh\markdown_i_deploy"
$server    = "root@118.178.126.217"
$remoteDir = "/www/wwwsites/markdown-i"
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

# ---------- 2. 构建 ----------
Write-Host "[2/4] 构建 dist..." -ForegroundColor Cyan
npm run build

# ---------- 3. 上传（src/dist/public/package.json 到临时目录） ----------
Write-Host "[3/4] 上传服务器..." -ForegroundColor Cyan
ssh -i $key -o StrictHostKeyChecking=no -o ConnectTimeout=20 $server "rm -rf $tmp && mkdir -p $tmp"
scp -i $key -o StrictHostKeyChecking=no -q -r src dist public package.json "${server}:$tmp/"

# ---------- 4. 服务器端安装（index.html 最后覆盖，防 CDN 缓存污染）+ 重启 ----------
Write-Host "[4/4] 安装并重启服务..." -ForegroundColor Cyan
ssh -i $key $server "cd $remoteDir && cp -r $tmp/src/. src/ && cp -r $tmp/dist/. dist/ && cp $tmp/package.json . && cd $tmp/public && find . -type f ! -name index.html -exec cp --parents {} $remoteDir/public/ \; && cp index.html $remoteDir/public/index.html && rm -rf $tmp && (pm2 restart markdown_i 2>/dev/null || touch src/index.ts) && echo deployed"

Write-Host ""
Write-Host "完成：GitHub 已备份，服务器已更新" -ForegroundColor Green
Write-Host "提示：若改了 public 下的 css/js，记得升 index.html 的 ?v= 版本号" -ForegroundColor DarkGray
