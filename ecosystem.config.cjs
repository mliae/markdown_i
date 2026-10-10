// PM2 进程配置（阿里云生产）
// 用法：pm2 start ecosystem.config.cjs && pm2 save && pm2 startup
// 更新代码后：npm ci && npm run build && pm2 reload markdown-i
module.exports = {
  apps: [
    {
      name: "markdown-i",
      script: "dist/server.mjs",
      cwd: "/www/wwwsites/markdown-i",
      instances: 1, // 单实例：SQLite + 本地磁盘 + node-cron，多实例会重复跑定时任务
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: "8787",
        // 其余配置走项目根目录 .env（ADMIN_PASSWORD / SITE_NAME / DATA_DIR 等）
      },
      error_file: "/www/wwwsites/markdown-i/data/logs/pm2-error.log",
      out_file: "/www/wwwsites/markdown-i/data/logs/pm2-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
