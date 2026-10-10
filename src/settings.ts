/**
 * 站点配置：单行 site_config(id=1, data=JSON)
 * 公开接口只返回白名单字段；所有字段均有默认值，库中无记录时前端直接用默认值。
 */

export interface SiteSettings {
  site_title: string; // 顶栏品牌名 / 页面标题
  nav_feeds_name: string; // 顶栏"动态"导航文字
  essay_tips: string; // 横幅小标签
  essay_title: string; // 横幅大标题
  essay_subtitle: string; // 横幅描述
  essay_button_text: string; // 横幅管理员按钮文字
  // 音乐
  music_enable: boolean; // 是否启用底部音乐播放器
  music_playlist_id: string; // 网易云歌单 ID
  music_custom_playlist: string; // 自定义歌单 JSON 链接（可选）
  music_autoplay: boolean; // 打开网页自动播放（浏览器可能拦截，拦截时回退手动）
  music_preload: boolean; // 页面加载后预解析第一首音源，点播放即时出声
  music_collapsed: boolean; // 初始折叠成球形
  music_volume: string; // 初始音量 0-1
  // 中央音乐服务（music-api）
  music_api_url: string; // 中央音乐解析服务地址（如 https://music-api.xxx.workers.dev）；留空=音乐库功能不可用
  music_api_key: string; // 中央音乐服务 ApiKey（私密，不公开）
  // 品牌 / 作者
  brand_avatar: string; // 顶栏品牌头像（仅图片 URL；空=lucide 占位图标）
  author_name: string; // 说说作者昵称（卡片头像 fallback 取首字符）
  author_avatar: string; // 说说作者头像（图片 URL；空=昵称首字符）
  post_avatar: string; // 文章卡片头像（仅图片 URL；空=lucide 占位图标）
  // 关于我页面（/about）
  about_enabled: boolean; // 是否启用关于我页面（顶栏入口与路由）
  links_enabled: boolean; // 是否启用友情链接（顶栏入口与路由）
  photos_enabled: boolean; // 是否启用相册入口（顶栏入口；相册功能本身一直在）
  links_categories: string; // 友链分类，每行一个（默认：技术/设计/生活随笔/摄影），后台可增删改
  about_greeting: string; // 顶部问候大标题（如「先认识一下，再慢慢读。」）
  about_greeting_sub: string; // 问候标题下方小字
  about_avatar: string; // 关于页大头像（图片 URL；空=用 author_avatar）
  about_signature: string; // 头像旁一句话签名
  about_bio: string; // 自我介绍正文（Markdown）
  about_stats: string; // 「一些数字」小卡片，每行：名称|数值|说明
  about_timeline: string; // 时间线，每行：日期|标题|描述
  about_bigstats: string; // 底部大数字统计，每行：数字|标签
  about_contacts: string; // 联系方式，每行：类型|值|链接
  about_qr_text: string; // 赞助卡说明文字
  about_qr_amounts: string; // 赞助金额按钮组，每行：金额|二维码URL（如 10元|https://.../10.png）；点击切换二维码
  // 导航
  nav_links: string; // 自定义导航项，每行一条：名称|链接
  // 横幅
  banner_button_url: string; // 横幅按钮链接（空=默认 发布/登录 行为）
  banner_button_target: string; // 横幅外链打开方式：_blank=新标签（默认），_self=当前标签
  banner_bg_image: string; // 横幅背景图 URL（后台上传或外链）
  banner_bg_mode: string; // 横幅背景模式：static=固定图（用 banner_bg_image），random=随机图源（走 /api/bg 缓存）
  banner_bg_source: string; // 随机图源 URL 模板，需含 {seed} 占位（默认 picsum）
  banner_bg_interval: string; // 随机图换图频率：多少小时换一张（数字字符串，默认 24=每天）
  site_bg_enabled: boolean; // 全站背景图开关（复用随机图源配置，玻璃拟态，后台/弹窗/正文除外）
  site_bg_mask: string; // 背景遮罩浓度 %（0-100，默认 68；压在图片上保证文字对比度）
  site_bg_card: string; // 玻璃卡片不透明度 %（0-100，默认 72）
  site_bg_footer: string; // 页脚不透明度 %（0-100，默认 20）
  site_bg_blur: string; // 毛玻璃模糊强度 px（0-40，默认 16）
  bg_version: string; // 背景图版本号（后台"换一张"时 +1，用于击穿浏览器/边缘缓存）
  // 页脚
  footer_text: string; // 页脚文案（支持 HTML）
  footer_run_since: string; // 网站运行起始时间 ISO 字符串，空=不显示运行时长
  // 主题
  theme_auto_mode: string; // 主题自动切换模式：off=关闭 / system=跟随系统 / time=按时间切换
  theme_dark_start: string; // 深色模式开始时间（小时，0-23），默认 18
  theme_dark_end: string; // 深色模式结束时间（小时，0-23），默认 6
  // 首页
  feed_page_size: string; // 首页时间线每页条数（1-50），超过后分页加载
  // 视频
  video_default_poster: string; // 统一视频封面 URL（说说/文章视频未单独设置封面时使用）
  // 域名
  site_domain: string; // 站点主域名（带 https://，如 https://jxe.me），用于 SEO/RSS/OG 绝对 URL；留空=用请求 origin
  r2_domain: string; // R2 自定义域名（带 https://，如 https://r2.e.jxe.me）；留空=走 Worker /media/ 代理
  // 存储管理
  storage_mode: string; // 上传存储：r2=Cloudflare R2（默认，旧文件继续在 R2） / b2=Backblaze B2（新上传走 B2）
  b2_endpoint: string; // B2 S3 兼容端点（带 https://，如 https://s3.us-west-004.backblazeb2.com）
  b2_bucket: string; // B2 桶名
  b2_key_id: string; // B2 Application Key ID（私密，不公开）
  b2_app_key: string; // B2 Application Key（私密，不公开）
  b2_domain: string; // B2 公开访问域名（带 https://，如 https://b2.e.jce.me）；B2 桶需设为公开
  // AI 评论机器人
  ai_reply_enabled: boolean; // 是否启用评论 @AI 自动回复（Workers AI，消耗每日免费额度）
  ai_bot_name: string; // 机器人昵称（评论中 @此昵称 触发回复），默认「小J」
  ai_bot_avatar: string; // 机器人头像：仅图片 URL；空=lucide bot 占位图标
  ai_text_model: string; // 自定义文本模型 ID（@cf/...）；留空=内置默认模型
  // QQ 昵称 API
  qq_nick_mode: string; // QQ 昵称获取方式：direct=腾讯直连 / apihz=apihz 接口 / fallback=逐个尝试（先腾讯后 apihz）
  apihz_id: string; // apihz 开发者 ID，留空=使用内置默认（88888888）
  apihz_key: string; // apihz 开发者 KEY，留空=使用内置默认（88888888）
  qq_nick_apis: string; // （已废弃，保留字段兼容旧数据）QQ 昵称 API 列表
  // 安全
  admin_path: string; // 后台秘密入口路径（/admin 或 /sys-xxxx），不通过公开 API 下发
  site_icon: string; // 站点图标（favicon）：仅图片 URL；空=默认 lucide 图标
  // 评论头像
  random_avatar_api: string; // 随机头像 API 列表，每行一条，支持 {imgtype} 占位；留空=内置 apihz 默认
  random_avatar_imgtype: string; // 随机头像类型 imgtype（apihz 0-16），默认 9=古风
  // QQ 昵称资料（Cookie 直连腾讯，凭证仅服务端使用）
  qq_ckqq: string; // 系统 QQ 号
  qq_skey: string; // 系统 QQ 的 skey
  qq_pskey: string; // 系统 QQ 的 pskey（p_skey）
  qq_keepalive_interval: string; // 保活间隔（小时），1-72，默认 6；Cron 定时用 Cookie 请求腾讯维持活跃
  // IndexNow 搜索推送
  indexnow_key: string; // IndexNow 密钥（去 Bing 站长平台生成）；空=未启用推送
  indexnow_endpoints: string; // 推送端点列表，每行一个 URL（默认含 Bing/统一入口/百度）
  indexnow_auto: boolean; // 发布/更新已发布文章时是否自动推送
  // 百度收录推送（独立 API，非 IndexNow）
  baidu_push_enabled: boolean; // 是否启用百度自动推送
  baidu_push_site: string; // 百度搜索资源平台的站点（如 jxe.me）
  baidu_push_token: string; // 百度推送 token（私密，不公开）
  // 评论表情包
  comment_emoji_owo_url: string; // 评论区 OwO 表情包 JSON 地址；默认站内 /owo.json（willow-god 包）
  // 打赏
  reward_enabled: boolean; // 是否在文章底部展示打赏卡片
  reward_qrcode: string; // 打赏收款二维码图片 URL
  reward_text: string; // 打赏引导文案
  // 访问统计
  analytics_enabled: boolean; // 是否启用访客访问统计（后台不计入）
  // 安全中心
  security_webhook_url: string; // 通知 webhook（飞书/钉钉/企业微信兼容），空=全部不推送
  notify_security: boolean; // Webhook 推送安全告警（攻击拦截、自动封禁）
  notify_comment: boolean; // Webhook 推送新评论
  notify_system: boolean; // Webhook 推送系统事件（宕机、QQ Cookie 失效等）
  auto_ban_enabled: boolean; // 是否启用自动封禁
  ban_threshold: string; // 同 IP 10 分钟高危命中 N 次触发封禁（1-100）
  ban_duration_hours: string; // 封禁时长（小时，1-720）
  // 评论互动（邮件通知 / 防刷）
  mail_enabled: boolean; // 是否启用邮件通知（需配置 Resend API Key）
  mail_resend_key: string; // Resend API Key（私密，不公开）
  mail_from: string; // 发件人邮箱（需在 Resend 验证的域名，如 notify@jxe.me）
  mail_admin_to: string; // 管理员收件邮箱（新评论通知）
  mail_notify_admin: boolean; // 新评论时是否通知管理员
  mail_reply_notify: boolean; // 是否允许评论者订阅「收到回复邮件通知」
  comment_rate_limit: string; // 同 IP 每分钟评论上限（1-100，默认 5）
  // 运维监控
  uptime_check_interval: string; // 可用性检测间隔（分钟，1-720，默认 5）
  // 友圈（/friends）
  friends_enabled: boolean; // 是否启用友圈功能（顶栏入口、/friends 页面、公开文章流 API；关闭后友链订阅配置保留）
  friends_fetch_enabled: boolean; // 是否启用 cron 定时抓取友站订阅源（每小时一轮）
  friends_quota_blog: string; // 博客池配额百分比（0-100，默认 60）
  friends_quota_community: string; // 社区池配额百分比（0-100，默认 30）
  friends_quota_tech: string; // 技术池配额百分比（0-100，默认 10）
  // 多语言（i18n）
  i18n_enabled: boolean; // 是否启用多语言（关闭后全站仅默认语言，顶栏切换器隐藏）
  i18n_default: string; // 默认语言：zh-CN | zh-TW | en
  i18n_langs: string; // 开放语言，逗号分隔（如 zh-CN,zh-TW,en）；至少包含默认语言
  i18n_auto_detect: boolean; // 首次访问是否按访问地/浏览器语言自动判定
  i18n_content_translate: boolean; // 是否自动翻译说说/文章等动态内容（P2，预留开关）
  baidu_translate_appid: string; // 百度翻译开放平台 APP ID（私密）；留空=英文翻译仅走 Workers AI
  baidu_translate_key: string; // 百度翻译密钥（私密）
}

export const DEFAULT_SETTINGS: SiteSettings = {
  site_title: "Jxe",
  nav_feeds_name: "首页",
  essay_tips: "Jxe · 轻博客",
  essay_title: "即刻",
  essay_subtitle: "记录生活中的每一个瞬间，图文、视频与心情",
  essay_button_text: "发布即刻",
  music_enable: false,
  music_playlist_id: "",
  music_custom_playlist: "",
  music_autoplay: false,
  music_preload: true,
  music_collapsed: false,
  music_volume: "0.7",
  music_api_url: "",
  music_api_key: "",
  brand_avatar: "",
  author_name: "Jxe",
  author_avatar: "",
  post_avatar: "",
  // 关于我（默认开启，带演示内容，可在后台「设置 - 关于我」修改）
  about_enabled: true,
  links_enabled: true,
  photos_enabled: true,
  links_categories: "技术\n设计\n生活随笔\n摄影",
  about_greeting: "先认识一下，再慢慢读。",
  about_greeting_sub: "记录生活中的每一个瞬间，图文、视频与心情。",
  about_avatar: "",
  about_signature: "一个热爱记录生活的普通人，写字、拍照、偶尔写点代码。",
  about_bio:
    "写了几年字，还在慢慢找自己的声音。\n\n" +
    "这里是我的小小角落，记录生活里那些值得停下的瞬间——可能是一段文字、一张照片、一首歌，或是某个忽然想说点什么的下午。\n\n" +
    "如果你也喜欢这样的节奏，欢迎常来坐坐。",
  about_stats:
    "坚持记录|多年|从开始写到现在\n" +
    "记录天数|持续|几乎每天都在更新\n" +
    "兴趣爱好|广泛|写字 拍照 音乐 代码",
  about_timeline:
    "2021|开始写博客|用文字记录生活的第一个节点\n" +
    "2023|第一次做独立站|从模板到自己动手，慢慢搭起这个小站\n" +
    "2025|上线轻博客 Moments|更专注于碎片化的日常记录",
  about_bigstats: "6|年记录\n120+|篇文字\n300+|张照片\n1000+|个瞬间",
  about_contacts:
    "GitHub|孤鸿剑尊|https://github.com/mliae\n" +
    "邮箱|hi@jxe.me|mailto:hi@jxe.me\n" +
    "RSS|订阅本站|/rss.xml",
  about_qr_text: "这里没有广告，全是一杯杯陈酿。扫码或留言，跟我打个招呼。",
  about_qr_amounts: "10元|请我喝杯咖啡\n30元|支持我继续写下去\n60元|加个鸡腿，再接再厉",
  nav_links: "",
  banner_button_url: "",
  banner_button_target: "_blank",
  banner_bg_image: "",
  banner_bg_mode: "static",
  banner_bg_source: "https://picsum.photos/seed/{seed}/1350/300",
  banner_bg_interval: "24",
  site_bg_enabled: false,
  site_bg_mask: "68",
  site_bg_card: "72",
  site_bg_footer: "20",
  site_bg_blur: "16",
  bg_version: "0",
  footer_text: "",
  footer_run_since: "",
  theme_auto_mode: "off",
  theme_dark_start: "18",
  theme_dark_end: "6",
  feed_page_size: "20",
  video_default_poster: "",
  site_domain: "",
  r2_domain: "",
  storage_mode: "r2",
  b2_endpoint: "",
  b2_bucket: "",
  b2_key_id: "",
  b2_app_key: "",
  b2_domain: "",
  ai_reply_enabled: false,
  ai_bot_name: "小J",
  ai_bot_avatar: "",
  ai_text_model: "",
  qq_nick_mode: "fallback",
  apihz_id: "",
  apihz_key: "",
  qq_nick_apis: "",
  admin_path: "/admin",
  site_icon: "",
  random_avatar_api:
    "https://cn.apihz.cn/api/img/apihzimgtx.php?id=88888888&key=88888888&type=1&imgtype={imgtype}",
  random_avatar_imgtype: "9",

  qq_ckqq: "",
  qq_skey: "",
  qq_pskey: "",
  qq_keepalive_interval: "6",
  indexnow_key: "",
  indexnow_endpoints:
    "https://api.indexnow.org/indexnow\n" +
    "https://www.bing.com/indexnow",
  indexnow_auto: true,
  baidu_push_enabled: false,
  baidu_push_site: "",
  baidu_push_token: "",
  comment_emoji_owo_url: "/owo.json",
  analytics_enabled: true,
  reward_enabled: false,
  reward_qrcode: "",
  reward_text: "如果觉得这篇文章不错，欢迎打赏支持一下 ~",
  security_webhook_url: "",
  notify_security: true,
  notify_comment: true,
  notify_system: true,
  auto_ban_enabled: true,
  ban_threshold: "5",
  ban_duration_hours: "24",
  mail_enabled: false,
  mail_resend_key: "",
  mail_from: "",
  mail_admin_to: "",
  mail_notify_admin: true,
  mail_reply_notify: true,
  comment_rate_limit: "5",
  uptime_check_interval: "5",
  friends_enabled: true,
  friends_fetch_enabled: true,
  friends_quota_blog: "60",
  friends_quota_community: "30",
  friends_quota_tech: "10",
  i18n_enabled: false,
  i18n_default: "zh-CN",
  i18n_langs: "zh-CN,zh-TW,en",
  i18n_auto_detect: true,
  i18n_content_translate: true,
  baidu_translate_appid: "",
  baidu_translate_key: "",
};

/** 字符串字段约束：最大长度 */
const STRING_LIMITS: Partial<Record<keyof SiteSettings, number>> = {
  site_title: 40,
  nav_feeds_name: 12,
  essay_tips: 60,
  essay_title: 40,
  essay_subtitle: 200,
  essay_button_text: 20,
  music_playlist_id: 32,
  music_custom_playlist: 500,
  music_volume: 4,
  music_api_url: 200,
  music_api_key: 64,
  brand_avatar: 200,
  author_name: 32,
  author_avatar: 200,
  post_avatar: 200,
  about_greeting: 60,
  about_greeting_sub: 200,
  about_avatar: 300,
  about_signature: 200,
  about_bio: 5000,
  about_stats: 1000,
  about_timeline: 2000,
  about_bigstats: 500,
  about_contacts: 1000,
  about_qr_text: 300,
  about_qr_amounts: 1000,
  links_categories: 500,
  nav_links: 1000,
  banner_button_url: 500,
  banner_button_target: 10,
  banner_bg_image: 500,
  banner_bg_mode: 10,
  banner_bg_source: 500,
  banner_bg_interval: 4,
  site_bg_mask: 3,
  site_bg_card: 3,
  site_bg_footer: 3,
  site_bg_blur: 3,
  bg_version: 8,
  footer_text: 2000,
  footer_run_since: 40,
  theme_auto_mode: 10,
  theme_dark_start: 2,
  theme_dark_end: 2,
  feed_page_size: 3,
  video_default_poster: 500,
  site_domain: 200,
  r2_domain: 200,
  storage_mode: 10,
  b2_endpoint: 200,
  b2_bucket: 100,
  b2_key_id: 100,
  b2_app_key: 200,
  b2_domain: 200,
  ai_bot_name: 20,
  ai_bot_avatar: 200,
  ai_text_model: 100,
  qq_nick_mode: 10,
  apihz_id: 20,
  apihz_key: 100,
  qq_nick_apis: 2000,
  admin_path: 40,
  site_icon: 300,
  random_avatar_api: 2000,
  random_avatar_imgtype: 2,
  qq_ckqq: 20,
  qq_skey: 200,
  qq_pskey: 256,
  qq_keepalive_interval: 3,
  indexnow_key: 128,
  indexnow_endpoints: 1500,
  baidu_push_site: 100,
  baidu_push_token: 64,
  comment_emoji_owo_url: 500,
  security_webhook_url: 500,
  ban_threshold: 3,
  ban_duration_hours: 4,
  mail_resend_key: 128,
  mail_from: 200,
  mail_admin_to: 200,
  comment_rate_limit: 3,
  reward_qrcode: 500,
  reward_text: 300,
  uptime_check_interval: 3,
  friends_quota_blog: 3,
  friends_quota_community: 3,
  friends_quota_tech: 3,
  i18n_default: 10,
  i18n_langs: 40,
  baidu_translate_appid: 32,
  baidu_translate_key: 64,
};

/**
 * 校验后台入口路径：默认 /admin，或任意单段秘密路径（如 /my-secret）。
 * 任意路径的硬加载由 wrangler.jsonc run_worker_first 的 /* 兜底到 Worker，
 * 在 index.ts notFound 中比对 admin_path 后注入 SSR 信号。
 */
export function normalizeAdminPath(raw: unknown): string | null {
  const v = String(raw ?? "").trim().slice(0, 40);
  if (v === "/admin") return v;
  // 允许任意单段路径：/ 开头 + 3-39 位字母数字短横线（如 /my-secret、/control-panel）
  if (/^\/[a-z0-9][a-z0-9-]{2,38}$/i.test(v)) return v.toLowerCase();
  return null;
}

/** 布尔字段 */
const BOOLEAN_KEYS: (keyof SiteSettings)[] = [
  "music_enable",
  "music_autoplay",
  "music_preload",
  "music_collapsed",
  "ai_reply_enabled",
  "about_enabled",
  "links_enabled",
  "photos_enabled",
  "indexnow_auto",
  "baidu_push_enabled",
  "analytics_enabled",
  "auto_ban_enabled",
  "notify_security",
  "notify_comment",
  "notify_system",
  "mail_enabled",
  "mail_notify_admin",
  "mail_reply_notify",
  "reward_enabled",
  "site_bg_enabled",
  "i18n_enabled",
  "i18n_auto_detect",
  "i18n_content_translate",
  "friends_enabled",
  "friends_fetch_enabled",
];

export function clampSetting(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function toBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") return value === "1" || value.toLowerCase() === "true";
  return false;
}

/** 任意输入 → 安全的设置对象（空串回退默认值，防止前台显示空白） */
export function normalizeSettings(raw: Record<string, unknown> | null | undefined): SiteSettings {
  const out: SiteSettings = { ...DEFAULT_SETTINGS };
  if (!raw) return out;
  (Object.keys(DEFAULT_SETTINGS) as (keyof SiteSettings)[]).forEach(key => {
    if (BOOLEAN_KEYS.includes(key)) {
      // 布尔字段：未提供时保留默认
      if (raw[key] !== undefined) out[key] = toBool(raw[key]) as never;
      return;
    }
    const max = STRING_LIMITS[key] ?? 0;
    const v = clampSetting(raw[key], max);
    if (v) out[key] = v as never;
  });
  // 音量：数值范围 0-1，非法回退默认
  const vol = parseFloat(out.music_volume);
  out.music_volume = Number.isFinite(vol)
    ? String(Math.max(0, Math.min(1, vol)))
    : DEFAULT_SETTINGS.music_volume;
  // 首页每页条数：1-50，非法回退默认
  const fps = parseInt(out.feed_page_size, 10);
  out.feed_page_size = Number.isFinite(fps)
    ? String(Math.max(1, Math.min(50, fps)))
    : DEFAULT_SETTINGS.feed_page_size;
  // 随机背景换图频率（小时）：1-720，非法回退默认
  const bi = parseInt(out.banner_bg_interval, 10);
  out.banner_bg_interval = Number.isFinite(bi)
    ? String(Math.max(1, Math.min(720, bi)))
    : DEFAULT_SETTINGS.banner_bg_interval;
  // 全站背景玻璃参数：百分比 0-100、模糊 0-40px，非法回退默认
  const clampBg = (v: string, min: number, max: number, dft: string): string => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? String(Math.max(min, Math.min(max, n))) : dft;
  };
  out.site_bg_mask = clampBg(out.site_bg_mask, 0, 100, DEFAULT_SETTINGS.site_bg_mask);
  out.site_bg_card = clampBg(out.site_bg_card, 0, 100, DEFAULT_SETTINGS.site_bg_card);
  out.site_bg_footer = clampBg(out.site_bg_footer, 0, 100, DEFAULT_SETTINGS.site_bg_footer);
  out.site_bg_blur = clampBg(out.site_bg_blur, 0, 40, DEFAULT_SETTINGS.site_bg_blur);
  // QQ Cookie 保活间隔（小时）：1-72，非法回退默认
  const ka = parseInt(out.qq_keepalive_interval, 10);
  out.qq_keepalive_interval = Number.isFinite(ka)
    ? String(Math.max(1, Math.min(72, ka)))
    : DEFAULT_SETTINGS.qq_keepalive_interval;
  // 自动封禁阈值（次/10分钟）：1-100，非法回退默认
  const bt = parseInt(out.ban_threshold, 10);
  out.ban_threshold = Number.isFinite(bt)
    ? String(Math.max(1, Math.min(100, bt)))
    : DEFAULT_SETTINGS.ban_threshold;
  // 封禁时长（小时）：1-720，非法回退默认
  const bd = parseInt(out.ban_duration_hours, 10);
  out.ban_duration_hours = Number.isFinite(bd)
    ? String(Math.max(1, Math.min(720, bd)))
    : DEFAULT_SETTINGS.ban_duration_hours;
  // 评论频控（次/分钟）：1-100，非法回退默认
  const cr = parseInt(out.comment_rate_limit, 10);
  out.comment_rate_limit = Number.isFinite(cr)
    ? String(Math.max(1, Math.min(100, cr)))
    : DEFAULT_SETTINGS.comment_rate_limit;
  // 可用性检测间隔（分钟）：1-720，非法回退默认
  const ui = parseInt(out.uptime_check_interval, 10);
  out.uptime_check_interval = Number.isFinite(ui)
    ? String(Math.max(1, Math.min(720, ui)))
    : DEFAULT_SETTINGS.uptime_check_interval;
  // 友圈配额：0-100 整数，非法回退默认（总和不要求=100，交错算法按权重归一）
  const clampQuota = (v: string, dft: string): string => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? String(Math.max(0, Math.min(100, n))) : dft;
  };
  out.friends_quota_blog = clampQuota(out.friends_quota_blog, DEFAULT_SETTINGS.friends_quota_blog);
  out.friends_quota_community = clampQuota(out.friends_quota_community, DEFAULT_SETTINGS.friends_quota_community);
  out.friends_quota_tech = clampQuota(out.friends_quota_tech, DEFAULT_SETTINGS.friends_quota_tech);
  if (out.banner_bg_mode !== "static" && out.banner_bg_mode !== "random") out.banner_bg_mode = DEFAULT_SETTINGS.banner_bg_mode;
  // 存储模式：r2=Cloudflare R2 / b2=Backblaze B2，非法回退默认
  if (out.storage_mode !== "r2" && out.storage_mode !== "b2") out.storage_mode = DEFAULT_SETTINGS.storage_mode;
  // B2 端点/域名：自动补 https:// 前缀（防手滑漏写导致 Invalid URL）；B2 域名误填占位提示文字时视为未填
  const b2ep = out.b2_endpoint.trim();
  if (b2ep && !/^https?:\/\//i.test(b2ep)) out.b2_endpoint = "https://" + b2ep;
  const b2dm = out.b2_domain.trim();
  if (!b2dm || /^[^ ]*[（(]私有桶/.test(b2dm)) out.b2_domain = "";
  // 多语言：默认语言/开放语言白名单校验，非法回退默认；保证默认语言一定在开放列表中
  const I18N_SUPPORTED = ["zh-CN", "zh-TW", "en"];
  if (!I18N_SUPPORTED.includes(out.i18n_default)) out.i18n_default = DEFAULT_SETTINGS.i18n_default;
  const langs = out.i18n_langs
    .split(",")
    .map(x => x.trim())
    .filter(x => I18N_SUPPORTED.includes(x));
  const langSet = Array.from(new Set(langs.length ? langs : [DEFAULT_SETTINGS.i18n_default]));
  if (!langSet.includes(out.i18n_default)) langSet.unshift(out.i18n_default);
  out.i18n_langs = langSet.join(",");
  return out;
}

export async function getSettings(db: D1Database): Promise<SiteSettings> {
  const row = await db
    .prepare(`SELECT data FROM site_config WHERE id = 1`)
    .first<{ data: string }>();
  if (!row) return { ...DEFAULT_SETTINGS };
  try {
    return normalizeSettings(JSON.parse(row.data) as Record<string, unknown>);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** 合并 patch 后 UPSERT，返回规范化后的完整设置 */
export async function updateSettings(
  db: D1Database,
  patch: Record<string, unknown>
): Promise<SiteSettings> {
  const current = await getSettings(db);
  const next: Record<string, unknown> = { ...current };
  (Object.keys(DEFAULT_SETTINGS) as (keyof SiteSettings)[]).forEach(key => {
    if (patch[key] === undefined) return;
    if (BOOLEAN_KEYS.includes(key)) {
      next[key] = toBool(patch[key]);
      return;
    }
    const max = STRING_LIMITS[key] ?? 0;
    const v = clampSetting(patch[key], max);
    // 空串视为"恢复默认"，而非保留旧值
    next[key] = v || DEFAULT_SETTINGS[key];
  });
  const normalized = normalizeSettings(next as Record<string, unknown>);
  await db
    .prepare(
      `INSERT INTO site_config (id, data, updated_at)
       VALUES (1, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
       ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
    )
    .bind(JSON.stringify(normalized))
    .run();
  return normalized;
}
