/* global marked, Hls, Artplayer */
/* eslint-disable */
/* build 20260921f */
/**
 * moments 前端（原生 JS，无构建）
 * BannerCard + 瀑布流 bber 卡片（>=1200 三列 / >=768 两列 / 其余一列，列间距 16px）
 * History API 路由：/ 首页 ｜ /posts 文章列表 ｜ /post/:slug 文章详情 ｜ /photos 相册 ｜ /admin 后台
 * （旧 hash 链接 #/... 自动重定向到真实路径）
 */
(function () {
  "use strict";

  const app = document.getElementById("app");
  const adminArea = document.getElementById("adminArea");
  const modalRoot = document.getElementById("modalRoot");
  const lightboxRoot = document.getElementById("lightboxRoot");
  const themeToggle = document.getElementById("themeToggle");
  const fabPublish = document.getElementById("fabPublish");

  const GAP = 16;
  const LAYOUT_TIMEOUT = 1000;
  /** i18n 取词代理（词典与状态在 i18n.js，该脚本先于 app.js 加载） */
  const t = (key, vars) => (window.I18N ? window.I18N.t(key, vars) : key);
  /** 首页每页条数：读后台设置（1-50），非法回退 20 */
  function feedPageSize() {
    const n = Number(state.settings.feed_page_size);
    return Number.isFinite(n) && n >= 1 ? Math.min(50, Math.floor(n)) : 20;
  }
  /** 分页条 HTML（pages<=1 不显示） */
  function pagerHtml(page, pages) {
    if (pages <= 1) return "";
    return `<div class="pager">
      <button type="button" class="btn" data-pager="prev"${page <= 1 ? " disabled" : ""}>${t("common.prev_page")}</button>
      <span class="pager-info">${t("common.page_info", { page, pages })}</span>
      <button type="button" class="btn" data-pager="next"${page >= pages ? " disabled" : ""}>${t("common.next_page")}</button>
    </div>`;
  }

  // 与后端 DEFAULT_SETTINGS 保持一致的前端兜底
  const DEFAULT_SETTINGS = {
    site_title: "Moments",
    nav_feeds_name: "首页",
    essay_tips: "Moments · 轻博客",
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
    brand_avatar: "",
    author_name: "Moments",
    author_avatar: "",
    post_avatar: "",
    about_enabled: true,
    links_enabled: true,
    photos_enabled: true,
    friends_enabled: true,
    links_categories: "技术\n设计\n生活随笔\n摄影",
    about_greeting: "先认识一下，再慢慢读。",
    about_greeting_sub: "记录生活中的每一个瞬间，图文、视频与心情。",
    about_avatar: "",
    about_signature: "一个热爱记录生活的普通人，写字、拍照、偶尔写点代码。",
    about_bio:
      "写了几年字，还在慢慢找自己的声音。\n\n" +
      "这里是我的小小角落，记录生活里那些值得停下的瞬间——可能是一段文字、一张照片、一首歌，或是某个忽然想说点什么的下午。\n\n" +
      "如果你也喜欢这样的节奏，欢迎常来坐坐。",
    about_stats: "坚持记录|多年|从开始写到现在\n记录天数|持续|几乎每天都在更新\n兴趣爱好|广泛|写字 拍照 音乐 代码",
    about_timeline:
      "2021|开始写博客|用文字记录生活的第一个节点\n" +
      "2023|第一次做独立站|从模板到自己动手，慢慢搭起这个小站\n" +
      "2025|上线轻博客 Moments|更专注于碎片化的日常记录",
    about_bigstats: "6|年记录\n120+|篇文字\n300+|张照片\n1000+|个瞬间",
    about_contacts:
      "GitHub|孤鸿剑尊|https://github.com/mliae\n邮箱|hi@jxe.me|mailto:hi@jxe.me\nRSS|订阅本站|/rss.xml",
  about_qr_text: "这里没有广告，全是一杯杯陈酿。扫码或留言，跟我打个招呼。",
  about_qr_amounts: "10元|请我喝杯咖啡\n30元|支持我继续写下去\n60元|加个鸡腿，再接再厉",
    nav_links: "",
    banner_button_url: "",
    banner_button_target: "_blank",
    banner_bg_image: "",
    site_bg_enabled: false,
    site_bg_mask: "68",
    site_bg_card: "72",
    site_bg_footer: "20",
    site_bg_blur: "16",
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
    site_icon: "",
  comment_emoji_owo_url: "/owo.json",
  i18n_enabled: false,
  i18n_default: "zh-CN",
  i18n_langs: "zh-CN,zh-TW,en",
  i18n_auto_detect: true,
  i18n_content_translate: true,
  baidu_translate_appid: "",
  baidu_translate_key: "",
  };

  const state = {
    admin: false,
    // 后台秘密入口路径（仅本机缓存；未登录时公开 API 不返回）
    adminPath: localStorage.getItem("moments_admin_path") || "/admin",
    voterId: getVoterId(),
    activeView: "", // 当前路由视图，防止快速切换时旧请求覆盖新页面
    feed: [],
    cursor: null,
    feedDone: false,
    feedLoading: false,
    commentTarget: null,
    settings: { ...DEFAULT_SETTINGS },
    adminTab: "overview",
    adminData: { moments: [], posts: [], comments: [] },
    music: {
      playlist: [],
      currentIndex: -1,
      isPlaying: false,
      isLoading: false,
      volume: 0.7,
      muted: false,
      playMode: (() => {
        // 播放模式：list 列表循环 / random 随机播放 / one 单曲循环（持久化）
        const m = localStorage.getItem("moments_playmode");
        return m === "random" || m === "one" ? m : "list";
      })(),
    },
  };

  marked.setOptions({ gfm: true, breaks: true });

  // 块级自定义占位（移植自 Jxe marked-extensions，文章/说说通用）
  marked.use({
    extensions: [
      {
        name: "musicIdBlock",
        level: "block",
        start(src) {
          return src.match(/^\[music=t?\d+\]/im)?.index;
        },
        tokenizer(src) {
          const m = src.match(/^\[music=(t?\d+)\][^\n\r]*(?:\r?\n|$)/i);
          if (!m) return undefined;
          return { type: "musicIdBlock", raw: m[0], songId: m[1] };
        },
        renderer(token) {
          const id = String(token.songId || "").replace(/[^t\d]/g, "");
          return `<div class="music-block-card" data-song-id="${id}"><div class="mcc-skeleton"><span class="spinner"></span>${t("music.loading")}</div></div>`;
        },
      },
      {
        // 块级视频：@[video](url) 或 @[video](url "封面URL")，仅允许 http(s)/站内路径
        name: "videoBlock",
        level: "block",
        start(src) {
          return src.match(/^@\[video\]/im)?.index;
        },
        tokenizer(src) {
          const m = src.match(/^@\[video\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/);
          if (!m) return undefined;
          if (!/^(?:https?:\/\/|\/)/i.test(m[1])) return undefined;
          return { type: "videoBlock", raw: m[0], url: m[1].replace(/"/g, ""), poster: m[2] || "" };
        },
        renderer(token) {
          const url = String(token.url || "");
          const emb = parseEmbedUrl(url);
          if (emb) return `<div class="article-video">${embedBoxHtml(emb)}</div>`;
          const poster = resolveVideoPoster(token.poster);
          const posterAttr = poster ? ` poster="${esc(poster)}"` : "";
          const cls = /\.m3u8(?:[?#]|$)/i.test(url) ? "essay-media-video essay-media-video--hls" : "essay-media-video";
          const hlsAttrs = /\.m3u8(?:[?#]|$)/i.test(url) ? ` data-hls-src="${esc(url)}"` : ` src="${esc(url)}"`;
          return `<div class="article-video"><video class="${cls}"${hlsAttrs}${posterAttr} controls preload="none" playsinline></video></div>`;
        },
      },
      {
        // 行内高亮：==文字==
        name: "markInline",
        level: "inline",
        start(src) {
          return src.indexOf("==");
        },
        tokenizer(src) {
          const m = /^==([^=\n][^\n]*?)==/.exec(src);
          if (!m) return undefined;
          return { type: "markInline", raw: m[0], tokens: this.lexer.inlineTokens(m[1]) };
        },
        renderer(token) {
          return `<mark>${this.parser.parseInline(token.tokens)}</mark>`;
        },
      },
      {
        // 居中块：:::center 与 ::: 之间的内容整体居中（文章/说说通用）
        name: "centerBlock",
        level: "block",
        start(src) {
          return src.match(/^:::center\s*$/m)?.index;
        },
        tokenizer(src) {
          const m = src.match(/^:::center[ \t]*\r?\n([\s\S]*?)\r?\n:::[ \t]*(?:\r?\n|$)/);
          if (!m) return undefined;
          return { type: "centerBlock", raw: m[0], tokens: this.lexer.blockTokens(m[1]) };
        },
        renderer(token) {
          return `<div class="text-center">${this.parser.parse(token.tokens)}</div>`;
        },
      },
    ],
  });

  /* ================= 图标（iconify 内嵌） ================= */

  const ICONS = {
    clock: { vb: "0 0 384 512", d: "M256 0a256 256 0 1 1 0 512a256 256 0 1 1 0-512m-24 120v136c0 8 4 15.5 10.7 20l96 64c11 7.4 25.9 4.4 33.3-6.7s4.4-25.9-6.7-33.3L280 243.2V120c0-13.3-10.7-24-24-24s-24 10.7-24 24" },
    locationDot: { vb: "0 0 384 512", d: "M215.7 499.2C267 435 384 279.4 384 192C384 86 298 0 192 0S0 86 0 192c0 87.4 117 243 168.3 307.2c12.3 15.3 35.1 15.3 47.4 0M192 128a64 64 0 1 1 0 128a64 64 0 1 1 0-128" },
    heartFill: { vb: "0 0 512 512", d: "m47.6 300.4l180.7 168.7c7.5 7 17.4 10.9 27.7 10.9s20.2-3.9 27.7-10.9l180.7-168.7c30.4-28.3 47.6-68 47.6-109.5v-5.8c0-69.9-50.5-129.5-119.4-141c-45.6-7.6-92 7.3-124.6 39.9l-12 12l-12-12c-32.6-32.6-79-47.5-124.6-39.9C50.5 55.6 0 115.2 0 185.1v5.8c0 41.5 17.2 81.2 47.6 109.5" },
    heartLine: { vb: "0 0 512 512", d: "m225.8 468.2l-2.5-2.3L48.1 303.2C17.4 274.7 0 234.7 0 192.8v-3.3c0-70.4 50-130.8 119.2-144c39.4-7.6 79.7 1.5 111.8 24.1c9 6.4 17.4 13.8 25 22.3c4.2-4.8 8.7-9.2 13.5-13.3c3.7-3.2 7.5-6.2 11.5-9c32.1-22.6 72.4-31.7 111.8-24.2C462 58.6 512 119.1 512 189.5v3.3c0 41.9-17.4 81.9-48.1 110.4L288.7 465.9l-2.5 2.3c-8.2 7.6-19 11.9-30.2 11.9s-22-4.2-30.2-11.9M239.1 145c-.4-.3-.7-.7-1-1.1l-17.8-20l-.1-.1c-23.1-25.9-58-37.7-92-31.2c-46.6 8.9-80.2 49.5-80.2 96.9v3.3c0 28.5 11.9 55.8 32.8 75.2L256 430.7L431.2 268a102.7 102.7 0 0 0 32.8-75.2v-3.3c0-47.3-33.6-88-80.1-96.9c-34-6.5-69 5.4-92 31.2l-.1.1l-.1.1l-17.8 20c-.3.4-.7.7-1 1.1c-4.5 4.5-10.6 7-16.9 7s-12.4-2.5-16.9-7z" },
    chat: { vb: "0 0 24 24", d: "M10 3h4a8 8 0 1 1 0 16v3.5c-5-2-12-5-12-11.5a8 8 0 0 1 8-8" },
    plus: { vb: "0 0 448 512", d: "M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32v144H48c-17.7 0-32 14.3-32 32s14.3 32 32 32h144v144c0 17.7 14.3 32 32 32s32-14.3 32-32V288h144c17.7 0 32-14.3 32-32s-14.3-32-32-32H256z" },
    chevronLeft: { vb: "0 0 320 512", d: "M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l192 192c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256L246.6 86.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-192 192z" },
    chevronRight: { vb: "0 0 320 512", d: "M310.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L242.7 256L73.4 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z" },
    anglesRight: { vb: "0 0 512 512", d: "M470.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L402.7 256L265.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160zm-352 160l160-160c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L210.7 256L73.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0z" },
    moon: { vb: "0 0 384 512", d: "M223.5 32C100 32 0 132.3 0 256s100 224 223.5 224c60.6 0 115.5-24.2 155.8-63.4c5-4.9 6.3-12.5 3.1-18.7s-10.1-9.7-17-8.5c-9.8 1.7-19.8 2.6-30.1 2.6c-96.9 0-175.5-78.8-175.5-176c0-65.8 36-123.1 89.3-153.3c6.1-3.5 9.2-10.5 7.7-17.3s-7.3-11.9-14.3-12.5c-6.3-.5-12.6-.8-19-.8z" },
    sun: { vb: "0 0 512 512", d: "M361.5 1.2c5 2.1 8.6 6.6 9.6 11.9L391 121l107.9 19.8c5.3 1 9.8 4.6 11.9 9.6s1.5 10.7-1.6 15.2L446.9 256l62.3 90.3c3.1 4.5 3.7 10.2 1.6 15.2s-6.6 8.6-11.9 9.6L391 391l-19.9 107.9c-1 5.3-4.6 9.8-9.6 11.9s-10.7 1.5-15.2-1.6L256 446.9l-90.3 62.3c-4.5 3.1-10.2 3.7-15.2 1.6s-8.6-6.6-9.6-11.9L121 391L13.1 371.1c-5.3-1-9.8-4.6-11.9-9.6s-1.5-10.7 1.6-15.2L65.1 256L2.8 165.7c-3.1-4.5-3.7-10.2-1.6-15.2s6.6-8.6 11.9-9.6L121 121l19.9-107.9c1-5.3 4.6-9.8 9.6-11.9s10.7-1.5 15.2 1.6L256 65.1l90.3-62.3c4.5-3.1 10.2-3.7 15.2-1.6M160 256a96 96 0 1 1 192 0a96 96 0 1 1-192 0m224 0a128 128 0 1 0-256 0a128 128 0 1 0 256 0" },
    compass: { vb: "0 0 512 512", d: "M256 512a256 256 0 1 0 0-512a256 256 0 1 0 0 512m50.7-186.9l-144.3 55.5c-19.4 7.5-38.5-11.6-31-31l55.5-144.3c3.3-8.5 9.9-15.1 18.4-18.4l144.3-55.5c19.4-7.5 38.5 11.6 31 31l-55.5 144.3c-3.2 8.5-9.9 15.1-18.4 18.4M288 256a32 32 0 1 0-64 0a32 32 0 1 0 64 0" },
    arrowUpRight: { vb: "0 0 24 24", d: "M13.828 7.172a.997.997 0 0 0-1-1h-6a1 1 0 1 0 0 2h3.586l-3.95 3.95a1 1 0 0 0 1.415 1.414l3.95-3.95v3.586a1 1 0 0 0 2 0v-6zM10 20C4.477 20 0 15.523 0 10S4.477 0 10 0s10 4.477 10 10s-4.477 10-10 10" },
    trash: { vb: "0 0 448 512", d: "M135.2 17.7C140.6 6.8 151.7 0 163.8 0h120.4c12.1 0 23.2 6.8 28.6 17.7L320 32h96c17.7 0 32 14.3 32 32s-14.3 32-32 32H32C14.3 96 0 81.7 0 64s14.3-32 32-32h96zM32 128h384v320c0 35.3-28.7 64-64 64H96c-35.3 0-64-28.7-64-64zm96 64c-8.8 0-16 7.2-16 16v224c0 8.8 7.2 16 16 16s16-7.2 16-16V208c0-8.8-7.2-16-16-16m96 0c-8.8 0-16 7.2-16 16v224c0 8.8 7.2 16 16 16s16-7.2 16-16V208c0-8.8-7.2-16-16-16m96 0c-8.8 0-16 7.2-16 16v224c0 8.8 7.2 16 16 16s16-7.2 16-16V208c0-8.8-7.2-16-16-16" },
    /* —— 以下为 lucide 线性图标（多元素 path），用 stroke 字段；svgIcon 据此渲染描边风格 —— */
    globe: { stroke: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>' },
    home: { stroke: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' },
    "layout-dashboard": { stroke: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>' },
    "bar-chart-3": { stroke: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>' },
    "message-circle": { stroke: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>' },
    "message-square": { stroke: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' },
    "file-text": { stroke: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>' },
    image: { stroke: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>' },
    palette: { stroke: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>' },
    folder: { stroke: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>' },
    bot: { stroke: '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>' },
    shield: { stroke: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>' },
    "pen-nib": { stroke: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>' },
    search: { stroke: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>' },
    smile: { stroke: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>' },
    heart: { stroke: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>' },
    "thumbs-up": { stroke: '<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>' },
    star: { stroke: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>' },
    "party-popper": { stroke: '<path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17"/><path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7"/><path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z"/>' },
    flame: { stroke: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>' },
    coffee: { stroke: '<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>' },
    sunLine: { stroke: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>' },
    sparkles: { stroke: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>' },
    music: { stroke: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>' },
    "list-music": { stroke: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 9h6"/><path d="M9 13h6"/><path d="M9 17h4"/><circle cx="17.5" cy="17.5" r="1.5" fill="currentColor" stroke="none"/>' },
    dices: { stroke: '<rect width="12" height="12" x="2" y="10" rx="2" ry="2"/><path d="m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6"/><path d="M6 18h.01"/><path d="M10 14h.01"/><path d="M15 6h.01"/><path d="M18 9h.01"/>' },
    lock: { stroke: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>' },
    menu: { stroke: '<line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/>' },
    "triangle-alert": { stroke: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>' },
    gift: { stroke: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>' },
    /* —— 关于我页面用到的图标 —— */
    quote: { stroke: '<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>' },
    "chevron-right": { stroke: '<path d="m9 18 6-6-6-6"/>' },
    github: { stroke: '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>' },
    mail: { stroke: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>' },
    rss: { stroke: '<path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/>' },
    "at-sign": { stroke: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>' },
    send: { stroke: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>' },
    link: { stroke: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>' },
    /* —— 友情链接页面用到的图标 —— */
    "arrow-up-right": { stroke: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>' },
    "arrow-right": { stroke: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>' },
    "scroll-text": { stroke: '<path d="M15 12h-5"/><path d="M15 8h-5"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/>' },
    info: { stroke: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>' },
    check: { stroke: '<path d="M20 6 9 17l-5-5"/>' },
    "circle-user": { stroke: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/>' },
    pin: { stroke: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>' },
    /* —— 后台运维看板用到的图标 —— */
    activity: { stroke: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>' },
    timer: { stroke: '<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>' },
    "heart-pulse": { stroke: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>' },
    "calendar-check": { stroke: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>' },
    "alert-triangle": { stroke: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>' },
    zap: { stroke: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>' },
    "refresh-cw": { stroke: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>' },
    download: { stroke: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>' },
    radio: { stroke: '<circle cx="12" cy="12" r="2"/><path d="M4.93 19.07a10 10 0 0 1 0-14.14"/><path d="M7.76 16.24a6 6 0 0 1 0-8.49"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>' },
    list: { stroke: '<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>' },
    upload: { stroke: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>' },
    "rotate-ccw": { stroke: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>' },
    x: { stroke: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>' },
    settings: { stroke: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>' },
  };

  function svgIcon(name, size) {
    const ic = ICONS[name];
    if (!ic) return "";
    const s = size || 16;
    // flex 布局中禁止图标被压缩变形（文案过长时保持图标原始宽高）
    const noShrink = ' style="flex:none;flex-shrink:0"';
    // stroke 字段：lucide 描边风（多元素 path，24 viewBox）
    if (ic.stroke) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${noShrink}>${ic.stroke}</svg>`;
    }
    // { vb, d }：FontAwesome 填充风（兼容原有图标）
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ic.vb}" width="${s}" height="${s}" fill="currentColor"${noShrink}><path fill="currentColor" d="${ic.d}"/></svg>`;
  }

  /* ================= 工具 ================= */

  function getVoterId() {
    let v = localStorage.getItem("moments_voter");
    if (!v) {
      v = (crypto.randomUUID && crypto.randomUUID()) || "v-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("moments_voter", v);
    }
    return v;
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /** 评论头像加载失败兜底：替换为昵称首字圆形占位（对象已删除/外链失效时避免裂图） */
  window.commentAvatarFail = function (el) {
    const isAdmin = String(el.className || "").indexOf("admin-cmt-avatar") >= 0;
    const span = document.createElement("span");
    span.className = isAdmin ? "admin-cmt-avatar admin-cmt-avatar-txt" : "comment-avatar";
    span.textContent = (el.dataset.n || "?").slice(0, 1).toUpperCase();
    el.replaceWith(span);
  };

  /** 相对时间（与原站 formatRelativeTime 一致） */
  function timeAgo(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "";
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    if (seconds < 60) return t("common.just_now");
    if (minutes < 60) return t("common.min_ago", { n: minutes });
    if (hours < 24) return t("common.hour_ago", { n: hours });
    if (days < 30) return t("common.day_ago", { n: days });
    if (months < 12) return t("common.month_ago", { n: months });
    return t("common.year_ago", { n: years });
  }

  /** 精确到分钟：今天显示 HH:mm，否则 MM-DD HH:mm（运维看板用） */
  function fmtDT(dateString) {
    if (!dateString) return "";
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return "";
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    if (sameDay) return `今天 ${hm}`;
    const y = d.getFullYear() !== now.getFullYear() ? `${d.getFullYear()}-` : "";
    return `${y}${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${hm}`;
  }

  /** 从 markdown 内容提取纯文本摘要 */
  function plainText(content, maxLen) {
    const text = String(content || "")
      .replace(/\[music=\d+\]/gi, "")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/[#*`>~_]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
  }

  let toastTimer = null;
  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 2400);
  }

  async function api(path, options = {}) {
    // 携带 body/form 时若未显式指定方法，默认 POST（GET/HEAD 不允许有 body）
    const inferredMethod = options.body !== undefined || options.form ? "POST" : "GET";
    const opts = { method: options.method || inferredMethod, headers: {}, credentials: "same-origin" };
    if (options.form) {
      opts.body = options.form;
    } else if (options.body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(options.body);
    }
    // 15s 超时保护（防止 Workers CPU 超限导致连接挂起）
    const ac = new AbortController();
    const tid = setTimeout(() => ac.abort(), 15000);
    try {
      const res = await fetch(path, { ...opts, signal: ac.signal });
      clearTimeout(tid);
      let json = null;
      try {
        json = await res.json();
      } catch (_) {}
      if (!res.ok || !json || json.code !== 200) {
        const err = new Error((json && json.message) || t("common.request_error_status", { status: res.status }));
        err.status = res.status;
        throw err;
      }
      return json.data;
    } catch (e) {
      clearTimeout(tid);
      if (e.name === "AbortError") {
        const err = new Error("请求超时（15s），请重试");
        err.status = 0;
        throw err;
      }
      throw e;
    }
  }

  /**
   * 裸 key（uploads/ / b2/uploads/ 开头）→ 解析为可访问的完整 URL（数据库统一存 key）。
   * 与后端 keyToSrc 同规则：b2/ 前缀走 B2 直连域名，未配置时走 /media/ Worker 签名代理；
   * 绝不能把 b2/ key 拼到 R2 域名上（R2 桶里没有 B2 对象，必定 404）。外链原样返回。
   */
  function fullSrc(src) {
    if (!src) return src;
    if (/^(uploads|b2\/uploads)\//.test(src)) {
      const r2 = (state.settings?.r2_domain || "").replace(/\/$/, "");
      const b2 = (state.settings?.b2_domain || "").replace(/\/$/, "");
      if (src.startsWith("b2/")) return b2 ? b2 + "/" + src : "/media/" + src;
      return r2 ? r2 + "/" + src : "/media/" + src;
    }
    return src;
  }

  /**
   * 从原图 src 推导缩略图 URL（/media/ 路径插入 _w1200.jpg 后缀；外链/GIF/已带后缀原样返回）。
   * 展示用缩略图，data-lightbox 用原图 → 点击查看原图。
   */
  function thumbSrc(src) {
    if (!src) return src;
    const r2 = (state.settings?.r2_domain || "").replace(/\/$/, "");
    const b2 = (state.settings?.b2_domain || "").replace(/\/$/, "");
    // 裸 key（uploads/ / b2/uploads/ 开头）→ 先转直连或代理 URL（数据库统一存 key）
    const resolved = fullSrc(src);
    // 站内资源：/media/ 代理路径 或 R2/B2 直连域名，才做缩略图转换
    const isLocal = resolved.includes("/media/") || (r2 && resolved.startsWith(r2 + "/")) || (b2 && resolved.startsWith(b2 + "/"));
    if (!isLocal) return src; // 外链不处理
    if (resolved.includes("_w1200.")) return resolved; // 已是缩略图
    if (/\.gif(?:$|[?#])/i.test(resolved)) return resolved; // GIF 保动画，不换
    return resolved.replace(/\.([^.]+)$/, "_w1200.jpg");
  }

  /** 缩略图 404 兜底：历史图/生成失败的图 R2 上没有 _w1200.jpg，回退加载原图避免裂图。
   *  error 事件不冒泡，用捕获阶段委托。回退后移除 data-orig 防止原图也 404 时死循环。 */
  document.addEventListener(
    "error",
    e => {
      const el = e.target;
      if (el && el.tagName === "IMG" && el.dataset.orig && el.getAttribute("src") !== el.dataset.orig) {
        el.src = el.dataset.orig;
        el.removeAttribute("data-orig");
      }
    },
    true
  );

  /* ---------- 后台：重建历史缩略图 ----------
   * 遍历 feed+photos 全部站内图片，HEAD 检查 _w1200.jpg，缺失的下载原图→canvas 缩图→
   * 按指定 key 上传（/api/admin/upload 带 key 字段，仅允许 uploads/*_w1200.jpg）。
   * 全程走 /media/ 代理（同源无 CORS 依赖），一次性任务可接受 Worker 消耗。 */
  async function rebuildAllThumbs(btn) {
    const setMsg = t => {
      const m = document.querySelector("[data-rebuild-thumbs-msg]");
      if (m) m.textContent = t;
    };
    if (btn.disabled) return;
    if (!confirm("遍历全站图片并为缺失的缩略图生成补传。\n图片多时耗时较长，确定开始？")) return;
    btn.disabled = true;
    try {
      const r2 = (state.settings?.r2_domain || "").replace(/\/$/, "");
      const b2 = (state.settings?.b2_domain || "").replace(/\/$/, "");
      const keyFrom = src => {
        if (!src) return null;
        try {
          if (src.includes("/media/")) {
            const k = decodeURIComponent(src.split("/media/")[1].split(/[?#]/)[0]);
            return k.startsWith("uploads/") || k.startsWith("b2/uploads/") ? k : null;
          }
          if (r2 && src.startsWith(r2 + "/")) {
            const k = decodeURIComponent(src.slice(r2.length + 1).split(/[?#]/)[0]);
            return k.startsWith("uploads/") ? k : null;
          }
          if (b2 && src.startsWith(b2 + "/")) {
            const k = decodeURIComponent(src.slice(b2.length + 1).split(/[?#]/)[0]);
            return k.startsWith("b2/") ? k : null;
          }
        } catch {}
        return null;
      };
      // B2 对象走 B2 直连域名取原图（桶内 key 本身含 b2/ 前缀；/media/ 代理只服务 R2），其余走 /media/
      const fetchSrc = key => (key.startsWith("b2/") && b2 ? b2 + "/" + encodeURI(key) : "/media/" + encodeURI(key));
      const keys = new Set();
      let cursor = "";
      setMsg("正在收集图片列表…");
      for (;;) {
        const d = await api("/api/feed?limit=50" + (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""));
        (d.list || []).forEach(it => {
          (it.images || []).forEach(s => {
            const k = keyFrom(s);
            if (k) keys.add(k);
          });
          if (it.cover) {
            const k = keyFrom(it.cover);
            if (k) keys.add(k);
          }
        });
        cursor = d.nextCursor || "";
        if (!cursor) break;
      }
      let page = 1;
      for (;;) {
        const d = await api(`/api/photos?page=${page}&per_page=50`);
        const list = d.list || [];
        list.forEach(p => {
          const k = keyFrom(p.src);
          if (k) keys.add(k);
        });
        if (list.length < 50) break;
        page++;
      }
      const targets = [...keys].filter(k => !/_w1200\.jpg$/i.test(k) && !/\.gif$/i.test(k));
      // 带超时的 fetch：单张请求超过 30s 自动中止，避免某张图卡住导致整个任务“假死”
      const fetchWithTimeout = (url, opts = {}, ms = 30000) => {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), ms);
        return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
      };
      let done = 0, made = 0, missing = 0, failed = 0;
      for (const key of targets) {
        done++;
        setMsg(`重建缩略图 ${done}/${targets.length}（已补 ${made}）…`);
        const thumbKey = key.replace(/\.([^.]+)$/i, "_w1200.jpg");
        try {
          const head = await fetchWithTimeout(fetchSrc(thumbKey), { method: "HEAD" });
          if (head.ok) continue;
          const resp = await fetchWithTimeout(fetchSrc(key));
          if (!resp.ok) { missing++; continue; }
          const blob = await resp.blob();
          const file = new File([blob], key.split("/").pop() || "img", { type: blob.type || "image/jpeg" });
          const thumb = await generateThumb(file);
          if (!thumb) { failed++; continue; }
          const fd = new FormData();
          fd.append("file", thumb, "thumb.jpg");
          fd.append("kind", "image");
          // 后端按 uploads/ 前缀校验后自动按存储模式加 b2/ 前缀，B2 key 需去掉前缀再传
          fd.append("key", key.startsWith("b2/") ? key.slice(3) : key);
          const res = await fetchWithTimeout("/api/admin/upload", { method: "POST", body: fd, credentials: "same-origin" });
          if (res.ok) made++; else failed++;
        } catch {
          failed++; // 超时/网络异常：记入失败，继续下一张，不中断整体任务
        }
      }
      setMsg(`完成：共 ${targets.length} 张，补生成 ${made} 张${missing ? `，${missing} 张原图缺失` : ""}${failed ? `，${failed} 张失败` : ""}`);
      toast(`缩略图重建完成（${made}/${targets.length}）${failed ? `，${failed} 张失败` : ""}`);
    } catch (err) {
      setMsg("失败：" + err.message);
      toast(err.message);
    } finally {
      btn.disabled = false;
    }
  }
  document.addEventListener("click", e => {
    const btn = e.target?.closest?.("[data-rebuild-thumbs]");
    if (btn) rebuildAllThumbs(btn);
  });

  /**
   * 上传前用 canvas 生成缩略图（最长边 1200px、JPEG 82%），与原图一起上传到 R2。
   * 展示用缩略图，原图仅「查看原图」时加载。
   * GIF 跳过（保动画），失败返回 null（不影响上传）。
   */
  async function generateThumb(file) {
    // GIF 跳过（保动画，thumbSrc 同步豁免 GIF）；其余一律生成——
    // 展示端 thumbSrc 会无条件把站内图替换成 _w1200.jpg，小图不生成会导致 404 裂图
    if (file.type === "image/gif") return null;
    const MAX_EDGE = 1200;
    let bitmap = null;
    try {
      if (window.createImageBitmap) {
        try {
          bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
        } catch {
          bitmap = await createImageBitmap(file);
        }
      } else {
        const url = URL.createObjectURL(file);
        try {
          bitmap = await new Promise((res, rej) => {
            const el = new Image();
            el.onload = () => res(el);
            el.onerror = rej;
            el.src = url;
          });
        } finally {
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      }
      const W = bitmap.width;
      const H = bitmap.height;
      // 始终生成 _w1200.jpg 缩略图：展示端 thumbSrc 无条件把站内图改写成 _w1200.jpg，
      // 若小图不生成缩略图，前端请求会 404（控制台 ORB 报错 + 回退加载原图拖慢首页）。
      // 小于 1200px 的按原尺寸重编码为 jpeg，保证每张站内图都有对应缩略图。
      const scale = Math.min(1, MAX_EDGE / Math.max(W, H));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(W * scale));
      canvas.height = Math.max(1, Math.round(H * scale));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return await new Promise(res => canvas.toBlob(b => res(b), "image/jpeg", 0.82));
    } catch {
      return null;
    } finally {
      bitmap?.close?.();
    }
  }

  /* ================= 视频转码（HEVC → H.264，ffmpeg.wasm 按需加载） =================
     现象：iPhone 录制视频默认 HEVC(hvc1)，Firefox/部分 Chrome 不能解码 → 有声音没画面。
     方案：上传前在浏览器中用 ffmpeg.wasm 转码 HEVC → H.264(avc1) + AAC，所有浏览器可播。
     - 主类托管在 /vendor/ffmpeg.js + /vendor/814.ffmpeg.js（worker）
     - ffmpeg-core.wasm(约 32MB) 从 jsdelivr CDN 加载，超出 Workers 静态资源单文件 25MB 限制
     - 仅检测到 HEVC 时才加载，H.264 视频直传无影响
  */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-src="${src}"]`);
      if (existing && existing.dataset.loaded === "1") return resolve();
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("加载失败: " + src)), { once: true });
        return;
      }
      const el = document.createElement("script");
      el.src = src;
      el.dataset.src = src;
      el.async = true;
      el.onload = () => { el.dataset.loaded = "1"; resolve(); };
      el.onerror = () => reject(new Error("加载失败: " + src));
      document.head.appendChild(el);
    });
  }

  let _ffmpegPromise = null;
  let _hlsPromise = null;
  let _artPromise = null;
  // HLS 库（hls.min.js 约 600KB）按需加载：仅遇到非 Safari 的 HLS 视频时才下载
  function ensureHls() {
    if (window.Hls) return Promise.resolve(window.Hls);
    if (!_hlsPromise) {
      _hlsPromise = loadScript("/vendor/hls.min.js")
        .then(() => window.Hls || null)
        .catch(() => null);
    }
    return _hlsPromise;
  }
  // Artplayer（约 158KB）按需加载：仅桌面端存在视频时才下载（移动端用原生控件）
  function ensureArtplayer() {
    if (window.Artplayer) return Promise.resolve(window.Artplayer);
    if (!_artPromise) {
      _artPromise = loadScript("/vendor/artplayer.js")
        .then(() => window.Artplayer || null)
        .catch(() => null);
    }
    return _artPromise;
  }
  function loadFfmpeg() {
    if (_ffmpegPromise) return _ffmpegPromise;
    _ffmpegPromise = (async () => {
      try {
        await loadScript("/vendor/ffmpeg.js?v=20260920o");
        if (!window.FFmpegWASM || !window.FFmpegWASM.FFmpeg) throw new Error("ffmpeg 加载失败");
        const ffmpeg = new window.FFmpegWASM.FFmpeg();
        await ffmpeg.load({
          coreURL: "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js",
          wasmURL: "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm"
        });
        return ffmpeg;
      } catch (err) {
        // 加载/初始化失败必须清空缓存，否则之后所有 HEVC 上传都会拿到同一个
        // rejected Promise，永久不可用，只能刷新页面
        _ffmpegPromise = null;
        throw err;
      }
    })();
    return _ffmpegPromise;
  }

  /** 在 buffer 中查找 hvc1/hev1 四字节标识 */
  function bufferHasHevcFourcc(buf) {
    const len = buf.length - 3;
    for (let i = 0; i < len; i++) {
      // hvc1 = 0x68 0x76 0x63 0x31
      if (buf[i] === 0x68 && buf[i + 1] === 0x76 && buf[i + 2] === 0x63 && buf[i + 3] === 0x31) return true;
      // hev1 = 0x68 0x65 0x76 0x31
      if (buf[i] === 0x68 && buf[i + 1] === 0x65 && buf[i + 2] === 0x76 && buf[i + 3] === 0x31) return true;
    }
    return false;
  }

  /** 检测 MP4 是否 HEVC：moov 可能在文件头（faststart/iPhone）也可能在文件尾
   *  （安卓/剪映非 faststart 导出），头尾各扫 2MB 避免漏检 */
  async function detectHevcMp4(file) {
    const CHUNK = 2 * 1024 * 1024;
    try {
      const ranges = [];
      ranges.push([0, Math.min(file.size, CHUNK)]);
      if (file.size > CHUNK) ranges.push([Math.max(0, file.size - CHUNK), file.size]);
      for (const [start, end] of ranges) {
        const buf = new Uint8Array(await file.slice(start, end).arrayBuffer());
        if (bufferHasHevcFourcc(buf)) return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /** 浏览器转码 HEVC MP4 → H.264 MP4；onProgress(ratio 0~1) */
  async function transcodeHevcToAvc(file, onProgress) {
    const ffmpeg = await loadFfmpeg();
    const inName = "in.mp4";
    const outName = "out.mp4";
    const data = new Uint8Array(await file.arrayBuffer());
    await ffmpeg.writeFile(inName, data);
    const onProg = e => {
      if (typeof e?.progress === "number") onProgress?.(Math.max(0, Math.min(1, e.progress)));
    };
    ffmpeg.on("progress", onProg);
    try {
      // 注意：不用 -movflags +faststart。progress 到 100% 只代表视频帧编码完成，
      // 之后还有音频封装；faststart 需要在 wasm 内存里把整个输出文件再复制一遍，
      // 大视频（iPhone 100MB 级）极易在此卡死假死。moov 在尾时 R2 与 /media/ 代理
      // 都支持 Range 请求，浏览器照样秒开可播。
      // 另加超时兜底：wasm 内大文件转码偶发假死，超时后 terminate 实例报错。
      const EXEC_TIMEOUT = 8 * 60 * 1000;
      let timer;
      await Promise.race([
        ffmpeg.exec([
          "-i", inName,
          "-c:v", "libx264",
          "-preset", "veryfast",
          "-crf", "23",
          "-pix_fmt", "yuv420p",
          "-c:a", "aac",
          "-b:a", "128k",
          outName
        ]),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("转码超时，请压缩视频后重试")), EXEC_TIMEOUT); }),
      ]).finally(() => clearTimeout(timer));
    } catch (err) {
      // 失败/超时：终止 wasm 实例并清空缓存，下次上传自动重新加载转码器
      try { ffmpeg.terminate(); } catch {}
      _ffmpegPromise = null;
      throw err;
    } finally {
      ffmpeg.off("progress", onProg);
      try { await ffmpeg.deleteFile(inName); } catch {}
    }
    const out = await ffmpeg.readFile(outName, "binary");
    try { await ffmpeg.deleteFile(outName); } catch {}
    const base = file.name.replace(/\.mp4$/i, "");
    return new File([out], base + ".mp4", { type: "video/mp4" });
  }

  function uploadFile(file, kind, onProgress, thumb) {
    return new Promise((resolve, reject) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);
      if (thumb) fd.append("thumb", thumb, "thumb.jpg");
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/admin/upload");
      xhr.onload = () => {
        try {
          const j = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && j.code === 200) resolve(j.data);
          else reject(new Error(j.message || "上传失败"));
        } catch (_) {
          reject(new Error("上传失败"));
        }
      };
      xhr.onerror = () => reject(new Error("网络错误，上传失败"));
      if (onProgress && xhr.upload) {
        xhr.upload.onprogress = e => {
          if (e.lengthComputable) onProgress(e.loaded / e.total);
        };
      }
      xhr.send(fd);
    });
  }

  /** 图片原图直传 + 同时生成缩略图；视频原样直传 */
  async function uploadMedia(file, kind, onProgress) {
    if (kind === "image" && file.type.startsWith("image/")) {
      onProgress?.(0);
      const thumb = await generateThumb(file);
      return uploadFile(file, kind, onProgress, thumb);
    }
    return uploadFile(file, kind, onProgress);
  }

  /** marked 输出净化（纵深防御）+ 图片缩略图替换 */
  function sanitizeHtml(html) {
    const tpl = document.createElement("template");
    tpl.innerHTML = html;
    tpl.content.querySelectorAll("script,iframe,object,embed,link,meta,style,form,input,button").forEach(n => n.remove());
    // 图片增强：先把裸 key 解析成原图完整 URL（fullSrc），再用缩略图做 src；
    // data-orig（缩略图 404 时回退原图）与 data-lightbox（灯箱看原图）必须是完整 URL，
    // 不能存裸 key，否则相对路径会拼到 /post/ 下照样裂图
    tpl.content.querySelectorAll("img[src]").forEach(el => {
      const raw = el.getAttribute("src") || "";
      const full = fullSrc(raw);
      const ts = thumbSrc(raw);
      if (ts !== full) {
        el.setAttribute("src", ts);
        el.setAttribute("data-orig", full);
        el.setAttribute("data-lightbox", full);
      }
    });
    tpl.content.querySelectorAll("*").forEach(el => {
      [...el.attributes].forEach(attr => {
        const name = attr.name.toLowerCase();
        if (name.startsWith("on")) el.removeAttribute(attr.name);
        if ((name === "href" || name === "src") && /^\s*javascript:/i.test(attr.value)) {
          el.removeAttribute(attr.name);
        }
      });
      if (el.tagName === "A") {
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer");
      }
    });
    return tpl.innerHTML;
  }

  function renderContentHtml(content) {
    if (!content) return "";
    return sanitizeHtml(marked.parse(content));
  }

  /** 等待下一帧；隐藏窗口下 rAF 会被暂停，用短超时兜底 */
  function nextFrame() {
    return new Promise(resolve => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      window.requestAnimationFrame(finish);
      window.setTimeout(finish, 120);
    });
  }

  /* ================= 模态 ================= */
  // 弹窗打开时锁定背景滚动，避免手机端弹窗与背景争抢滚动导致抖动；
  // 用计数兼容嵌套弹窗（如评论弹窗里再开图片灯箱）
  let modalOpenCount = 0;
  function lockBodyScroll() {
    if (modalOpenCount === 0) document.body.style.overflow = "hidden";
    modalOpenCount++;
  }
  function unlockBodyScroll() {
    modalOpenCount = Math.max(0, modalOpenCount - 1);
    if (modalOpenCount === 0) document.body.style.overflow = "";
  }

  /**
   * 把表情面板重新定位到当前 textarea 上方（键盘弹起 / 视口变化后调用，
   * 避免面板被键盘遮挡或位置过时）。
   */
  function repositionEmojiPanel() {
    const panel = document.getElementById("emojiPanel");
    const ta = emojiPanelTarget;
    if (!panel || !ta || !ta.isConnected) return;
    const rect = ta.getBoundingClientRect();
    panel.style.left = rect.left + "px";
    panel.style.bottom = window.innerHeight - rect.top + 4 + "px";
  }

  /**
   * 手机端键盘适配：键盘弹起时把弹窗内容（含底部输入框）顶到键盘之上，
   * 并把当前聚焦元素滚入可视区，避免评论框被输入法遮挡。
   * 返回清理函数，closeModal 时调用。
   */
  function bindKeyboardAware(modal) {
    const vv = window.visualViewport;
    if (!vv) return () => {};
    let raf = 0;
    let lastKbd = -1; // 上次应用的键盘高度，用于阈值去抖
    let wasOpen = false; // 键盘是否处于弹起状态（只在收起→弹起时滚一次）

    const scrollFocused = () => {
      const el = document.activeElement;
      if (el && modal.contains(el) && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ block: "nearest" });
      }
    };

    const onViewport = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // 键盘高度 = 布局视口高 - 可视视口高 - 可视视口偏移
        const kbd = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
        // 阈值去抖：忽略地址栏伸缩等小幅抖动（<20px 不响应），减少跳动
        if (Math.abs(kbd - lastKbd) >= 20) {
          lastKbd = kbd;
          modal.style.paddingBottom = kbd > 0 ? kbd + 12 + "px" : "";
        }
        // 仅在键盘「收起→弹起」的瞬间滚一次，避免与浏览器原生滚动反复打架
        if (kbd > 0 && !wasOpen) {
          wasOpen = true;
          scrollFocused();
        } else if (kbd === 0) {
          wasOpen = false;
        }
        repositionEmojiPanel(); // 表情面板跟随键盘重定位
      });
    };
    // 键盘已弹起时切换到另一个输入框，也滚一次
    const onFocus = () => { if (wasOpen) scrollFocused(); };

    vv.addEventListener("resize", onViewport);
    vv.addEventListener("scroll", onViewport);
    modal.addEventListener("focusin", onFocus);
    return () => {
      vv.removeEventListener("resize", onViewport);
      vv.removeEventListener("scroll", onViewport);
      modal.removeEventListener("focusin", onFocus);
      cancelAnimationFrame(raf);
      modal.style.paddingBottom = "";
    };
  }

  function openModal(html, opts) {
    lockBodyScroll();
    modalRoot.innerHTML = `
      <div class="modal-mask">
        <div class="modal${opts?.size === "lg" ? " modal-lg" : ""}" role="dialog">${html}</div>
      </div>`;
    const mask = modalRoot.querySelector(".modal-mask");
    const modal = modalRoot.querySelector(".modal");
    modal._kbCleanup = bindKeyboardAware(modal);
    mask.addEventListener("click", e => {
      if (e.target !== mask) return;
      // 编辑器类弹窗（含文本输入框）点外部不关闭，防止误点丢内容；
      // 确认类小弹窗（无输入控件）保留点遮罩关闭的习惯
      if (modalRoot.querySelector(".modal textarea, .modal input[type='text'], .modal input[type='url'], .modal input[type='email'], .modal input[type='password']")) return;
      closeModal();
    });
    return modal;
  }
  function closeModal() {
    document.querySelectorAll(".md-menu").forEach(m => m.remove()); // 编辑器下拉菜单挂在 body，需手动清理
    // 必须先停掉弹窗内所有视频：直接 innerHTML="" 会让正在播放的 MP4 继续发声、
    // HLS 实例不 destroy 继续后台拉分片
    disposeVideos(modalRoot);
    const modal = modalRoot.querySelector(".modal");
    if (modal && typeof modal._kbCleanup === "function") modal._kbCleanup();
    modalRoot.innerHTML = "";
    unlockBodyScroll();
  }

  /* ================= 图片灯箱（Fancybox：缩放/幻灯片/全屏/手势） ================= */
  // 全站图片统一用 data-lightbox 触发（feed / 相册 / 评论 / 正文）。
  // 为不拖慢首屏，Fancybox 的 CSS+JS 在「首次点图」时才懒加载。

  let fbOpen = false;          // 灯箱是否处于打开状态
  let fbAssetsPromise = null;  // 懒加载资源的 Promise（只加载一次）

  // 懒加载 Fancybox 资源：CSS + UMD 脚本
  function loadLightboxAssets() {
    if (fbAssetsPromise) return fbAssetsPromise;
    fbAssetsPromise = (async () => {
      if (!document.getElementById("fb-css")) {
        const l = document.createElement("link");
        l.id = "fb-css"; l.rel = "stylesheet"; l.href = "/vendor/fancybox/fancybox.css";
        document.head.appendChild(l);
      }
      if (!document.querySelector('script[src="/vendor/fancybox/fancybox.umd.js"]')) {
        await new Promise((res, rej) => {
          const sc = document.createElement("script");
          sc.src = "/vendor/fancybox/fancybox.umd.js"; sc.onload = res; sc.onerror = rej;
          document.body.appendChild(sc);
        });
      }
    })();
    return fbAssetsPromise;
  }

  // 用一组图片打开灯箱，index 为起始下标
  async function openLightbox(src, group) {
    const list = group.filter(Boolean);
    if (!list.length) return;
    const index = Math.max(0, list.indexOf(src));
    try {
      await loadLightboxAssets();
    } catch (e) {
      showToast(t("lightbox.load_failed")); return;
    }
    if (typeof Fancybox === "undefined") { showToast(t("lightbox.load_failed")); return; }
    // 窄屏（手机）精简按钮避免换行；桌面端保留与参考站一致的全按钮
    const isMobile = window.innerWidth < 640;
    const toolbar = isMobile
      ? { left: [], middle: ["zoomIn", "zoomOut"], right: ["slideshow", "fullscreen", "close"] }
      : { left: [], middle: ["zoomIn", "zoomOut", "actualSize", "rotateCCW", "rotateCW", "flipX", "flipY"], right: ["slideshow", "fullscreen", "close"] };
    // Fancybox v5 的 Fancybox.show() 传纯对象 slides（{src}）时 startIndex 完全失效，
    // 灯箱永远从第 1 张打开；元素节点路径正常 —— 动态构建隐藏 a>img 节点后走 fromNodes
    const holder = document.createElement("div");
    holder.style.cssText = "position:absolute;left:-9999px;top:0;width:1px;height:1px;overflow:hidden";
    const nodes = list.map(s => {
      const a = document.createElement("a");
      a.href = s;
      a.setAttribute("data-fancybox", "lightbox");
      const img = document.createElement("img");
      img.src = s;
      a.appendChild(img);
      holder.appendChild(a);
      return a;
    });
    document.body.appendChild(holder);
    Fancybox.fromNodes(nodes, {
      startIndex: index,
      infinite: true,              // 循环切换
      dragToClose: false,          // 避免误触关闭
      Images: { zoom: true },      // 滚轮/双击缩放
      Toolbar: { display: toolbar },
      on: {
        done: () => { fbOpen = true; lockBodyScroll(); },
        destroy: () => { fbOpen = false; unlockBodyScroll(); holder.remove(); },
      },
    });
  }

  function closeLightbox() { if (typeof Fancybox !== "undefined") { try { Fancybox.close(); } catch (_) {} } }

  // 事件委托：点击任意 [data-lightbox] 打开
  document.addEventListener("click", e => {
    const trigger = e.target.closest?.("[data-lightbox]");
    if (trigger) {
      e.preventDefault();
      const wrap = trigger.closest(".bber-container-img") || trigger.closest(".photos-grid") || trigger.closest(".photo-admin-grid") || trigger.parentElement;
      const group = [...wrap.querySelectorAll("[data-lightbox]")].map(a => a.getAttribute("data-lightbox"));
      openLightbox(trigger.getAttribute("data-lightbox"), group);
    }
  });

  document.addEventListener("keydown", e => {
    if (!fbOpen) return;
    // 灯箱打开时独占 ESC：避免连带关闭下层评论弹窗（Fancybox 自身也会关闭）
    if (e.key === "Escape") { e.stopImmediatePropagation(); closeLightbox(); }
  });

  // 缩略图加载失败 → 自动回退原图（老图片没有 _w1200 缩略图时触发）
  document.addEventListener("error", e => {
    const img = e.target;
    if (img && img.tagName === "IMG" && img.dataset.orig && img.src !== img.dataset.orig) {
      img.src = img.dataset.orig;
    }
  }, true);

  /* ================= 视频 ================= */

  /**
   * 浏览器截取视频封面帧：创建隐藏 <video>，seek 到 1 秒处，canvas 截图 → JPEG Blob。
   * 失败返回 null（不阻断上传）。CORS 限制下外链视频可能截取失败。
   */
  async function extractVideoPoster(file) {
    const MAX_W = 1280;
    let url = null;
    let v = null;
    try {
      url = URL.createObjectURL(file);
      v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.preload = "auto"; // 手机需要 auto，metadata 不够 seek
      v.crossOrigin = "anonymous";
      v.src = url;

      // 等 metadata 加载
      await new Promise((res, rej) => {
        v.onloadedmetadata = res;
        v.onerror = rej;
        setTimeout(rej, 10000);
      });

      // 手机（尤其 iOS Safari）必须 play() 后才能 seek，否则 seeked 事件永远不触发
      try {
        await v.play();
      } catch {
        // 某些浏览器 play() 被 block 也没关系，继续尝试 seek
      }

      const t = Math.min(1, (v.duration || 10) * 0.1);
      await new Promise((res, rej) => {
        const done = () => { cleanup(); res(); };
        const fail = () => { cleanup(); rej(new Error("seek timeout")); };
        const cleanup = () => {
          v.removeEventListener("seeked", done);
        };
        v.addEventListener("seeked", done, { once: true });
        try { v.currentTime = t; } catch { done(); }
        setTimeout(fail, 8000);
      });

      try { v.pause(); } catch {}

      // 等 frame 渲染到屏幕上
      await new Promise(r => setTimeout(r, 150));

      const W = v.videoWidth;
      const H = v.videoHeight;
      if (!W || !H) throw new Error("no video frame");
      const scale = W > MAX_W ? MAX_W / W : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(W * scale));
      canvas.height = Math.max(1, Math.round(H * scale));
      const ctx = canvas.getContext("2d");
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const blob = await new Promise(res => canvas.toBlob(b => res(b), "image/jpeg", 0.82));
      // 截帧结果校验：blob 过小说明画出了空白/纯黑帧（如解码失败的 HEVC 视频），
      // 视为截帧失败返回 null，避免把 1x1/纯黑废图当封面上传
      if (!blob || blob.size < 3072) return null;
      return blob;
    } catch {
      try { if (url) URL.revokeObjectURL(url); } catch {}
      return null;
    } finally {
      try { if (v) v.src = ""; } catch {}
    }
  }
  // 视频封面：视频自带封面优先，否则用后台"统一默认封面"（存量数据无需改库即生效）
  function resolveVideoPoster(own) {
    const p = own || state.settings?.video_default_poster || "";
    return /^(?:https?:\/\/|\/)/i.test(p) ? p : "";
  }

  function videoHtml(video) {
    if (!video) return "";
    if (video.kind === "embed" && video.provider && video.vid) {
      return embedBoxHtml({ provider: video.provider, vid: video.vid });
    }
    if (!video.src) return "";
    const poster = resolveVideoPoster(video.poster);
    const posterAttr = poster ? ` poster="${esc(poster)}"` : "";
    if (video.kind === "hls") {
      return `<video class="essay-media-video essay-media-video--hls" data-hls-src="${esc(video.src)}"${posterAttr} controls preload="none" playsinline></video>`;
    }
    return `<video class="essay-media-video" src="${esc(video.src)}"${posterAttr} controls preload="none" playsinline></video>`;
  }

  // ===== 站外嵌入视频（B站 / YouTube）=====
  function parseEmbedUrl(s) {
    s = String(s || "").trim();
    if (!s) return null;
    const yt =
      s.match(/youtube\.com\/watch\?[^#]*?[?&]v=([\w-]{11})/i) ||
      s.match(/youtu\.be\/([\w-]{11})/i) ||
      s.match(/youtube(?:-nocookie)?\.com\/(?:embed|shorts|v)\/([\w-]{11})/i);
    if (yt) return { provider: "youtube", vid: yt[1] };
    const bv = s.match(/\/video\/(BV[0-9A-Za-z]{10})/i) || s.match(/(BV[0-9A-Za-z]{10})/);
    if (bv) return { provider: "bilibili", vid: bv[1] };
    return null;
  }
  function embedIframeUrl(e) {
    return e.provider === "youtube"
      ? `https://www.youtube-nocookie.com/embed/${e.vid}`
      : `https://player.bilibili.com/player.html?bvid=${e.vid}&page=1&high_quality=1&danmaku=0&autoplay=0`;
  }
  // 站外嵌入视频：输出带 provider/vid 的占位容器，由 hydrateVideos 用 createElement 注入 iframe。
  // 不能直接在 HTML 里写 <iframe>——sanitizeHtml 会过滤掉 iframe，导致只剩空黑盒。
  function embedBoxHtml(e) {
    return `<div class="video-embed" data-embed-provider="${e.provider}" data-embed-vid="${esc(e.vid)}"></div>`;
  }
  // 一条说说的全部视频（兼容旧的单视频字段 m.video）
  function videosHtml(m) {
    const arr = Array.isArray(m.videos) ? m.videos : m.video ? [m.video] : [];
    return arr.map(videoHtml).join("");
  }

  // 外链媒体（封面图等）统一走自家 Worker 反代：部分图床域名在国内被 TLS 阻断，
  // 浏览器直连永远失败；站内相对路径原样返回
  function proxiedMedia(url) {
    if (!url || !/^https?:\/\//i.test(url)) return url;
    try {
      const u = new URL(url, location.origin);
      // R2/B2 直连域名：文件本就可公网访问，原样保留——不能转 pathname，
      // Worker 站点上不存在 /uploads/ 路径（站内媒体走 /media/<key>），转了必 404
      const cdnHosts = ["r2_domain", "b2_domain"]
        .map(k => (state.settings?.[k] ? new URL(state.settings[k], location.origin).host : ""))
        .filter(Boolean);
      if (cdnHosts.includes(u.host)) return url;
      // 当前站点域名：转相对路径（/media/<key> 在本站有效）
      if (u.host === location.host) return u.pathname + u.search + u.hash;
      // 其他外链：走 imgproxy 反代（防被墙/防盗链）
      return "/imgproxy?u=" + encodeURIComponent(url);
    } catch {
      return url;
    }
  }

  // 向占位容器注入真正的播放器 iframe
  function injectEmbedIframe(el, provider, vid) {
    const iframe = document.createElement("iframe");
    iframe.src = embedIframeUrl({ provider, vid });
    iframe.className = "video-embed-frame";
    iframe.loading = "lazy";
    iframe.frameBorder = "0";
    iframe.allowFullscreen = true;
    iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen");
    // sandbox 拦截站外跳转：无 allow-popups 时播放器内 logo/标题/推荐的 window.open 全被拦死；
    // 无 allow-top-navigation 时无法跳转顶层页面。播放/全屏等内部功能不受影响。
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation");
    el.innerHTML = "";
    el.appendChild(iframe);
  }

  // YouTube 在国内被墙时的友好提示（替代被墙的 iframe）
  function youtubeBlockedNotice(vid) {
    const href = `https://www.youtube.com/watch?v=${encodeURIComponent(vid)}`;
    return `<div class="video-embed-notice">
      <span>${t("video.yt_blocked")}</span>
      <a href="${esc(href)}" target="_blank" rel="noreferrer">${t("video.open_youtube")}</a>
    </div>`;
  }

  // 探测 YouTube 是否可访问：加载其 favicon，成功=可达，失败/超时=被墙。
  // 结果整页缓存（同一会话只探一次，所有视频共用）。
  let _ytProbe = null;
  function youtubeReachable() {
    if (_ytProbe === null) {
      _ytProbe = new Promise(resolve => {
        let done = false;
        const finish = ok => { if (done) return; done = true; resolve(ok); };
        const img = new Image();
        img.onload = () => finish(true);
        img.onerror = () => finish(false);
        img.src = `https://www.youtube.com/favicon.ico?_=${Date.now()}`;
        setTimeout(() => finish(false), 3500); // 超时视为不可达
      });
    }
    return _ytProbe;
  }

  function hydrateVideos(root) {
    // 站外嵌入视频：占位容器 → 注入真正的 iframe（用 createElement，避开 sanitizeHtml 过滤）
    root.querySelectorAll(".video-embed[data-embed-provider]:not([data-embed-ready])").forEach(el => {
      el.dataset.embedReady = "1";
      const provider = el.dataset.embedProvider;
      const vid = el.dataset.embedVid;
      if (!provider || !vid) return;
      if (provider === "youtube") {
        // YouTube 在国内被墙：先探测连通性，通才加载 iframe，不通则显示友好提示
        youtubeReachable().then(ok => {
          if (ok) injectEmbedIframe(el, provider, vid);
          else el.innerHTML = youtubeBlockedNotice(vid);
        });
      } else {
        injectEmbedIframe(el, provider, vid);
      }
    });
    // 预连接外部视频域名（提前建 TCP 连接，HLS 首请求快几百毫秒）
    const preconnected = new Set();
    root.querySelectorAll("video.essay-media-video").forEach(v => {
      const raw = v.src || v.dataset.hlsSrc || "";
      const m = raw.match(/^https?:\/\/([^/]+)/i);
      if (m && !preconnected.has(m[1])) {
        preconnected.add(m[1]);
        const link = document.createElement("link");
        link.rel = "preconnect";
        link.href = `${m[0].split("/")[0]}//${m[1]}`;
        document.head.appendChild(link);
      }
    });
    // 封面：直接用 <video> 原生 poster 属性，配合 CSS object-fit:cover 充满容器。
    // 不叠 overlay <img>——overlay 会在移动端盖住原生控制条（播放/进度条/全屏），
    // 体验差。原生 poster 由浏览器在视频播放后自动隐藏；HEVC 解码失败时永远不隐藏
    // （兜底：至少能看到封面）。外链封面走 /imgproxy 由 Worker 回源（国内图床被墙）。
    //
    // 中间播放按钮：仅在桌面端（fine pointer）显示。
    // 原因：移动端浏览器（iOS Safari / 移动版 Edge / Android Chrome）会在视频画面中央
    // 自动渲染原生大播放按钮，若再加自定义按钮会出现两个按钮重叠。移动端原生控制条
    // 体验更好（系统级全屏手势等），直接用原生；桌面端浏览器不显示中央按钮，用我们的。
    const isTouchDevice = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    root.querySelectorAll("video.essay-media-video:not([data-poster-attached])").forEach(v => {
      v.dataset.posterAttached = "1";
      const p = v.getAttribute("poster") || "";
      if (p) v.setAttribute("poster", proxiedMedia(p));
      // 包定位容器（仅未包过时）
      if (!v.parentElement.classList.contains("video-stage")) {
        const stage = document.createElement("div");
        stage.className = "video-stage";
        v.parentNode.insertBefore(stage, v);
        stage.appendChild(v);
      }
      const stage = v.parentElement;
      // 桌面端：加居中播放按钮（点击播放，播放中隐藏）；移动端不挂，用浏览器原生按钮
      if (!isTouchDevice && !stage.querySelector(".video-play-btn")) {
        const btn = document.createElement("span");
        btn.className = "video-play-btn";
        btn.setAttribute("role", "button");
        btn.setAttribute("aria-label", t("common.play_video"));
        btn.tabIndex = 0;
        const tryPlay = () => v.play().catch(() => {});
        btn.addEventListener("click", tryPlay);
        btn.addEventListener("keydown", e => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tryPlay(); }
        });
        stage.appendChild(btn);
      }
      // 播放中切换 object-fit:contain，保证视频内容不被裁切；
      // ended 后切回 cover（封面重新显示，充满无黑边）
      v.addEventListener("playing", () => v.classList.add("is-playing"));
      v.addEventListener("ended", () => v.classList.remove("is-playing"));
      // 竖屏视频自适应：metadata 后写入真实宽高比，避免固定 16:9 导致两侧黑边；
      // 竖屏另加 video-portrait 类（CSS 限高居中），否则 width:100% 时高度≈1.78×容器宽
      // 会把卡片/整页布局撑爆——竖屏是起播加载 metadata 后才突变，正是"点播放后撑变形"根因
      const applyRatio = () => {
        const W = v.videoWidth, H = v.videoHeight;
        if (!W || !H) return;
        v.style.aspectRatio = (W / H).toFixed(4);
        v.classList.toggle("video-portrait", H > W);
      };
      if (v.readyState >= 1) applyRatio();
      v.addEventListener("loadedmetadata", applyRatio);
    });
    // 桌面端增强：原生 <video> → Artplayer（倍速/画面比例/PIP/网页全屏/统一皮肤）。
    // 仅桌面（宽 ≥769px 且非触屏）：移动端保留原生控件（系统级手势/锁屏控制更优）。
    // 库加载失败自动回退原生挂接。先同步占位 data-video-attached，防止下方原生逻辑重复处理。
    // 全端启用 Artplayer（含移动端，用户想体验手机端效果）。
    // 快速回退：把 MOBILE_ARTPLAYER 改回 false 即恢复移动端原生控件。
    const MOBILE_ARTPLAYER = true;
    if (MOBILE_ARTPLAYER || (!isTouchDevice && window.matchMedia("(min-width: 769px)").matches)) {
      root.querySelectorAll("video.essay-media-video:not([data-video-attached])").forEach(videoEl => {
        videoEl.dataset.videoAttached = "1";
        ensureArtplayer().then(Art => {
          if (Art) buildArtplayer(videoEl, Art);
          else { delete videoEl.dataset.videoAttached; attachVideoNative(videoEl); }
        });
      });
    }
    // 仅水合"未挂接"的视频：loadFeed 每次翻页都对整个列表容器调用，
    // 不加标记会让旧 HLS 视频被反复 new Hls()，旧实例（含 worker/持续分片下载）
    // 从不销毁，翻几页后 CPU/网络/内存暴涨，整站越来越卡。
    root.querySelectorAll("video.essay-media-video--hls[data-hls-src]:not([data-video-attached])").forEach(attachVideoNative);
    // 非 HLS（直 src）视频：加载提示
    root.querySelectorAll("video.essay-media-video[src]:not(.essay-media-video--hls):not([data-video-attached])").forEach(attachVideoNative);
  }

  /** 给 video 元素挂 HLS 源：Safari 走原生 HLS，其余按需加载 hls.js（约 600KB，首屏不下载）。
   *  很多影视采集站源 CDN 抖动频繁（回源超时/连接重置），hls.js 默认重试很少且 fatal 后
   *  不会自愈——一次持续 10s 的抖动就永久黑屏。这里做三级恢复：
   *  startLoad 退避重试 → recoverMediaError/swapAudioCodec → 整体重建实例，
   *  全部失败才显示"加载失败 + 点击重试"遮罩。 */
  function attachHlsSource(videoEl, url) {
    if (videoEl.canPlayType("application/vnd.apple.mpegurl")) {
      bindNativeHlsErrors(videoEl, url);
      videoEl.src = url; // Safari 原生 HLS
      return;
    }
    ensureHls().then(HlsCtor => {
      if (!HlsCtor || !HlsCtor.isSupported()) {
        bindNativeHlsErrors(videoEl, url); // 库加载失败：退回浏览器原生（Chrome 本就不支持 m3u8，至少能拿到 error 提示）
        videoEl.src = url;
        return;
      }
      createRecoverableHls(videoEl, url, HlsCtor);
    });
  }

  /** Safari / 库缺失走原生 <video src=m3u8>：error 时给失败遮罩 + 重试（原生无自动恢复） */
  function bindNativeHlsErrors(videoEl, url) {
    if (videoEl._nativeHlsBound) return;
    videoEl._nativeHlsBound = true;
    videoEl.addEventListener("error", () => {
      if (!videoEl.currentSrc) return; // disposeVideos 主动清 src 触发的 error，忽略
      showHlsFatal(videoEl, () => {
        videoEl.removeAttribute("src");
        videoEl.src = url;
        videoEl.load();
        videoEl.play().catch(() => {});
      });
    });
    videoEl.addEventListener("playing", () => hideHlsFatal(videoEl));
  }

  /** 带自动恢复的 hls.js 实例管理。
   *  注意：不能依赖"再收到一个 fatal"来升级恢复——master 清单解析失败后调 startLoad()
   *  不会重新发起请求（无 level 可载），之后也不再有任何事件，链路会静默卡死。
   *  因此 fatal 后一次性排定整条"定时升级链"，收到健康信号（MANIFEST_PARSED/
   *  FRAG_BUFFERED）立即撤链：startLoad → 重建实例 ×2 → 失败遮罩。 */
  function createRecoverableHls(videoEl, url, HlsCtor) {
    let hls = null;
    let timers = [];
    let sessionDead = false;
    let mediaRecoveries = 0; // swapAudioCodec 决策用
    let recreates = 0;

    const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
    const healthy = () => {
      // 链路恢复：撤下所有待执行的升级动作与失败遮罩，计数归零
      clearTimers();
      mediaRecoveries = 0;
      recreates = 0;
      hideHlsFatal(videoEl);
    };
    const build = () => {
      const h = new HlsCtor({
        enableWorker: true,
        startFragPrefetch: true, // 清单解析时并行预取首片，起播快几百毫秒
        abrEwmaDefaultEstimate: 7e5, // 初始带宽估计 0.7Mbps：差网从低档起步由 ABR 爬升，避免一上来高档卡死
        maxBufferLength: 60, // 前向缓冲目标 60s（默认 30s），抗源站抖动
        backBufferLength: 30, // 已播仅保留 30s，控制内存
        // 采集站源经常回源超时（实测 CDN 节点磁盘满、全部回源），放宽超时与重试，
        // 把"源抖 10 秒就 fatal"的门槛抬高到 30~60 秒
        manifestLoadingTimeOut: 20000,
        manifestLoadingMaxRetry: 6,
        levelLoadingTimeOut: 20000,
        levelLoadingMaxRetry: 6,
        fragLoadingTimeOut: 30000,
        fragLoadingMaxRetry: 8,
      });
      hls = h;
      videoEl._hls = h; // 元素被移除时可供 destroy
      h.on(HlsCtor.Events.ERROR, (_ev, d) => {
        if (!d.fatal || sessionDead || hls !== h) return; // 非致命 hls.js 内部自动重试；旧实例事件忽略
        clearTimers();
        if (d.type === HlsCtor.ErrorTypes.NETWORK_ERROR) {
          // +1s startLoad（救活分片级错误）；+5s/+12s 整体重建（清单级错误 startLoad 无效）；+20s 遮罩
          timers = [
            setTimeout(() => { if (!sessionDead && hls === h) { try { h.startLoad(); } catch { /* 忽略 */ } } }, 1000),
            setTimeout(() => recreate(), 5000),
            setTimeout(() => recreate(), 12000),
            setTimeout(() => { if (!sessionDead) showHlsFatal(videoEl, manualRetry); }, 20000),
          ];
        } else if (d.type === HlsCtor.ErrorTypes.MEDIA_ERROR) {
          // +0.8s recoverMediaError（第 2 次先 swapAudioCodec）；再不行重建；最后遮罩
          const recover = () => {
            mediaRecoveries++;
            if (mediaRecoveries === 2) { try { h.swapAudioCodec(); } catch { /* 忽略 */ } }
            try { h.recoverMediaError(); } catch { /* 忽略 */ }
          };
          timers = [
            setTimeout(recover, 800),
            setTimeout(recover, 4000),
            setTimeout(() => recreate(), 9000),
            setTimeout(() => recreate(), 16000),
            setTimeout(() => { if (!sessionDead) showHlsFatal(videoEl, manualRetry); }, 23000),
          ];
        } else {
          // 其他 fatal（MUX_ERROR/KEY_SYSTEM_ERROR 等）：快速重建两次后遮罩
          timers = [
            setTimeout(() => recreate(), 500),
            setTimeout(() => recreate(), 6000),
            setTimeout(() => { if (!sessionDead) showHlsFatal(videoEl, manualRetry); }, 13000),
          ];
        }
      });
      // 健康信号：清单重新解析成功 / 任一分片缓冲成功 → 撤掉升级链与遮罩
      h.on(HlsCtor.Events.MANIFEST_PARSED, () => { if (hls === h) healthy(); });
      h.on(HlsCtor.Events.FRAG_BUFFERED, () => { if (hls === h) healthy(); });
      h.loadSource(url);
      h.attachMedia(videoEl);
    };
    const recreate = () => {
      if (sessionDead) return;
      clearTimers();
      if (recreates >= 2) { showHlsFatal(videoEl, manualRetry); return; }
      recreates++;
      const resumeAt = videoEl.currentTime || 0;
      const wasPlaying = !videoEl.paused && !videoEl.ended;
      try { hls.destroy(); } catch { /* 忽略 */ }
      build();
      if (resumeAt > 0) hls.on(HlsCtor.Events.MANIFEST_PARSED, () => { hls.startPosition = resumeAt; });
      if (wasPlaying) videoEl.play().catch(() => {});
    };
    const manualRetry = () => {
      // 用户点击重试：全新恢复链，并主动起播（点击是用户手势，允许 autoplay）
      hideHlsFatal(videoEl);
      mediaRecoveries = 0;
      recreates = 0;
      const resumeAt = videoEl.currentTime || 0;
      clearTimers();
      try { if (hls) hls.destroy(); } catch { /* 忽略 */ }
      build();
      if (resumeAt > 0) hls.on(HlsCtor.Events.MANIFEST_PARSED, () => { hls.startPosition = resumeAt; });
      videoEl.play().catch(() => {});
    };
    build();
    // disposeVideos 销毁元素时联动：停定时器、标记会话死亡（直接调用）
    videoEl._hlsDispose = () => {
      sessionDead = true;
      clearTimers();
      videoEl._hlsDispose = null;
    };
  }

  /** 失败遮罩宿主：Artplayer 内挂播放器根容器，原生路径挂 .video-stage */
  function hlsMaskHost(videoEl) {
    return videoEl.closest && videoEl.closest(".art-video-player") ? videoEl.closest(".art-video-player") : videoEl.parentElement;
  }
  function showHlsFatal(videoEl, onRetry) {
    const host = hlsMaskHost(videoEl);
    if (!host || host.querySelector(".video-fatal-mask")) return;
    const mask = document.createElement("div");
    mask.className = "video-fatal-mask";
    const text = document.createElement("div");
    text.className = "video-fatal-text";
    text.textContent = t("video.load_failed");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "video-fatal-retry";
    btn.textContent = t("video.retry");
    mask.append(text, btn);
    btn.addEventListener("click", e => { e.stopPropagation(); onRetry(); });
    host.appendChild(mask);
  }
  function hideHlsFatal(videoEl) {
    const host = hlsMaskHost(videoEl);
    if (host) host.querySelectorAll(".video-fatal-mask").forEach(m => m.remove());
  }

  /** 原生挂接（移动端 / Artplayer 加载失败回退）：加载提示 + HLS/直链处理 */
  function attachVideoNative(videoEl) {
    videoEl.dataset.videoAttached = "1";
    const url = videoEl.dataset.hlsSrc;
    if (videoEl.classList.contains("essay-media-video--hls") && !url) return;
    // 加载提示：只在用户主动播放且确实缓冲中时显示。
    // 不能用 loadstart——preload="none" 的视频解析到 src 就会触发 loadstart
    // 但不下载数据、canplay 永不触发，会导致"加载中…"遮罩永久残留盖住封面。
    videoEl.addEventListener("play", () => { if (videoEl.readyState < 3) videoEl.dataset.loading = "1"; });
    videoEl.addEventListener("waiting", () => videoEl.dataset.loading = "1");
    videoEl.addEventListener("canplay", () => delete videoEl.dataset.loading);
    videoEl.addEventListener("playing", () => delete videoEl.dataset.loading);
    videoEl.addEventListener("pause", () => delete videoEl.dataset.loading);
    videoEl.addEventListener("error", () => delete videoEl.dataset.loading);
    if (url) attachHlsSource(videoEl, url);
  }

  /** 桌面端：把 .video-stage 里的原生 video 替换为 Artplayer 容器。
   *  竖屏比例在 metadata 后写入容器（与原生 applyRatio 行为一致），构造失败回退原生。 */
  function buildArtplayer(videoEl, Art) {
    if (!videoEl.isConnected) return;
    const stage = videoEl.parentElement; // .video-stage（hydrateVideos 已包好）
    const url = videoEl.dataset.hlsSrc || videoEl.getAttribute("src") || "";
    if (!stage || !url) { delete videoEl.dataset.videoAttached; attachVideoNative(videoEl); return; }
    const poster = videoEl.getAttribute("poster") || "";
    const isHls = /\.m3u8(?:[?#]|$)/i.test(url);
    const box = document.createElement("div");
    box.className = "essay-media-video--art";
    stage.querySelectorAll(".video-play-btn").forEach(b => b.remove()); // Artplayer 自带按钮，防重叠
    videoEl.replaceWith(box);
    let art = null;
    try {
      art = new Art({
        container: box,
        url,
        poster,
        type: isHls ? "m3u8" : "",
        lang: "zh-cn",
        theme: (getComputedStyle(document.documentElement).getPropertyValue("--anzhiyu-main") || "#6b8e6f").trim(),
        volume: 1,
        autoplay: false,
        mutex: true, // 多实例互斥：播一个停另一个
        hotkey: true, // 空格/方向键（聚焦时）
        setting: true, // 设置菜单（画面比例等）。注意：布尔开关是 setting；settings 是自定义菜单数组，传布尔会触发 v5 校验抛错回退原生
        playbackRate: true, // 倍速按钮
        aspectRatio: true,
        pip: true,
        fullscreen: true,
        fullscreenWeb: false, // 网页全屏全端关闭（用户需求）
        moreVideoAttr: { playsInline: true },
        customType: isHls ? { m3u8: (video, src) => attachHlsSource(video, src) } : {},
      });
    } catch (e) {
      console.warn("Artplayer 初始化失败，回退原生播放器:", e);
      box.remove();
      stage.appendChild(videoEl);
      delete videoEl.dataset.videoAttached;
      attachVideoNative(videoEl);
      return;
    }
    box._art = art;
    const applyRatio = () => {
      const v = art.video, W = v.videoWidth, H = v.videoHeight;
      if (!W || !H) return;
      box.style.aspectRatio = (W / H).toFixed(4);
      box.classList.toggle("video-portrait", H > W);
      if (typeof art.resize === "function") art.resize();
    };
    art.on("video:loadedmetadata", applyRatio);
  }

  /** 停止容器内所有视频：HLS 销毁实例（停止后台拉分片），普通 MP4 暂停。
   *  删除卡片/关弹窗/视图切换/路由切换前调用，防止声音继续、流量空耗 */
  function disposeVideos(root) {
    // Artplayer 实例销毁（内部 video/事件/解码器），防止切页后后台续播耗流量。
    // 注意：Art 内部的 video.art-video 不匹配下方选择器，hls.js 实例必须在这里显式销毁，
    // 否则元素随 box 移除后 hls.js 的 worker/分片下载可能仍在后台进行。
    root.querySelectorAll(".essay-media-video--art").forEach(box => {
      try {
        const innerVideo = box._art && box._art.video;
        if (innerVideo) {
          if (innerVideo._hlsDispose) innerVideo._hlsDispose();
          if (innerVideo._hls) { innerVideo._hls.destroy(); innerVideo._hls = null; }
        }
        if (box._art) { box._art.destroy(true); box._art = null; }
      } catch { /* 忽略 */ }
      box.remove();
    });
    root.querySelectorAll("video.essay-media-video--hls").forEach(videoEl => {
      try {
        if (videoEl._hlsDispose) videoEl._hlsDispose();
        if (videoEl._hls) {
          videoEl._hls.destroy();
          videoEl._hls = null;
        }
        videoEl.pause();
        videoEl.removeAttribute("src");
        videoEl.load();
      } catch {
        /* 忽略 */
      }
    });
    // 普通 MP4（直 src）：暂停即可，无需移除 src（元素通常会随容器一起销毁）
    root.querySelectorAll("video.essay-media-video:not(.essay-media-video--hls)").forEach(videoEl => {
      try { videoEl.pause(); } catch { /* 忽略 */ }
    });
  }

  /* ================= 即刻瀑布流 ================= */

  let feedEls = []; // 与 state.feed 对齐的 li 元素
  // 瀑布流卡片高度自适应：图片晚到（waitForImages 单张仅等 1s 就超时放行）、视频起播后
  // 宽高比/限高突变、音乐卡异步内容等都会在 layout() 之后改变卡片高度，而绝对定位布局
  // 不会自动重排 → 卡片不定时重叠。RO 统一兜底：任何卡片尺寸变化都防抖重排。
  // 无死循环：重排只写 top/left/width，卡片自身高度不变，不会再次触发 RO。
  const feedRO = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onCardsResize) : null;
  let feedRafId = 0;
  function onCardsResize() {
    if (feedRafId) return;
    feedRafId = requestAnimationFrame(() => {
      feedRafId = 0;
      layout();
    });
  }
  /** feedEls 重新赋值后调用：断开旧观察，观察当前全部卡片（RO 初始会派发一次，幂等无害） */
  function syncFeedRO() {
    if (!feedRO) return;
    feedRO.disconnect();
    feedEls.forEach(el => el && feedRO.observe(el));
  }
  let resizeTimer = null;
  let loadMoreObserver = null;
  let resizeObserver = null; // 单例：renderFeed 多次调用时必须 disconnect 旧的，避免监听器泄漏

  function imagesGridHtml(m) {
    const images = m.images || [];
    if (!images.length) return "";
    const count = images.length;
    const mod = count === 1 ? "single" : count === 2 ? "double" : "multi";
    const cells = images
      .map(
        src => {
          const ts = thumbSrc(src);
          const orig = fullSrc(src);
          return `
      <a class="bber-content-img" data-lightbox="${esc(orig)}" rel="external nofollow noreferrer">
        <img src="${esc(ts)}" alt="${t("common.image")}" loading="lazy"${ts !== orig ? ` data-orig="${esc(orig)}"` : ""} />
        ${ts !== orig ? `<span class="img-orig-badge" title="${t("common.view_original")}">${t("common.original_badge")}</span>` : ""}
      </a>`;
        }
      )
      .join("");
    return `<div class="bber-container-img bber-img-${mod}">${cells}</div>`;
  }

  /**
   * 头像渲染：
   *  - http(s) 链接 → 图片
   *  - 否则 → 若传了 fallbackIcon（lucide key）用线性图标占位；否则用 fallbackChar 文本（昵称首字符）
   * 不再把非空文本当 emoji 渲染（全站去 emoji）。
   */
  function avatarSpanHtml(value, fallbackChar, extraClass, fallbackIcon) {
    const cls = "bber-author-avatar" + (extraClass ? " " + extraClass : "");
    if (/^https?:\/\//i.test(value || "")) {
      return `<span class="${cls}"><img src="${esc(value)}" alt="" loading="lazy" referrerpolicy="no-referrer" /></span>`;
    }
    if (fallbackIcon) {
      return `<span class="${cls} bber-author-avatar--fallback">${svgIcon(fallbackIcon, 22)}</span>`;
    }
    const txt = (value || "").trim() ? value : fallbackChar;
    return `<span class="${cls} bber-author-avatar--fallback">${esc(txt)}</span>`;
  }

  function momentCardHtml(m) {
    const s = state.settings;
    return `
    <li class="bber-item" data-id="${m.id}">
      <div class="bber-content">
        <div class="bber-author-row">
          <span class="bber-author">
            ${avatarSpanHtml(s.author_avatar, (s.author_name || "M").charAt(0))}
            <span class="bber-author-nickname">${esc(s.author_name || "Moments")}</span>
          </span>
          <span class="bber-post-tag bber-post-tag--moment">${t("feed.moment_tag")}</span>
        </div>
        <div class="datacont"><div class="m-xlate-content" data-mcontent>${renderContentHtml(m.content)}</div>${videosHtml(m)}</div>
        ${imagesGridHtml(m)}
      </div>
      <hr />
      <div class="bber-bottom">
        <div class="bber-info">
          <div class="bber-info-time">
            ${svgIcon("clock", 14)}
            <time class="datatime" datetime="${esc(m.created_at)}">${timeAgo(m.created_at)}</time>
          </div>
          ${m.location ? `<div class="bber-info-from">${svgIcon("locationDot", 14)}<span>${esc(m.location)}</span></div>` : ""}
        </div>
        <div class="bber-actions">
          <div class="bber-like ${m.liked ? "is-liked" : ""}" data-act="like" title="${m.liked ? t("feed.unlike") : t("feed.like")}">
            ${svgIcon(m.liked ? "heartFill" : "heartLine", 18)}
            ${m.like_count > 0 ? `<span class="bber-like-count">${m.like_count}</span>` : ""}
          </div>
          <div class="bber-reply" data-act="reply" title="${t("feed.comment")}">
            ${svgIcon("chat", 18)}
            ${m.comment_count > 0 ? `<span class="bber-reply-count">${m.comment_count}</span>` : ""}
          </div>
          ${xlateEnabled() && momentTranslatable(m.content) ? `<div class="bber-reply bber-xlate" data-act="xlate" title="${esc(t("translate.title"))}">${XLATE_GLOBE_SVG}</div>` : ""}
          ${state.admin ? `<div class="bber-reply bber-del" data-act="del" title="删除">${svgIcon("trash", 18)}</div>` : ""}
        </div>
      </div>
    </li>`;
  }

  /** 瀑布流布局（与原站算法一致） */
  function layout(force) {
    const container = document.getElementById("waterfall");
    if (!container || feedEls.length === 0) return;
    const width = container.offsetWidth;
    if (!width) return;

    const cols = width >= 1200 ? 3 : width >= 768 ? 2 : 1;
    const colWidth = (width - GAP * (cols - 1)) / cols;
    const heights = new Array(cols).fill(0);

    // 两阶段布局，避免“读 getBoundingClientRect → 写 style”逐元素交错造成的
    // 强制同步布局（layout thrashing）：卡片越多主线程被阻塞越久。
    // 阶段一：纯读取，浏览器至多做一次 reflow
    const measured = feedEls.map(el => (el ? el.getBoundingClientRect().height : 0));

    // 阶段二：纯写入
    feedEls.forEach((el, index) => {
      if (!el) return;
      let minH = Infinity;
      let col = 0;
      for (let i = 0; i < cols; i++) {
        if (heights[i] < minH) {
          minH = heights[i];
          col = i;
        }
      }
      const top = heights[col];
      const height = measured[index];
      el.style.position = "absolute";
      el.style.width = `${colWidth}px`;
      el.style.left = `${col * (colWidth + GAP)}px`;
      el.style.top = `${top}px`;
      el.style.transition = "left 0.3s ease, top 0.3s ease, width 0.3s ease";
      heights[col] = top + height + GAP;
    });

    const maxH = Math.max(...heights);
    container.style.height = `${maxH > 0 ? maxH - GAP : 0}px`;
  }

  /** 等待所有图片加载完成（单张超时 1s，与原站一致） */
  function waitForImages(container) {
    const images = Array.from(container.querySelectorAll("img"));
    if (images.length === 0) return Promise.resolve();
    return Promise.all(
      images.map(
        img =>
          new Promise(resolve => {
            if (img.complete && img.naturalHeight !== 0) {
              resolve();
              return;
            }
            let done = false;
            const cleanup = () => {
              if (done) return;
              done = true;
              img.removeEventListener("load", cleanup);
              img.removeEventListener("error", cleanup);
              window.clearTimeout(timer);
              resolve();
            };
            const timer = window.setTimeout(cleanup, LAYOUT_TIMEOUT);
            img.addEventListener("load", cleanup, { once: true });
            img.addEventListener("error", cleanup, { once: true });
          })
      )
    );
  }

  function observeLoadMore() {
    if (loadMoreObserver) loadMoreObserver.disconnect();
    const sentinel = document.getElementById("loadMore");
    if (!sentinel) return;
    loadMoreObserver = new IntersectionObserver(
      entries => {
        // 防重必须用真实的加载标志（旧代码的 busy 从未被赋值，恒为 false）；
        // loadFeed 内部也有同样守卫，这里提前拦截避免排队触发
        if (entries[0].isIntersecting && !state.feedLoading && !state.feedDone) loadFeed();
      },
      { rootMargin: "300px 0px 300px 0px", threshold: 0 }
    );
    loadMoreObserver.observe(sentinel);
  }

  function observeResize() {
    const container = document.getElementById("waterfall");
    if (!container) return;
    if (resizeObserver) resizeObserver.disconnect(); // 每次 renderFeed 复用单例，防止 RO 堆积
    let lastWidth = container.offsetWidth;
    const ro = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;
      const width = entry.contentRect.width;
      if (Math.abs(width - lastWidth) < 1) return;
      lastWidth = width;
      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => layout(), 50);
    });
    ro.observe(container);
    resizeObserver = ro;
  }

  function setLoadMoreText() {
    const el = document.getElementById("loadMore");
    if (!el) return;
    if (state.feedLoading) el.innerHTML = `<span class="spinner"></span><span>${t("feed.loading_more")}</span>`;
    else if (!state.feedDone) el.innerHTML = `<span>${t("feed.scroll_more")}</span>`;
    else el.innerHTML = state.feed.length ? `<span>${t("feed.reached_end")}</span>` : "";
  }

  function bannerHtml() {
    const s = state.settings;
    const bg = bannerInlineBg(s);
    const hasBannerBg = s.banner_bg_mode === "random" || /^https?:\/\//i.test(s.banner_bg_image || "");
    const customUrl = /^https?:\/\//i.test(s.banner_button_url || "") ? s.banner_button_url : "";
    return `
    <div class="banner-card">
      <div class="banner-inner${hasBannerBg ? " has-bg" : ""}"${hasBannerBg ? ` data-banner-bg="1"` : ""}${bg ? ` style="background-image:url('${esc(bg).replace(/'/g, "%27")}')"` : ""}>
        ${state.admin ? `<button type="button" class="essay-publish-fab" data-act="publish-fab" aria-label="发布说说" title="发布说说">${svgIcon("plus", 18)}</button>` : ""}
        <div class="banner-content">
          <div>
            <div class="banner-tips">${esc(s.essay_tips)}</div>
            <span class="banner-title">${esc(s.essay_title)}</span>
          </div>
          <div class="banner-bottom">
            <div class="banner-desc">${esc(s.essay_subtitle)}</div>
            ${customUrl
              ? `<button type="button" class="banner-button" data-act="banner-link" data-url="${esc(customUrl)}">${svgIcon("arrowUpRight", 20)}<span>${esc(s.essay_button_text)}</span></button>`
              : state.admin
                ? `<button type="button" class="banner-button" data-act="publish-fab">${svgIcon("arrowUpRight", 20)}<span>${esc(s.essay_button_text)}</span></button>`
                : `<button type="button" class="banner-button" data-act="unlock">${svgIcon("arrowUpRight", 20)}<span>解锁管理</span></button>`}
          </div>
        </div>
      </div>
    </div>`;
  }

  /** 站点图标值 → favicon href（仅图片 URL；留空用 lucide pen-nib SVG，不再用 emoji） */
  function iconToHref(v) {
    const val = String(v || "").trim();
    if (/^https?:\/\//i.test(val)) return val;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z'/><path d='m15 5 4 4'/></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

  /** 把站点设置应用到顶栏品牌名 / 导航文字 / 文档标题 */
  function applySettings() {
    const s = state.settings;
    // 表情包 URL 可能在后台变更，清缓存后下次打开面板重新拉取
    resetOwoCache();
    const iconLink = document.querySelector('link[rel="icon"]');
    if (iconLink) {
      const href = iconToHref(s.site_icon);
      const type = href.endsWith('.png') ? 'image/png'
        : href.endsWith('.jpg') || href.endsWith('.jpeg') ? 'image/jpeg'
        : href.endsWith('.svg') ? 'image/svg+xml'
        : href.endsWith('.ico') ? 'image/x-icon'
        : 'image/png';
      iconLink.type = type;
      iconLink.href = href;
    }
    document.querySelector(".brand-name").textContent = s.site_title;
    // 首页导航名：开启多语言时走词典；否则用后台自定义名称（桌面 + 移动端两处）
    document.querySelectorAll('[data-route="feed"]').forEach(a => {
      a.textContent = window.I18N && s.i18n_enabled ? t("nav.feed") : s.nav_feeds_name;
    });
    document.title = s.site_title;
    // 「关于」入口：about_enabled 开启时显示（桌面端 + 移动端）
    document.querySelectorAll(".about-nav-link").forEach(a => { a.hidden = !s.about_enabled; });
    // 「友情链接」「相册」入口独立开关
    document.querySelectorAll(".links-nav-link").forEach(a => { a.hidden = !s.links_enabled; });
    document.querySelectorAll(".photos-nav-link").forEach(a => { a.hidden = !s.photos_enabled; });
    // 「友圈」入口：friends_enabled 关闭时隐藏（桌面端 + 移动端）
    document.querySelectorAll(".friends-nav-link").forEach(a => { a.hidden = s.friends_enabled === false; });
    // 品牌头像：http(s) 链接渲染图片，否则用 lucide pen-nib 占位（不再用 emoji/文本）
    const avatarEl = document.querySelector(".brand-avatar");
    if (avatarEl) {
      if (/^https?:\/\//i.test(s.brand_avatar || "")) {
        avatarEl.innerHTML = `<img src="${esc(s.brand_avatar)}" alt="" referrerpolicy="no-referrer" />`;
      } else {
        avatarEl.innerHTML = svgIcon("pen-nib", 22);
      }
    }
    // 自定义导航项（每行 名称|链接），追加在"即刻"之后；重复应用先清理
    const nav = document.querySelector(".nav");
    if (nav) {
      nav.querySelectorAll(".custom-nav-link").forEach(a => a.remove());
      String(s.nav_links || "")
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean)
        .slice(0, 6)
        .forEach(line => {
          const sep = line.lastIndexOf("|");
          const label = sep > 0 ? line.slice(0, sep).trim() : line;
          const href = sep > 0 ? line.slice(sep + 1).trim() : "";
          if (!label || !/^https?:\/\//i.test(href)) return;
          const a = document.createElement("a");
          a.className = "custom-nav-link";
          a.href = href;
          a.target = "_blank";
          a.rel = "noopener";
          a.textContent = label;
          // 插到"后台"入口之前
          const adminLink = nav.querySelector('[data-route="admin"]');
          nav.insertBefore(a, adminLink || null);
        });
    }
    // 页脚：文案 + 网站运行时间
    applyFooter(s);
    applyMusicSettings();
    applySiteBgVars(s);
    applySiteBg(s);
  }

  /** 把后台玻璃参数（百分比/像素）换算为 CSS 变量注入根元素；
   *  暗色遮罩=亮色×0.81、暗色卡片≈亮色×0.92、顶栏=卡片×0.86，保持各面层次 */
  function applySiteBgVars(s) {
    const num = (v, dft, min, max) => {
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : dft;
    };
    const mask = num(s.site_bg_mask, 68, 0, 100) / 100;
    const card = num(s.site_bg_card, 72, 0, 100) / 100;
    const footer = num(s.site_bg_footer, 20, 0, 100) / 100;
    const blur = num(s.site_bg_blur, 16, 0, 40);
    const r = document.documentElement.style;
    r.setProperty("--sitebg-mask-a", mask.toFixed(3));
    r.setProperty("--sitebg-mask-a-dark", (mask * 0.81).toFixed(3));
    r.setProperty("--sitebg-card-a", card.toFixed(3));
    r.setProperty("--sitebg-card-a-dark", (card * 0.92).toFixed(3));
    r.setProperty("--sitebg-bar-a", (card * 0.86).toFixed(3));
    r.setProperty("--sitebg-bar-a-dark", (card * 0.92 * 0.88).toFixed(3));
    r.setProperty("--sitebg-footer-a", footer.toFixed(3));
    r.setProperty("--sitebg-blur", blur + "px");
  }

  /** 与后端 bg.ts hashStr 完全一致的字符串哈希（djb2 变体，用于 R2 背景缓存目录名） */
  function bgCacheHash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
    return h.toString(16);
  }

  /** 本站媒体文件识别：/media/ 路径 / 裸 key / 当前 R2·B2 域名直链 → key；外链返回 null */
  function localMediaKey(src) {
    const r2 = (state.settings?.r2_domain || "").replace(/\/$/, "");
    const b2 = (state.settings?.b2_domain || "").replace(/\/$/, "");
    const s = String(src || "");
    if (/^\/?media\//.test(s)) return s.replace(/^\/?media\//, "");
    if (/^(uploads|b2\/uploads)\//.test(s)) return s;
    if (/^https?:\/\//i.test(s) && ((r2 && s.startsWith(r2 + "/")) || (b2 && s.startsWith(b2 + "/")))) {
      return s.replace(/^https?:\/\/[^/]+\//i, "");
    }
    return null;
  }

  /** 本站文件 → 当前直连域名 URL（换域名随设置自动切换）；外链原样 */
  function bgDirectUrl(url) {
    const r2 = (state.settings?.r2_domain || "").replace(/\/$/, "");
    const b2 = (state.settings?.b2_domain || "").replace(/\/$/, "");
    const key = localMediaKey(url);
    if (!key) return url;
    // b2/ 前缀只走 B2 域名或 /media/ 签名代理，不能错拼到 R2 域名（与 keyToSrc 一致）
    if (key.startsWith("b2/")) return b2 ? b2 + "/" + key : "/media/" + key;
    if (r2) return r2 + "/" + key;
    return "/media/" + key;
  }

  /** 横幅模板内联背景 URL：random 与全站背景同 URL 共享缓存；
   *  static 动态接口不内联（直连会各自 302 到不同图），由 applySiteBg 解析后回填同一张 */
  function bannerInlineBg(s) {
    if (s.banner_bg_mode === "random") return (resolveSiteBgUrl(s) || {}).url || "";
    if (/^https?:\/\//i.test(s.banner_bg_image || "")) return (_bgResolved && _bgResolved.url) || "";
    return "";
  }

  /** 解析全站背景当前应使用的图片 URL（前台背景层与后台预览条共用同一逻辑）；
   *  random 模式 URL 带 bg_version，后台"换一张"后版本变化可击穿浏览器/边缘缓存；
   *  配了 R2 直连域名时直接取 R2 缓存图（走 EdgeOne 等加速域名，边缘命中比 /api/bg Worker 直出快） */
  function resolveSiteBgUrl(s) {
    if (s.banner_bg_mode === "random") {
      const h = Math.max(1, parseInt(s.banner_bg_interval, 10) || 24);
      const bucketH = String(Math.floor(Date.now() / (h * 3600000))); // 小时桶（缓存去重键）
      const bucketMs = Number(bucketH) * h * 3600000; // 毫秒桶（与后端 R2 缓存 key 一致）
      const v = encodeURIComponent(s.bg_version || "0");
      const r2 = (state.settings?.r2_domain || "").replace(/\/$/, "");
      const source = (s.banner_bg_source || "").trim();
      if (r2 && /^https:\/\//i.test(source) && source.includes("{seed}")) {
        return { url: `${r2}/bg/${bgCacheHash(source)}/${bucketMs}.jpg?v=${v}`, key: "bucket:" + bucketH + ":" + (s.bg_version || "0") };
      }
      return { url: `/api/bg?b=${bucketH}&v=${v}`, key: "bucket:" + bucketH + ":" + (s.bg_version || "0") };
    }
    if (/^https?:\/\//i.test(s.banner_bg_image || "")) {
      return { url: bgDirectUrl(s.banner_bg_image), key: "direct:" + s.banner_bg_image + ":" + (s.bg_version || "0") };
    }
    return null;
  }

  /** static 模式动态接口：经本站 /resolve 拿到 302 之后的最终图 URL，
   *  横幅与全站背景共用同一个最终 URL（直连动态接口时浏览器各请求各自跳转 → 两张图不一致）。
   *  每次页面加载解析一次并缓存；"换一张"时清缓存重新解析。 */
  let _bgResolved = null; // { key, url }
  async function ensureBgResolved(s) {
    if (s.banner_bg_mode === "random") return resolveSiteBgUrl(s);
    if (!/^https?:\/\//i.test(s.banner_bg_image || "")) return null;
    const key = "direct:" + s.banner_bg_image + ":" + (s.bg_version || "0");
    if (_bgResolved && _bgResolved.key === key) return _bgResolved;
    // 本站文件：直接归一化为当前直连域名 URL，无需走 /resolve 跟随 302
    const local = bgDirectUrl(s.banner_bg_image);
    if (local !== s.banner_bg_image) {
      _bgResolved = { key, url: local };
      return _bgResolved;
    }
    try {
      const r = await fetch("/api/bg/resolve", { cache: "no-store" });
      const j = await r.json();
      const u = j && j.data && /^https?:\/\//i.test(j.data.url || "") ? j.data.url : s.banner_bg_image;
      _bgResolved = { key, url: u };
    } catch {
      _bgResolved = { key, url: s.banner_bg_image };
    }
    return _bgResolved;
  }

  /** 把最终图 URL 同步到当前页面所有横幅（保证横幅与全站背景同一张图） */
  function applyBannerImages(url) {
    const safe = url.replace(/["\\]/g, encodeURIComponent);
    document.querySelectorAll(".banner-inner[data-banner-bg]").forEach(el => {
      el.style.backgroundImage = `url("${safe}")`;
    });
  }

  const siteBgEl = document.getElementById("siteBg");
  function applySiteBg(s) {
    if (!siteBgEl) return;
    document.body.classList.toggle("site-bg-on", !!s.site_bg_enabled);
    const reset = () => {
      siteBgEl.classList.remove("ready");
      siteBgEl.style.backgroundImage = "";
      delete siteBgEl.dataset.key;
    };
    const bgEnabled = !!s.site_bg_enabled;
    ensureBgResolved(s).then(bg => {
      // static 模式即使全站背景关闭，也要把解析出的最终 URL 同步给横幅（保证同图）
      if (!bg) { if (bgEnabled) reset(); return; }
      const { url, key } = bg;
      if (siteBgEl.dataset.key !== key) applyBannerImages(url);
      if (!bgEnabled) { reset(); return; }
      if (siteBgEl.dataset.key === key && siteBgEl.classList.contains("ready")) return;
      siteBgEl.dataset.key = key;
      const tryLoad = obj => {
        const img = new Image();
        img.onload = () => {
          if (!state.settings.site_bg_enabled) return; // 预载期间开关被关
          if (siteBgEl.dataset.key !== key) return; // 期间已切换模式/跨桶
          siteBgEl.style.backgroundImage = `url("${obj.url.replace(/["\\]/g, encodeURIComponent)}")`;
          siteBgEl.classList.add("ready");
          applyBannerImages(obj.url); // 用已加载缓存里的图刷一次横幅，避免各走各的请求
        };
        img.onerror = () => {
          // R2 直连缓存图加载失败（如加速域名故障）→ 回退本站 /api/bg Worker 直出；再失败保持纯色底
          if (s.banner_bg_mode === "random" && !obj.fallback) {
            const h = Math.max(1, parseInt(s.banner_bg_interval, 10) || 24);
            const bucketH = String(Math.floor(Date.now() / (h * 3600000)));
            tryLoad({ url: `/api/bg?b=${bucketH}&v=${encodeURIComponent(s.bg_version || "0")}`, fallback: true });
            return;
          }
          if (siteBgEl.dataset.key === key) reset();
        };
        img.src = obj.url;
      };
      tryLoad(bg);
    });
  }

  // 页脚运行时间计时器 id
  let footerRuntimeTimer = null;
  function applyFooter(s) {
    const footer = document.getElementById("siteFooter");
    if (!footer) return;
    const textEl = footer.querySelector("[data-footer-text]");
    const runtimeEl = footer.querySelector("[data-footer-runtime]");
    const hasText = !!(s.footer_text || "").trim();
    const since = (s.footer_run_since || "").trim();
    const show = hasText || since;
    footer.hidden = !show;
    textEl.innerHTML = hasText ? String(s.footer_text) : "";

    if (footerRuntimeTimer) { clearInterval(footerRuntimeTimer); footerRuntimeTimer = null; }
    if (!since) { runtimeEl.hidden = true; return; }
    const start = new Date(since).getTime();
    if (!Number.isFinite(start) || start >= Date.now()) { runtimeEl.hidden = true; return; }

    const pad = n => String(n).padStart(2, "0");
    const tick = () => {
      const diff = Math.max(0, Date.now() - start);
      const sec = Math.floor(diff / 1000);
      const days = Math.floor(sec / 86400);
      const hours = Math.floor((sec % 86400) / 3600);
      const mins = Math.floor((sec % 3600) / 60);
      const secs = sec % 60;
      runtimeEl.textContent = t("common.footer_runtime", { days, hh: pad(hours), mm: pad(mins), ss: pad(secs) });
      runtimeEl.hidden = false;
    };
    tick();
    footerRuntimeTimer = setInterval(tick, 1000);
  }

  /** 幂等应用音乐播放器设置（初始折叠/音量）。
   *  settings 任何时刻更新（启动/后台保存/bfcache 恢复）都同步到播放器。 */
  function applyMusicSettings() {
    if (!musicCapsule) return;
    const s = state.settings;
    if (!s.music_enable) return;
    const vol = Math.max(0, Math.min(1, Number(s.music_volume) || 0.7));
    if (!state.music.isPlaying) setMusicVolume(vol);
    if (s.music_collapsed) setCapsuleCollapsed(true);
  }

  function commentSectionHtml() {
    return `
    <div class="link-comment-section">
      <div id="post-comment" class="comment-container">
        <div class="comment-head">
          ${svgIcon("chat", 22)}
          <span class="comment-title">${t("comment.title")}</span>
          <span class="comment-count-tag" data-comment-count>0</span>
        </div>
        <div data-comment-body>
          <div class="comment-hint">${t("comment.feed_hint")}</div>
        </div>
      </div>
    </div>`;
  }

  function renderFeed() {
    state.activeView = "feed";
    const s0 = state.settings;
    const fq = new URLSearchParams(location.search).get("q") || "";
    setSeo({
      title: fq ? t("feed.search_title", { q: fq, site: s0.site_title }) : s0.site_title,
      description: s0.essay_subtitle,
      path: fq ? "/?q=" + encodeURIComponent(fq) : "/",
      image: s0.banner_bg_mode === "random" ? location.origin + "/api/bg" : s0.banner_bg_image,
    });
    state.feed = [];
    state.cursor = null;
    state.feedDone = false;
    feedEls = [];
    syncFeedRO(); // 首页重建，断开旧卡片观察
    state.commentTarget = null;
    const filterBanner = fq ? `
      <div class="feed-filter-bar">
        <span>${t("feed.filter_only", { q: "<b>" + esc(fq) + "</b>" })}</span>
        <a class="feed-filter-clear" href="/" data-route="feed">${t("feed.clear_filter")}</a>
      </div>` : "";
    app.innerHTML = `
      <div class="essay">
        ${bannerHtml()}
        ${filterBanner}
        <div class="essay-list-container">
          <div class="essay-content-wrapper">
            <div class="layout-loading-placeholder">
              <div style="display:flex;flex-direction:column;align-items:center;gap:1rem;padding:2rem">
                <span class="spinner"></span><span style="font-size:.875rem;font-weight:500">${t("common.loading")}</span>
              </div>
            </div>
            <section class="timeline is-hidden">
              <ul id="waterfall" class="list" style="position:relative"></ul>
            </section>
          </div>
          <div class="essay-loadmore" id="loadMore"></div>
        </div>
      </div>`;
    observeLoadMore();
    observeResize();
    loadFeed();
  }

  /** 时间线中的文章卡片：只显示封面 + 标题 + 摘要，点击进入文章详情 */
  function postFeedCardHtml(p) {
    return `
    <li class="bber-item bber-item--post${p.pinned ? " bber-item--pinned" : ""}">
      <a class="bber-post-link" href="/post/${encodeURIComponent(p.slug)}">
        <div class="bber-author-row">
          <span class="bber-author">
            ${avatarSpanHtml(state.settings.post_avatar, "", "bber-author-avatar--post", "file-text")}
            <span class="bber-author-nickname">${t("posts.tag")}</span>
          </span>
          ${p.pinned
            ? `<span class="bber-post-tag bber-post-tag--pinned">${svgIcon("pin", 12)}<span>${t("feed.pinned")}</span></span>`
            : `<span class="bber-post-tag">${t("posts.tag")}</span>`}
        </div>
        ${p.cover ? `<div class="bber-post-cover"><img src="${esc(thumbSrc(p.cover))}" alt="" loading="lazy" referrerpolicy="no-referrer" data-orig="${esc(p.cover)}" /></div>` : ""}
        <div class="bber-post-title">${esc(p.title)}</div>
        ${p.excerpt ? `<div class="bber-post-excerpt">${esc(p.excerpt)}</div>` : ""}
        <hr />
        <div class="bber-bottom">
          <div class="bber-info">
            <div class="bber-info-time">
              ${svgIcon("clock", 14)}
              <time datetime="${esc(p.created_at)}">${timeAgo(p.created_at)}</time>
            </div>
          </div>
          <div class="bber-actions"><span class="bber-post-read">${t("feed.read_full")}</span></div>
        </div>
      </a>
    </li>`;
  }

  /** 时间线条目：说说 / 文章 各走各的卡片模板 */
  function feedItemHtml(it) {
    return it.kind === "post" ? postFeedCardHtml(it) : momentCardHtml(it);
  }

  /** 评论内容 @ 提及高亮：转义后包裹 @username */
  /** 解析时间戳字符串 → 秒数（支持 分:秒 和 时:分:秒） */
  function parseTimestamp(ts) {
    const p = ts.split(":").map(Number);
    return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
  }
  function formatCommentContent(text) {
    return owoTokenToImg(reactionTokenToSvg(esc(text)))
      .replace(/@([^\s@<>，。！？、（）]+)/g, '<span class="comment-mention">@$1</span>')
      // 评论时间戳锚点：0:00 / 12:34 / 1:23:45 → 可点击跳转视频
      .replace(/(^|[^0-9:])(\d{1,2}):(\d{2})(?::(\d{2}))?($|[^0-9:])/g,
        (_, pre, a, b, c, post) => {
          const ts = c ? `${a}:${b}:${c}` : `${a}:${b}`;
          return `${pre}<a href="#" class="comment-timestamp" data-ts="${ts}">${a}:${b}${c ? ":" + c : ""}</a>${post}`;
        });
  }

  /* ================= 评论增强：表情 / 图片 / 随机评论 ================= */

  // 评论表情：改用精选 lucide 线性小图标（全站去 emoji）。
  // 点击图标插入短码 token「:key:」，渲染时由 formatCommentContent 转成内联 SVG。
  const REACTION_ICONS = [
    { k: "smile" }, { k: "heart" }, { k: "thumbs-up" }, { k: "star" },
    { k: "party-popper" }, { k: "flame" }, { k: "coffee" }, { k: "sparkles" },
    { k: "music" }, { k: "gift" }, { k: "sunLine" },
  ];

  /** 将表情图标集合渲染为可点击的网格（每个格子是 lucide 图标） */
  function reactionGridHtml() {
    return REACTION_ICONS.map(r =>
      `<button type="button" class="emoji-cell" data-reaction="${r.k}" title=":${r.k}:">${svgIcon(r.k, 20)}</button>`
    ).join("");
  }

  /** 评论表情短码 → 内联 SVG（供 formatCommentContent 用） */
  function reactionTokenToSvg(text) {
    return text.replace(/:([a-z-]+):/g, (m, key) => {
      if (REACTION_ICONS.some(r => r.k === key)) {
        return `<span class="comment-reaction">${svgIcon(key, 18)}</span>`;
      }
      return m;
    });
  }

  /* ---------- OwO 表情包（后台 comment_emoji_owo_url 指向的 owo.json） ---------- */
  let owoPacksCache = null; // [{ name, items:[{ token, slug, url }] }]
  let owoSlugMap = null; // slug -> 图片 url
  /** 加载并解析 OwO 包；失败返回空数组，不影响 lucide 默认表情 */
  async function loadOwoPacks() {
    if (owoPacksCache) return owoPacksCache;
    owoPacksCache = [];
    owoSlugMap = {};
    const url = (state.settings?.comment_emoji_owo_url || "/owo.json").trim() || "/owo.json";
    try {
      const r = await fetch(url, { cache: "no-cache" });
      if (!r.ok) throw new Error("owo http " + r.status);
      const data = await r.json();
      for (const [name, pack] of Object.entries(data)) {
        if (!pack || pack.type !== "image" || !Array.isArray(pack.container)) continue;
        const items = [];
        for (const it of pack.container) {
          if (!it || !it.icon) continue;
          const m = String(it.icon).match(/src\s*=\s*["']([^"']+)["']/i);
          if (!m) continue;
          let token = it.data && String(it.data).trim() ? String(it.data).trim() : `::(${it.text})`;
          if (!/^::\(.+\)$/.test(token)) token = `::(${token.replace(/^::\(|\)$/g, "")})`;
          const slug = token.slice(3, -1); // 去掉 ::( 与 )
          items.push({ token, slug, url: m[1] });
          if (!(slug in owoSlugMap)) owoSlugMap[slug] = m[1];
        }
        if (items.length) owoPacksCache.push({ name, items });
      }
    } catch (e) {
      console.warn("[owo] 表情包加载失败：", e);
    }
    return owoPacksCache;
  }
  /** 评论里 ::(slug): → <img>（供 formatCommentContent 用） */
  function owoTokenToImg(text) {
    if (!owoSlugMap) return text;
    return text.replace(/::\(([^()\n]+)\)/g, (m, slug) => {
      const u = owoSlugMap[slug];
      return u ? `<img class="comment-emoji" src="${esc(u)}" alt="${esc(slug)}" loading="lazy">` : m;
    });
  }
  /** 清空 OwO 缓存（后台更换表情包 URL 后调用） */
  function resetOwoCache() {
    owoPacksCache = null;
    owoSlugMap = null;
  }

  // 随机评论库（50 条，4 类）
  const RANDOM_COMMENTS = [
    // 夸赞类
    "写得真好，收藏了！", "太有才了吧！", "这篇文章质量很高，感谢分享", "博主写的太好了，学到了", "干货满满，已收藏", "写得非常详细，赞一个", "这也太厉害了吧！", "文章写得真棒，持续关注中", "优质内容，支持博主！", "太赞了，迫不及待想看更多", "这篇必须点赞，太实用了", "博主真是才华横溢！",
    // 幽默类
    "笑死我了", "这篇文章把我看饿了", "博主你是不是偷偷开了挂？", "我看完了，然后忘了我在干嘛", "这文笔，不去写小说可惜了", "哈哈哈哈太真实了", "看完感觉智商被碾压了", "这篇内容比我的饭还香", "笑不活了，博主是懂幽默的", "看完我直接原地转圈", "这操作我给满分", "博主你是懂生活的",
    // 互动类
    "学到了，感谢博主分享", "刚好需要这个，太及时了", "博主能详细讲讲这个吗？", "收藏了，以后慢慢看", "转发给朋友一起学习", "请问有后续更新吗？期待", "已关注，持续学习中", "这个观点很有启发，谢谢", "做笔记了，受益匪浅", "正好在研究这个，太有帮助了", "已实践，效果很好感谢", "博主能出个系列吗？想看更多",
    // 日常类
    "打卡签到", "路过留个脚印", "每天必看博主的更新", "今天也是元气满满的一天", "摸鱼时看到这篇，值了", "深夜刷到好文，满足了", "上班偷偷看完了哈哈哈", "坐等更新！", "默默支持博主", "又到了催更的时候了", "第一次留言，支持一下", "前排围观！", "沙发！第一！" 
  ];

  /** 当前表情面板活动 textarea 引用 */
  let emojiPanelTarget = null;

  /** 向当前表情面板目标 textarea 的光标处插入文本 */
  function insertIntoTarget(token) {
    const ta = emojiPanelTarget;
    if (!ta) return;
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    ta.value = ta.value.slice(0, start) + token + ta.value.slice(end);
    ta.selectionStart = ta.selectionEnd = start + token.length;
    ta.focus();
  }

  /** 渲染某分类表情网格：type=lucide 用内置图标，type=owo 用图片 */
  function emojiGridHtml(type, pack) {
    if (type === "lucide") return reactionGridHtml();
    return pack.items.map(it =>
      `<button type="button" class="emoji-cell" data-owo="${esc(it.token)}" title="${esc(it.slug)}"><img src="${esc(it.url)}" alt="${esc(it.slug)}" loading="lazy"></button>`
    ).join("");
  }

  /** 打开/关闭表情面板（默认 lucide + 后台 OwO 包，多 Tab），定位在 textarea 上方 */
  async function toggleEmojiPanel(textarea) {
    let panel = document.getElementById("emojiPanel");
    if (panel && panel.dataset.targetId === textarea.id) {
      panel.remove();
      return;
    }
    if (panel) panel.remove();
    emojiPanelTarget = textarea;
    const packs = await loadOwoPacks();
    panel = document.createElement("div");
    panel.id = "emojiPanel";
    panel.className = "emoji-panel";
    panel.dataset.targetId = textarea.id || "";
    // 分类：只保留后台 OwO 图片包（去掉 lucide 默认 Tab）
    const tabs = packs.map((p, i) => ({ t: "owo", name: p.name, idx: i }));
    panel.innerHTML = `
      <div class="emoji-tabs">
        ${tabs.map((tb, i) => `<button type="button" class="emoji-tab${i === 0 ? " is-active" : ""}" data-etab="${i}">${esc(tb.name)}</button>`).join("")}
      </div>
      <div class="emoji-grid" data-emoji-grid></div>
    `;
    const grid = panel.querySelector("[data-emoji-grid]");
    function renderTab(i) {
      const tb = tabs[i];
      grid.innerHTML = tb.t === "lucide" ? emojiGridHtml("lucide") : emojiGridHtml("owo", packs[tb.idx]);
    }
    renderTab(0);
    panel.querySelector(".emoji-tabs").addEventListener("click", e => {
      const btn = e.target.closest && e.target.closest("[data-etab]");
      if (!btn) return;
      panel.querySelectorAll(".emoji-tab").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      renderTab(Number(btn.dataset.etab));
    });
    // 定位
    const rect = textarea.getBoundingClientRect();
    panel.style.position = "fixed";
    panel.style.left = rect.left + "px";
    panel.style.bottom = (window.innerHeight - rect.top + 4) + "px";
    panel.style.zIndex = "10001";
    document.body.appendChild(panel);
    // 点击格子：插入对应 token（lucide→:key:，owo→::(slug)）
    panel.addEventListener("click", e => {
      const cell = e.target.closest && e.target.closest("[data-reaction], [data-owo]");
      if (!cell || !emojiPanelTarget) return;
      insertIntoTarget(cell.dataset.reaction ? `:${cell.dataset.reaction}:` : cell.dataset.owo);
    });
    // 点击面板外部关闭
    setTimeout(() => {
      document.addEventListener("click", closeEmojiOnOutside, { once: true });
    }, 0);
  }

  function closeEmojiOnOutside(e) {
    const panel = document.getElementById("emojiPanel");
    if (panel && !panel.contains(e.target) && !e.target.closest("[data-emoji-btn]")) {
      panel.remove();
    } else if (panel) {
      // 重新监听
      setTimeout(() => {
        document.addEventListener("click", closeEmojiOnOutside, { once: true });
      }, 0);
    }
  }

  /** 评论图片状态（每个评论表单独立维护） */
  const commentImages = new Map(); // form element -> string[]

  /** 获取评论表单的图片列表 */
  function getCommentImages(form) {
    return commentImages.get(form) || [];
  }

  /** 设置评论表单的图片列表并刷新预览 */
  function setCommentImages(form, urls) {
    commentImages.set(form, urls);
    const preview = form.querySelector("[data-comment-img-preview]");
    if (preview) {
      preview.innerHTML = urls.map((url, i) =>
        `<div class="comment-img-thumb" data-img-idx="${i}">
          <img src="${esc(url)}" alt="" loading="lazy" referrerpolicy="no-referrer" />
          <button type="button" class="comment-img-del" data-img-del="${i}">×</button>
        </div>`
      ).join("");
      preview.style.display = urls.length ? "flex" : "none";
    }
  }

  /** 添加评论图片（本地上传或网络 URL），最多 3 张 */
  async function addCommentImage(form, url) {
    const list = getCommentImages(form);
    if (list.length >= 3) return toast(t("comment.image_max", { n: 3 }));
    list.push(url);
    setCommentImages(form, list);
  }

  /** 评论表单图片上传处理 */
  async function handleCommentImageUpload(form, file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast(t("comment.image_size_limit", { size: "5MB" }));
    const btn = form.querySelector("[data-img-upload-btn]");
    if (btn) { btn.disabled = true; btn.textContent = t("common.uploading"); }
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/comment-upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json.data?.src) throw new Error(json.message || t("common.upload_failed"));
      const full = /^https?:\/\//i.test(json.data.src) ? json.data.src : location.origin + json.data.src;
      await addCommentImage(form, full);
    } catch (err) {
      toast(err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = svgIcon("image", 18); }
    }
  }

  /** 随机评论填入 textarea */
  function fillRandomComment(textarea) {
    const msg = RANDOM_COMMENTS[Math.floor(Math.random() * RANDOM_COMMENTS.length)];
    textarea.value = msg;
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
  }

  /** 为评论表单绑定增强功能（表情/图片/随机评论） */
  function bindCommentToolbar(form) {
    const ta = form.content;
    if (!ta) return;

    // SSR 直出的评论表单不含交互工具栏/图片预览/回复订阅开关，水合时补齐（与前端渲染版一致）
    if (!form.querySelector(".comment-toolbar")) {
      const tb = document.createElement("div");
      tb.className = "comment-toolbar";
      tb.innerHTML = `
        <button type="button" class="comment-tool-btn" data-emoji-btn title="${t("comment.owo")}">${svgIcon("smile", 18)}</button>
        <button type="button" class="comment-tool-btn" data-img-upload-btn title="${t("comment.upload_image")}">${svgIcon("image", 18)}</button>
        <input type="file" accept="image/*" data-img-file hidden />
        <input type="text" class="comment-img-url-input" data-img-url-input placeholder="${t("comment.image_url_ph")}" maxlength="500" />
        <button type="button" class="comment-tool-btn comment-random-btn" data-random-comment title="${t("comment.random_one")}">${svgIcon("dices", 18)}</button>`;
      form.insertBefore(tb, ta);
    }
    if (!form.querySelector(".comment-img-preview")) {
      const pv = document.createElement("div");
      pv.className = "comment-img-preview";
      pv.style.display = "none";
      const foot = form.querySelector(".comment-form-foot");
      if (foot) foot.insertAdjacentElement("beforebegin", pv);
      else form.appendChild(pv);
    }
    if (!form.querySelector(".comment-notify-row")) {
      const nr = document.createElement("label");
      nr.className = "comment-notify-row";
      nr.innerHTML = `<input type="checkbox" name="notify_reply" value="1" checked /> ${t("comment.notify_mine")}`;
      const foot = form.querySelector(".comment-form-foot");
      if (foot) foot.insertAdjacentElement("beforebegin", nr);
      else form.appendChild(nr);
    }

    // 表情按钮
    const emojiBtn = form.querySelector("[data-emoji-btn]");
    if (emojiBtn) {
      emojiBtn.addEventListener("click", () => toggleEmojiPanel(ta));
    }

    // 图片上传按钮
    const uploadBtn = form.querySelector("[data-img-upload-btn]");
    const fileInput = form.querySelector("[data-img-file]");
    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", async () => {
        const file = fileInput.files[0];
        if (file) await handleCommentImageUpload(form, file);
        fileInput.value = "";
      });
    }

    // 网络图片 URL 输入
    const urlInput = form.querySelector("[data-img-url-input]");
    if (urlInput) {
      urlInput.addEventListener("keydown", async e => {
        if (e.key === "Enter") {
          e.preventDefault();
          const url = urlInput.value.trim();
          if (!url) return;
          if (!/^https?:\/\//i.test(url)) return toast(t("comment.image_url_invalid"));
          await addCommentImage(form, url);
          urlInput.value = "";
        }
      });
    }

    // 图片删除
    form.addEventListener("click", e => {
      const del = e.target.closest("[data-img-del]");
      if (del) {
        const idx = Number(del.dataset.imgDel);
        const list = getCommentImages(form);
        list.splice(idx, 1);
        setCommentImages(form, list);
      }
    });
  }

  /** 单条评论（isReply=true 时为楼中楼回复，小头像；rootId 为所属根评论 id） */
  function commentItemHtml(cm, isReply, rootId) {
    let avatarInner;
    if (cm.is_ai) {
      // AI 机器人：图片 URL 用 img，否则用 lucide bot 图标占位（不再用 emoji）
      const botAv = state.settings?.ai_bot_avatar || "";
      avatarInner = /^https?:\/\//i.test(botAv)
        ? `<img class="comment-avatar comment-avatar--img comment-avatar--ai" src="${esc(botAv)}" alt="" referrerpolicy="no-referrer" loading="lazy" data-n="AI" onerror="commentAvatarFail(this)" />`
        : `<span class="comment-avatar comment-avatar--ai">${svgIcon("bot", 20)}</span>`;
    } else if (cm.avatar_url) {
      avatarInner = `<img class="comment-avatar comment-avatar--img" src="${esc(cm.avatar_url)}" alt="" referrerpolicy="no-referrer" loading="lazy" data-n="${esc((cm.nickname || "?").slice(0, 1))}" onerror="commentAvatarFail(this)" />`;
    } else {
      avatarInner = `<span class="comment-avatar">${esc((cm.nickname || "?").slice(0, 1).toUpperCase())}</span>`;
    }
    const avatar = cm.website
      ? `<a class="comment-avatar-link" href="${esc(cm.website)}" target="_blank" rel="external nofollow noreferrer" title="${esc(cm.website)}">${avatarInner}</a>`
      : avatarInner;
    const root = rootId || cm.id;
    // 解析评论图片
    let imgs = [];
    try { imgs = cm.images ? JSON.parse(cm.images) : []; } catch {}
    return `
    <div class="comment-item${isReply ? " comment-item--reply" : ""}${cm.is_ai ? " comment-item--ai" : ""}" data-comment-id="${cm.id}">
      ${avatar}
      <div class="comment-body">
        <div>
          <span class="comment-name">${esc(cm.nickname)}</span>
          ${cm.is_ai ? '<span class="badge-ai">AI</span>' : cm.is_owner ? `<span class="badge-owner">${t("comment.owner_badge")}</span>` : ""}
          <span class="comment-time">${timeAgo(cm.created_at)}</span>
        </div>
        <div class="comment-text">${formatCommentContent(cm.content)}</div>
        ${imgs.length ? `<div class="comment-images">${imgs.map(u => { const ts = thumbSrc(u); const orig = fullSrc(u); return `<img src="${esc(ts)}" alt="" loading="lazy" referrerpolicy="no-referrer" class="comment-img" data-lightbox="${esc(orig)}" data-comment-img="${esc(orig)}"${ts !== orig ? ` data-orig="${esc(orig)}"` : ""} />`; }).join("")}</div>` : ""}
        <div class="comment-actions">
          <button type="button" class="comment-reply-btn" data-reply-root="${root}" data-reply-name="${esc(cm.nickname)}">${t("common.reply")}</button>
        </div>
      </div>
    </div>`;
  }

  /* ================= 楼中楼回复：分组 / 折叠 / 一键 @ ================= */
  const REPLY_PREVIEW_COUNT = 2;   // 折叠态每个楼下默认显示最新回复数
  const TOP_COMMENT_PREVIEW = 20;  // 顶级评论过多时默认显示条数
  // 弹窗级 UI 状态：展开的楼集合 / 是否显示全部顶级评论 / 当前回复目标
  const commentUi = { expandedThreads: new Set(), showAll: false, replyRoot: 0, replyName: "" };

  /** 扁平评论 → 两级树：根评论新评论在前（倒序），楼中楼回复按 id 升序保证对话可读 */
  function groupComments(list) {
    const roots = [];
    const map = new Map();
    (list || []).forEach(cm => {
      if (cm.parent_id > 0) return;
      const node = { ...cm, replies: [] };
      map.set(cm.id, node);
      roots.push(node);
    });
    (list || []).forEach(cm => {
      if (cm.parent_id > 0) {
        const root = map.get(cm.parent_id);
        if (root) root.replies.push(cm);
        else roots.push({ ...cm, replies: [] }); // 父评论丢失时兜底为顶级
      }
    });
    roots.reverse(); // 新评论显示在最上方
    roots.forEach(r => r.replies.sort((a, b) => a.id - b.id));
    return roots;
  }

  /** 单个楼层（根评论 + 回复列表，回复过多时折叠） */
  function commentThreadHtml(node) {
    const total = node.replies.length;
    const expanded = commentUi.expandedThreads.has(node.id);
    const collapsible = total > REPLY_PREVIEW_COUNT;
    const visibleReplies = !expanded && collapsible ? node.replies.slice(-REPLY_PREVIEW_COUNT) : node.replies;
    const toggleHtml = (label) =>
      `<button type="button" class="comment-replies-toggle" data-replies-toggle="${node.id}">${label}</button>`;
    if (!total) {
      return `<div class="comment-thread" data-thread-id="${node.id}">${commentItemHtml(node, false, node.id)}</div>`;
    }
    return `
    <div class="comment-thread" data-thread-id="${node.id}">
      ${commentItemHtml(node, false, node.id)}
      <div class="comment-replies">
        ${collapsible && !expanded ? toggleHtml(t("comment.expand_replies", { n: total })) : ""}
        <div class="comment-replies-list">
          ${visibleReplies.map(cm => commentItemHtml(cm, true, node.id)).join("")}
        </div>
        ${collapsible && expanded ? toggleHtml(t("comment.collapse_replies")) : ""}
      </div>
    </div>`;
  }

  /** 整个评论列表 HTML（顶级评论过多时折叠）；无评论返回空串 */
  function renderCommentListHtml(comments) {
    const threads = groupComments(comments);
    if (!threads.length) return "";
    const visible = commentUi.showAll ? threads : threads.slice(0, TOP_COMMENT_PREVIEW);
    const hiddenCount = threads.length - visible.length;
    return visible.map(commentThreadHtml).join("") +
      (hiddenCount > 0
        ? `<button type="button" class="comments-more-toggle" data-comments-toggle>${t("comment.expand_more", { n: hiddenCount })}</button>`
        : commentUi.showAll && threads.length > TOP_COMMENT_PREVIEW
          ? `<button type="button" class="comments-more-toggle" data-comments-toggle>${t("comment.hide")}</button>`
          : "");
  }

  /** 用 state.commentTarget 的缓存重新渲染当前评论弹窗列表 */
  function rerenderCommentList() {
    const target = state.commentTarget;
    const list = document.querySelector("[data-comment-list]");
    if (!target || !list) return;
    const html = renderCommentListHtml(target.comments || []);
    list.innerHTML = html || `<div class="comment-hint">${t("comment.empty_first")}</div>`;
  }

  /** 一键回复：记录根评论、文本框自动带入 @昵称、显示回复提示条 */
  function startCommentReply(rootId, name) {
    const form = document.querySelector("[data-comment-form]");
    if (!form) return;
    const ta = form.content;
    // 切换回复对象时，去掉旧的 @昵称 前缀
    if (commentUi.replyRoot && commentUi.replyName) {
      const oldPrefix = `@${commentUi.replyName} `;
      if (ta.value.startsWith(oldPrefix)) ta.value = ta.value.slice(oldPrefix.length);
    }
    commentUi.replyRoot = rootId;
    commentUi.replyName = name;
    form.dataset.parentId = String(rootId);

    let bar = form.querySelector("[data-reply-bar]");
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "comment-reply-bar";
      bar.setAttribute("data-reply-bar", "");
      bar.innerHTML = `${t("comment.reply_giving")} <b class="comment-reply-to"></b><button type="button" class="comment-reply-cancel" data-cancel-reply aria-label="${t("comment.cancel_reply")}">×</button>`;
      form.prepend(bar);
    }
    bar.querySelector(".comment-reply-to").textContent = `@${name}`;

    ta.value = `@${name} ${ta.value.trimStart()}`;
    ta.focus();
    const len = ta.value.length;
    ta.setSelectionRange(len, len);
  }

  /** 取消回复状态（不动文本框内容，由调用方决定是否清空） */
  function resetReplyTarget(form) {
    if (!form) return;
    delete form.dataset.parentId;
    commentUi.replyRoot = 0;
    commentUi.replyName = "";
    form.querySelector("[data-reply-bar]")?.remove();
  }

  const QQ_NUM_RE = /^[1-9]\d{4,11}$/;

  /** 过滤占位/示例网址，避免默认显示 https://example.com 等测试值 */
  const EXAMPLE_URL_RE = /^(https?:\/\/)?(example\.com|example\.org|test\.com|localhost|127\.0\.0\.1)/i;
  function getSavedWebsite() {
    const v = (localStorage.getItem("moments_website") || "").trim();
    if (!v || EXAMPLE_URL_RE.test(v)) return "";
    return v;
  }

  /** 评论身份：单个输入框既可填昵称也可填 QQ 号
   *  - 输入符合 QQ 号格式（5-12 位数字）时自动调 /api/qq-info 获取昵称/邮箱/头像
   *  - 获取成功后用昵称覆盖输入框值，并清空 form.dataset.qq 允许重新填写
   *  - 手动输入昵称时，若无头像则同步显示昵称首字做头像回退
   */

  /** AI 机器人开启时，在评论框上方插入「召唤 @小J」提示条，点击自动填入 @昵称 */
  function injectAiHint(form) {
    const s = state.settings;
    if (!s?.ai_reply_enabled) return;
    if (form.querySelector("[data-ai-hint]")) return;
    const botName = s.ai_bot_name || "小J";
    const ta = form.querySelector('textarea[name="content"]');
    if (!ta) return;
    const bar = document.createElement("div");
    bar.className = "comment-ai-hint";
    bar.setAttribute("data-ai-hint", "");
    bar.innerHTML = `<span>${svgIcon("message-circle", 16)} ${t("comment.ai_hint", { name: botName })}</span><button type="button" class="comment-ai-mention-btn">@<b></b></button>`;
    bar.querySelector(".comment-ai-mention-btn b").textContent = botName;
    bar.querySelector(".comment-ai-mention-btn").addEventListener("click", () => {
      const prefix = `@${botName} `;
      ta.value = ta.value.includes(`@${botName}`) ? ta.value : prefix + ta.value;
      ta.focus();
      const len = ta.value.length;
      ta.setSelectionRange(len, len);
    });
    ta.insertAdjacentElement("beforebegin", bar);
  }

  /**
   * 发送 @机器人 评论后轻量轮询评论列表（AI 回复是异步生成的）。
   * 只更新数据并重渲染，不重置楼中楼展开状态；切走目标/关闭弹窗后自动停止。
   */
  function pollAiReplies(target) {
    if (!state.settings?.ai_reply_enabled) return;
    // 三次轮询的相对延迟（提交后 6s / 14s / 26s），AI 生成通常 5-15 秒
    const delays = [6000, 8000, 12000];
    const seen = new Set((target.comments || []).map(c => Number(c.id)));
    let found = 0;
    const tick = async attempt => {
      // 弹窗/页面已切到其他目标，停止轮询
      if (state.commentTarget !== target) return;
      try {
        let comments, count;
        if (target.ctype === "post") {
          const data = await api(`/api/posts/${encodeURIComponent(target.slug)}/comments`);
          comments = data.list || [];
          count = Number(data.count) || comments.length;
        } else {
          const detail = await api(`/api/moments/${target.cid}?voter_id=${encodeURIComponent(state.voterId)}`);
          comments = detail.comments || [];
          count = detail.comment_count;
        }
        const arrived = comments.filter(c => Number(c.is_ai) === 1 && !seen.has(Number(c.id)));
        if (arrived.length) {
          found += arrived.length;
          arrived.forEach(c => {
            seen.add(Number(c.id));
            // 自动展开 AI 回复所在楼层
            const root = c.parent_id || c.id;
            commentUi.expandedThreads.add(root);
          });
          target.comments = comments;
          target.comment_count = count;
          rerenderCommentList();
          if (target.ctype === "moment") {
            const card = app.querySelector(`.bber-item[data-id="${target.cid}"] .bber-reply`);
            if (card) updateReplyCount(card, count);
            const fm = state.feed.find(x => x.id === target.cid);
            if (fm) { fm.comments = comments; fm.comment_count = count; }
          } else {
            updateArticleCommentCount(count);
          }
        }
      } catch {
        /* 单次轮询失败静默，下一拍继续 */
      }
      if (found === 0 && attempt < delays.length - 1) {
        setTimeout(() => tick(attempt + 1), delays[attempt + 1]);
      }
    };
    setTimeout(() => tick(0), delays[0]);
  }

  function bindCommentIdentity(form) {
    if (!form) return;
    const nickInput = form.querySelector('input[name="nickname"]');
    const emailInput = form.querySelector('input[name="email"]');
    if (!nickInput || nickInput.dataset.bound) return;
    nickInput.dataset.bound = "1";

    injectAiHint(form);

    // 缓存恢复：昵称/邮箱由 input value 回填，头像此前未持久化，重开弹窗只剩首字
    const savedAvatar = (localStorage.getItem("moments_avatar") || "").trim();
    const savedQq = (localStorage.getItem("moments_qq") || "").trim();
    if (savedQq && QQ_NUM_RE.test(savedQq)) form.dataset.qq = savedQq;

    const renderAvatar = (url, fallback) => {
      const box = form.querySelector("[data-qq-avatar]");
      if (!box) return;
      if (url) {
        box.innerHTML = `<img src="${esc(url)}" alt="" referrerpolicy="no-referrer" />`;
        box.classList.add("has-img");
      } else {
        box.textContent = (fallback || "?").slice(0, 1).toUpperCase();
        box.classList.remove("has-img");
      }
    };

    // 打开弹窗即回填缓存的 QQ 头像
    if (savedAvatar) {
      form.dataset.avatar = savedAvatar;
      renderAvatar(savedAvatar, nickInput.value || "?");
    }

    // 手动输入昵称时：若无 QQ 头像，同步把昵称首字显示到头像位
    nickInput.addEventListener("input", () => {
      const v = nickInput.value.trim();
      // 当前已是 QQ 号获取的昵称，不触发首字回退
      if (form.dataset.qq && v === form.dataset.lastQqNick) return;
      if (QQ_NUM_RE.test(v)) return; // 输入的是 QQ 号，等接口返回
      if (!form.dataset.avatar) {
        renderAvatar("", v || "?");
      }
    });

    const resolveQq = async qq => {
      const avatarFallback = `https://q1.qlogo.cn/g?b=qq&nk=${qq}&s=100`;
      try {
        const info = await api(`/api/qq-info?qq=${encodeURIComponent(qq)}`);
        form.dataset.qq = qq;
        form.dataset.avatar = info.avatar || avatarFallback;
        if (info.nickname) {
          nickInput.value = info.nickname; // 自动覆盖 QQ 号 → 昵称
          form.dataset.lastQqNick = info.nickname;
          localStorage.setItem("moments_nick", info.nickname);
        } else {
          form.dataset.lastQqNick = "";
        }
        if (emailInput && info.email) {
          emailInput.value = info.email;
          localStorage.setItem("moments_email", info.email);
        }
        renderAvatar(info.avatar || avatarFallback, info.nickname || qq);
        localStorage.setItem("moments_qq", qq);
        localStorage.setItem("moments_avatar", info.avatar || avatarFallback);
        if (!info.nickname) toast(t("comment.qq_no_nick"));
      } catch {
        form.dataset.qq = qq;
        form.dataset.avatar = avatarFallback;
        form.dataset.lastQqNick = "";
        localStorage.setItem("moments_qq", qq);
        localStorage.setItem("moments_avatar", avatarFallback);
        if (emailInput) {
          emailInput.value = `${qq}@qq.com`;
          localStorage.setItem("moments_email", `${qq}@qq.com`);
        }
        renderAvatar(avatarFallback, qq);
      }
    };

    let timer = null;
    nickInput.addEventListener("input", () => {
      clearTimeout(timer);
      const v = nickInput.value.trim();
      if (QQ_NUM_RE.test(v) && form.dataset.qq !== v) {
        timer = setTimeout(() => resolveQq(v), 500);
      }
    });
    nickInput.addEventListener("blur", () => {
      const v = nickInput.value.trim();
      if (QQ_NUM_RE.test(v) && form.dataset.qq !== v) resolveQq(v);
    });

    // 输入邮箱即拉取头像（QQ→Gravatar→随机），服务端缓存到 R2；防抖 600ms，失败静默
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let emailTimer = null;
    const prefetchAvatar = async () => {
      if (!emailInput) return;
      const email = emailInput.value.trim().toLowerCase();
      if (!EMAIL_RE.test(email)) return;
      try {
        const res = await api("/api/comment/avatar", { method: "POST", body: { email, qq: form.dataset.qq || "" } });
        if (res && res.src) {
          form.dataset.avatar = res.src;
          renderAvatar(res.src, nickInput.value || "?");
          localStorage.setItem("moments_avatar", res.src);
          localStorage.setItem("moments_email", email);
        }
      } catch { /* 拉取失败不影响评论，提交时服务端会兜底 */ }
    };
    if (emailInput) {
      emailInput.addEventListener("input", () => {
        clearTimeout(emailTimer);
        const email = emailInput.value.trim().toLowerCase();
        if (EMAIL_RE.test(email)) emailTimer = setTimeout(prefetchAvatar, 600);
      });
      emailInput.addEventListener("blur", prefetchAvatar);
    }
  }

  /** 规范化评论目标对象 */
  function normalizeCommentTarget(target) {
    return {
      ctype: target.ctype === "post" ? "post" : "moment",
      cid: Number(target.cid),
      slug: target.slug || "",
      quote: target.quote || "",
      comment_count: Number(target.comment_count) || 0,
      comments: Array.isArray(target.comments) ? target.comments : [],
    };
  }

  /**
   * 评论区水合：假设 DOM 中已存在 [data-comment-list] 与 [data-comment-form]
   * 供弹窗（说说）和文章内联评论区共用。负责：设置目标、重置楼中楼 UI、
   * 绑定身份输入、拉取评论并渲染、同步计数。
   */
  async function hydrateCommentSection(tg) {
    state.commentTarget = tg;
    commentUi.expandedThreads = new Set();
    commentUi.showAll = false;
    commentUi.replyRoot = 0;
    commentUi.replyName = "";
    const form = document.querySelector("[data-comment-form]");
    const list = document.querySelector("[data-comment-list]");
    if (form) { bindCommentIdentity(form); bindCommentToolbar(form); }
    try {
      let comments;
      let count;
      if (tg.ctype === "post") {
        const data = await api(`/api/posts/${encodeURIComponent(tg.slug)}/comments`);
        comments = data.list || [];
        count = Number(data.count) || comments.length;
      } else {
        const detail = await api(`/api/moments/${tg.cid}?voter_id=${encodeURIComponent(state.voterId)}`);
        comments = detail.comments || [];
        count = detail.comment_count;
      }
      tg.comments = comments;
      tg.comment_count = count;
      if (list) {
        const html = renderCommentListHtml(comments);
        list.innerHTML = html || `<div class="comment-hint">${t("comment.empty_first")}</div>`;
      }
      if (tg.ctype === "moment") {
        const card = app.querySelector(`.bber-item[data-id="${tg.cid}"] .bber-reply`);
        if (card) updateReplyCount(card, count);
        const fm = state.feed.find(x => x.id === tg.cid);
        if (fm) {
          fm.comments = comments;
          fm.comment_count = count;
        }
      } else {
        updateArticleCommentCount(count);
      }
    } catch (err) {
      if (list) list.innerHTML = `<div class="comment-hint">${esc(err.message)}</div>`;
    }
  }

  /**
   * 评论弹窗（说说用）：文章评论已改为文章内联显示，不走此弹窗
   * target: { ctype:'moment', cid, quote, comment_count?, comments? }
   */
  async function openCommentModal(target) {
    const ct = normalizeCommentTarget(target);
    const modal = openModal(`
      <div class="modal-head">
        <h3>${t("comment.title")}</h3>
        <button type="button" class="modal-x" data-close aria-label="${t("common.close")}">×</button>
      </div>
      <div data-comment-body>
        <div class="comment-quote">
          <span>${esc(ct.quote || `#${ct.cid}`)}</span>
        </div>
        <div class="comment-list" data-comment-list><span class="spinner"></span></div>
        <form class="comment-form-wrap" data-comment-form data-ctype="${ct.ctype}" data-cid="${ct.cid}" data-slug="${esc(ct.slug)}">
          <div class="comment-form-row comment-user-row">
            <span class="qq-avatar" data-qq-avatar>${esc((localStorage.getItem("moments_nick") || "?").slice(0, 1).toUpperCase())}</span>
            <input name="nickname" placeholder="${t("comment.nick_or_qq_ph")}" maxlength="20" value="${esc(localStorage.getItem("moments_nick") || "")}" required autocomplete="off" />
          </div>
          <div class="comment-form-row">
            <input name="email" type="email" placeholder="${t("comment.email_ph")}" maxlength="100" value="${esc(localStorage.getItem("moments_email") || "")}" required />
            <input name="website" placeholder="${t("comment.website_ph")}" maxlength="200" value="${esc(getSavedWebsite())}" />
          </div>
          <div class="comment-toolbar">
            <button type="button" class="comment-tool-btn" data-emoji-btn title="${t("comment.owo")}">${svgIcon("smile", 18)}</button>
            <button type="button" class="comment-tool-btn" data-img-upload-btn title="${t("comment.upload_image")}">${svgIcon("image", 18)}</button>
            <input type="file" accept="image/*" data-img-file hidden />
            <input type="text" class="comment-img-url-input" data-img-url-input placeholder="${t("comment.image_url_ph")}" maxlength="500" />
            <button type="button" class="comment-tool-btn comment-random-btn" data-random-comment title="${t("comment.random_one")}">${svgIcon("dices", 18)}</button>
          </div>
          <textarea name="content" placeholder="${t("comment.placeholder_mention")}" maxlength="500" required style="min-height:80px"></textarea>
          <div class="comment-img-preview" data-comment-img-preview style="display:none"></div>
          <label class="comment-notify-row"><input type="checkbox" name="notify_reply" value="1" checked /> ${t("comment.notify_mine")}</label>
          <div style="margin-top:.5rem;text-align:right">
            <button class="btn primary" type="submit">${t("comment.submit")}</button>
          </div>
        </form>
      </div>`);
    modal.querySelector("[data-close]").addEventListener("click", closeModal);
    await hydrateCommentSection(ct);
  }

  /** 更新文章详情页评论入口的数字（无数字时不显示角标） */
  function updateArticleCommentCount(count) {
    const el = document.querySelector("[data-article-comments-count]");
    if (!el) return;
    el.textContent = count > 0 ? String(count) : "";
    el.style.display = count > 0 ? "" : "none";
  }

  /** 更新卡片评论数显示 */
  function updateReplyCount(replyEl, count) {
    let c = replyEl.querySelector(".bber-reply-count");
    if (count > 0) {
      if (!c) {
        replyEl.insertAdjacentHTML("beforeend", `<span class="bber-reply-count"></span>`);
        c = replyEl.querySelector(".bber-reply-count");
      }
      c.textContent = String(count);
    } else if (c) {
      c.remove();
    }
  }

  async function setCommentTarget(m) {
    state.commentTarget = m || null;
    const body = app.querySelector("[data-comment-body]");
    const countTag = app.querySelector("[data-comment-count]");
    if (!body) return;
    if (!m) {
      body.innerHTML = `<div class="comment-hint">${t("comment.feed_hint")}</div>`;
      if (countTag) countTag.textContent = "0";
      return;
    }
    if (countTag) countTag.textContent = String(m.comment_count || 0);
    body.innerHTML = `
      <div class="comment-quote">
        <span>${esc(plainText(m.content, 60) || t("feed.moment_hash", { id: m.id }))}</span>
        <button type="button" data-act="clear-target" title="${t("comment.cancel_locate")}">×</button>
      </div>
      <div class="comment-list" data-comment-list><span class="spinner"></span></div>
      <form class="comment-form-wrap" data-comment-form>
        <div class="comment-form-row comment-user-row">
          <span class="qq-avatar" data-qq-avatar>${esc((localStorage.getItem("moments_nick") || "?").slice(0, 1).toUpperCase())}</span>
          <input name="nickname" placeholder="${t("comment.nick_or_qq_ph")}" maxlength="20" value="${esc(localStorage.getItem("moments_nick") || "")}" required autocomplete="off" />
        </div>
        <div class="comment-form-row">
          <input name="email" type="email" placeholder="${t("comment.email_ph")}" maxlength="100" value="${esc(localStorage.getItem("moments_email") || "")}" required />
          <input name="website" placeholder="${t("comment.website_ph")}" maxlength="200" value="${esc(getSavedWebsite())}" />
        </div>
        <div class="comment-toolbar">
          <button type="button" class="comment-tool-btn" data-emoji-btn title="${t("comment.owo")}">${svgIcon("smile", 18)}</button>
          <button type="button" class="comment-tool-btn" data-img-upload-btn title="${t("comment.upload_image")}">${svgIcon("image", 18)}</button>
          <input type="file" accept="image/*" data-img-file hidden />
          <input type="text" class="comment-img-url-input" data-img-url-input placeholder="${t("comment.image_url_ph")}" maxlength="500" />
          <button type="button" class="comment-tool-btn comment-random-btn" data-random-comment title="${t("comment.random_one")}">${svgIcon("dices", 18)}</button>
        </div>
        <textarea name="content" placeholder="${t("comment.placeholder_mention")}" maxlength="500" required style="min-height:80px"></textarea>
        <div class="comment-img-preview" data-comment-img-preview style="display:none"></div>
        <label class="comment-notify-row"><input type="checkbox" name="notify_reply" value="1" checked /> ${t("comment.notify_mine")}</label>
        <div style="margin-top:.5rem;text-align:right">
          <button class="btn primary" type="submit">${t("comment.submit")}</button>
        </div>
      </form>`;
    bindCommentIdentity(body.querySelector("[data-comment-form]"));
    bindCommentToolbar(body.querySelector("[data-comment-form]"));
    try {
      const detail = await api(`/api/moments/${m.id}?voter_id=${encodeURIComponent(state.voterId)}`);
      const list = body.querySelector("[data-comment-list]");
      if (list) list.innerHTML = detail.comments && detail.comments.length ? detail.comments.map(commentItemHtml).join("") : `<div class="comment-hint">${t("comment.empty_first")}</div>`;
      if (state.commentTarget && state.commentTarget.id === m.id) {
        state.commentTarget.comments = detail.comments;
        if (countTag) countTag.textContent = String(detail.comment_count || 0);
      }
    } catch (err) {
      const list = body.querySelector("[data-comment-list]");
      if (list) list.innerHTML = `<div class="comment-hint">${esc(err.message)}</div>`;
    }
  }

  async function loadFeed() {
    if (state.feedLoading || state.feedDone) return;
    state.feedLoading = true;
    setLoadMoreText();
    try {
      const fq = new URLSearchParams(location.search).get("q") || "";
      const q = new URLSearchParams({ voter_id: state.voterId, limit: String(feedPageSize()) });
      if (state.cursor) q.set("cursor", String(state.cursor));
      if (fq) q.set("q", fq);
      const data = await api("/api/feed?" + q.toString());
      if (state.activeView !== "feed" || !document.getElementById("waterfall")) return;
      state.feed = state.feed.concat(data.list);
      state.cursor = data.nextCursor;
      state.feedDone = !data.nextCursor;

      const ul = document.getElementById("waterfall");
      const timeline = app.querySelector(".timeline");
      if (!ul) return;
      ul.insertAdjacentHTML("beforeend", data.list.map(feedItemHtml).join(""));
      feedEls = Array.from(ul.children);
      syncFeedRO(); // 观察新增卡片：后续图片晚到/视频起播等高度变化自动重排
      hydrateVideos(ul);
      hydrateMusicCards(ul);
      document.querySelector(".layout-loading-placeholder")?.remove();
      timeline?.classList.remove("is-hidden");

      // 追加布局：先强制排一次再等图片，最后精排（与原站一致）
      layout(true);
      await waitForImages(ul);
      layout();
    } catch (e) {
      const el = document.getElementById("loadMore");
      if (el) el.innerHTML = `<span>${t("common.retry_suffix", { msg: esc(e.message) })}</span>`;
      el && (el.style.cursor = "pointer");
    } finally {
      // 必须在 feedLoading 复位后再刷新文案，否则成功时仍显示 spinner
      state.feedLoading = false;
      setLoadMoreText();
    }
  }

  /* ================= 文章列表 / 详情 ================= */

  async function renderPostList(page = 1) {
    state.activeView = "posts";
    app.innerHTML = `<div class="essay"><div class="posts-wrap"><div class="essay-loading"><span class="spinner"></span><span>${t("common.loading")}</span></div></div></div>`;
    try {
      const data = await api(`/api/posts?page=${page}&per_page=20`);
      if (state.activeView !== "posts") return;
      const list = data.list;
      const total = data.total ?? list.length;
      const pages = Math.max(1, Math.ceil(total / 20));
      if (!list.length && page > 1) return renderPostList(pages); // 原页被删空时自动回退
      setSeo({ title: `${t("posts.title")} · ${state.settings.site_title}`, description: t("posts.total", { n: total }), path: "/posts" });
      const adminBtn = state.admin ? `<div style="margin-bottom:1rem;text-align:right"><button class="btn primary" data-act="new-post">＋ 写文章</button></div>` : "";
      app.innerHTML = `
        <div class="essay">
          ${bannerHtml()}
          <div class="posts-wrap">
            ${adminBtn}
            ${
              list.length
                ? list
                    .map(
                      p => `
            <a class="post-item${p.pinned ? " post-item--pinned" : ""}" href="/post/${encodeURIComponent(p.slug)}">
              ${p.cover ? `<img class="cover" src="${esc(thumbSrc(p.cover))}" loading="lazy" alt="" data-orig="${esc(p.cover)}" />` : ""}
              <div class="info">
                <h3>${p.pinned ? `<span class="top-badge">${svgIcon("pin", 12)}<span>${t("feed.pinned")}</span></span>` : ""}${esc(p.title)}${p.status === "draft" ? '<span class="draft-tag">草稿</span>' : ""}</h3>
                <p class="excerpt">${esc(p.excerpt || "")}</p>
                <div class="date">${timeAgo(p.created_at)}</div>
              </div>
            </a>`
                    )
                    .join("")
                : `<div class="essay-empty"><span class="empty-ico">${svgIcon("file-text", 48)}</span><span>${t("posts.empty")}</span></div>`
            }
            ${pagerHtml(page, pages)}
          </div>
        </div>`;
      app.querySelectorAll("[data-pager]").forEach(b =>
        b.addEventListener("click", () => {
          renderPostList(b.dataset.pager === "prev" ? page - 1 : page + 1);
          window.scrollTo({ top: 0 });
        })
      );
    } catch (e) {
      app.innerHTML = `<div class="essay"><div class="posts-wrap"><div class="essay-empty">${esc(e.message)}</div></div></div>`;
    }
  }

  async function renderPhotos(page = 1) {
    state.activeView = "photos";
    app.innerHTML = `<div class="essay"><div class="photos-wrap"><div class="essay-loading"><span class="spinner"></span><span>${t("common.loading")}</span></div></div></div>`;
    try {
      const data = await api(`/api/photos?page=${page}&per_page=24`);
      if (state.activeView !== "photos") return;
      const list = data.list || [];
      const total = data.total ?? list.length;
      const pages = Math.max(1, Math.ceil(total / 24));
      if (!list.length && page > 1) return renderPhotos(pages); // 原页被删空时自动回退
      const s = state.settings;
      setSeo({ title: `${t("photos.title")} · ${s.site_title}`, description: t("photos.total", { n: total }), path: "/photos" });
      // 横幅背景图与首页一致（后台「横幅背景图」设置）
      const bg = bannerInlineBg(s);
      const hasBannerBg = s.banner_bg_mode === "random" || /^https?:\/\//i.test(s.banner_bg_image || "");
      // 顶部标题卡（与首页横幅风格呼应）
      const header = `
        <div class="banner-card photos-banner">
          <div class="banner-inner${hasBannerBg ? " has-bg" : ""}"${hasBannerBg ? ` data-banner-bg="1"` : ""}${bg ? ` style="background-image:url('${esc(bg).replace(/'/g, "%27")}')"` : ""}>
            <div class="banner-content">
              <div>
                <div class="banner-tips">${esc(s.essay_tips)}</div>
                <span class="banner-title">${t("photos.title")}</span>
              </div>
              <div class="banner-bottom">
                <div class="banner-desc">${t("photos.page_desc", { n: list.length })}</div>
              </div>
            </div>
          </div>
        </div>`;
      const grid = list.length
        ? `<div class="photos-grid">${list
            .map(
              p => {
                const ts = thumbSrc(p.src);
                const orig = fullSrc(p.src);
                return `
            <a class="photo-item" data-lightbox="${esc(orig)}" rel="external nofollow noreferrer">
              <img src="${esc(ts)}" alt="${esc(p.title || "")}" loading="lazy" referrerpolicy="no-referrer"${ts !== orig ? ` data-orig="${esc(orig)}"` : ""} />
              ${p.title ? `<span class="photo-title">${esc(p.title)}</span>` : ""}
            </a>`;
              }
            )
            .join("")}</div>`
        : `<div class="essay-empty"><span class="empty-ico">${svgIcon("images", 48)}</span><span>${t("photos.empty_hint")}</span><span style="font-size:.85rem;color:var(--anzhiyu-secondtext)">${t("photos.empty_tip")}</span></div>`;

      app.innerHTML = `<div class="essay">${header}<div class="photos-wrap">${grid}${pagerHtml(page, pages)}</div></div>`;
      app.querySelectorAll("[data-pager]").forEach(b =>
        b.addEventListener("click", () => {
          renderPhotos(b.dataset.pager === "prev" ? page - 1 : page + 1);
          window.scrollTo({ top: 0 });
        })
      );
    } catch (e) {
      app.innerHTML = `<div class="essay"><div class="photos-wrap"><div class="essay-empty">${esc(e.message)}</div></div></div>`;
    }
  }

  /* ================= 关于我页面（/about） ================= */

  /** 把「每行 a|b|c」文本解析成对象数组，空行忽略 */
  function parseRows(text) {
    return String(text || "")
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean)
      .map(l => l.split("|").map(s => s.trim()));
  }

  async function renderAbout() {
    state.activeView = "about";
    const s = state.settings;
    setSeo({
      title: `${t("nav.about")} · ${s.site_title}`,
      description: s.about_signature || s.about_greeting_sub || "",
      path: "/about",
      image: s.about_avatar || s.author_avatar || s.brand_avatar || "",
    });
    app.innerHTML = `<div class="essay"><div class="about-wrap"><div class="essay-loading"><span class="spinner"></span><span>${t("common.loading")}</span></div></div></div>`;
    try {
      // 最近文章（设计图「最近写的一些东西」），失败则不显示该区块
      let recentPosts = [];
      try {
        const pd = await api("/api/posts?page=1&per_page=6");
        recentPosts = (pd && pd.list) || [];
      } catch (_) {
        recentPosts = [];
      }
      if (state.activeView !== "about") return;

      const avatar = s.about_avatar || s.author_avatar || s.brand_avatar || "";
      const name = s.author_name || s.site_title;

      // 顶部问候 + 作者卡
      const avatarHtml = avatar
        ? `<img class="about-avatar-img" src="${esc(avatar)}" alt="${esc(name)}" />`
        : `<span class="about-avatar-fallback">${svgIcon("pen-nib", 40)}</span>`;
      const head = `
        <section class="about-card about-head">
          <div class="about-greet">
            <h1>${esc(s.about_greeting || t("about.greeting_default"))}</h1>
            ${s.about_greeting_sub ? `<p class="about-greet-sub">${esc(s.about_greeting_sub)}</p>` : ""}
          </div>
          <div class="about-author">
            <div class="about-avatar">${avatarHtml}</div>
            <div class="about-author-info">
              <div class="about-author-name">${esc(name)}</div>
              ${s.about_signature ? `<div class="about-author-sign">${esc(s.about_signature)}</div>` : ""}
            </div>
          </div>
        </section>`;

      // 自我介绍正文 + 右侧「一些数字」
      const statsRows = parseRows(s.about_stats);
      const statsHtml = statsRows.length
        ? `<aside class="about-card about-stats-aside">
            <div class="about-card-title">${t("about.stats_title")}</div>
            ${statsRows
              .map(
                r => `<div class="about-stat-mini">
                  <span class="about-stat-mini-num">${esc(r[1] || "")}</span>
                  <span class="about-stat-mini-label">${esc(r[0] || "")}</span>
                  ${r[2] ? `<span class="about-stat-mini-desc">${esc(r[2])}</span>` : ""}
                </div>`
              )
              .join("")}
          </aside>`
        : "";
      const bioHtml = `
        <section class="about-card about-bio${statsHtml ? " has-aside" : ""}">
          <div class="about-bio-main">
            <h2 class="about-card-title">${s.about_bio ? "" : ""}${t("about.bio_title")}</h2>
            ${xlateEnabled() ? xlateBarHtml("about", "site") : ""}
            <div class="article-body">${sanitizeHtml(marked.parse(s.about_bio || ""))}</div>
          </div>
          ${statsHtml}
        </section>`;

      // 时间线
      const tlRows = parseRows(s.about_timeline);
      const timelineHtml = tlRows.length
        ? `<section class="about-card about-tl">
            <h2 class="about-card-title">${t("about.timeline_heading")}</h2>
            <div class="about-timeline">
              ${tlRows
                .map(
                  r => `<div class="about-tl-item">
                    <div class="about-tl-dot"></div>
                    <div class="about-tl-body">
                      <div class="about-tl-date">${esc(r[0] || "")}</div>
                      <div class="about-tl-title">${esc(r[1] || "")}</div>
                      ${r[2] ? `<div class="about-tl-desc">${esc(r[2])}</div>` : ""}
                    </div>
                  </div>`
                )
                .join("")}
            </div>
          </section>`
        : "";

      // 最近写的一些东西（文章网格）
      const recentHtml = recentPosts.length
        ? `<section class="about-card about-recent">
            <div class="about-recent-head">
              <h2 class="about-card-title">${t("about.recent_title")}</h2>
              <a class="about-more-link" href="/posts">${t("about.view_all")} ${svgIcon("chevron-right", 14)}</a>
            </div>
            <div class="about-post-grid">
              ${recentPosts
                .map(
                  p => `<a class="about-post-item" href="/post/${encodeURIComponent(p.slug)}">
                    ${p.cover ? `<div class="about-post-cover"><img src="${esc(thumbSrc(p.cover))}" alt="" loading="lazy" data-orig="${esc(p.cover)}" /></div>` : `<div class="about-post-cover about-post-cover-empty">${svgIcon("file-text", 28)}</div>`}
                    <div class="about-post-title">${esc(p.title)}</div>
                  </a>`
                )
                .join("")}
            </div>
          </section>`
        : "";

      // 大数字统计
      const bigRows = parseRows(s.about_bigstats);
      const bigHtml = bigRows.length
        ? `<section class="about-card about-big">
            <div class="about-card-title">${t("about.bigstats_title")}</div>
            <div class="about-big-grid">
              ${bigRows
                .map(
                  r => `<div class="about-big-item">
                    <div class="about-big-num">${esc(r[0] || "")}</div>
                    <div class="about-big-label">${esc(r[1] || "")}</div>
                  </div>`
                )
                .join("")}
            </div>
          </section>`
        : "";

      // 联系方式
      const ctRows = parseRows(s.about_contacts);
      const contactHtml = ctRows.length
        ? `<section class="about-card about-contact">
            <h2 class="about-card-title">${t("about.contact_heading")}</h2>
            <div class="about-contact-list">
              ${ctRows
                .map(r => {
                  const [type, val, link] = r;
                  const inner = `<span class="about-contact-ico">${svgIcon(contactIcon(type), 18)}</span><span class="about-contact-type">${esc(type || "")}</span><span class="about-contact-val">${esc(val || "")}</span>`;
                  return link
                    ? `<a class="about-contact-item" href="${esc(link)}" target="_blank" rel="noopener noreferrer nofollow">${inner}</a>`
                    : `<div class="about-contact-item">${inner}</div>`;
                })
                .join("")}
            </div>
          </section>`
        : "";

      // 赞助 / 收款码：咖啡主题卡 + 金额按钮切换二维码
      // about_qr_amounts 每行：金额|二维码URL，或 金额|描述|二维码URL（兼容 2/3 列）
      // URL 可空；自动识别哪一列是 http(s) 开头，并去掉反引号/引号包裹
      const cleanUrl = v => String(v || "").trim().replace(/^[`'"]+|[`'"]+$/g, "").trim();
      const amounts = parseRows(s.about_qr_amounts).map(r => {
        const label = String(r[0] || "").trim();
        // 从第 2 列起找第一个以 http 开头的作为二维码 URL
        const src = r.slice(1).map(cleanUrl).find(v => /^https?:\/\//i.test(v)) || cleanUrl(r[r.length - 1]);
        return { label, src: /^https?:\/\//i.test(src) ? src : "" };
      }).filter(x => x.label);
      const firstSrc = amounts.find(x => /^https?:\/\//i.test(x.src))?.src || "";
      const btnHtml = amounts.length
        ? amounts.map((a, i) => `<button type="button" class="about-amt-btn${i === 0 ? " is-active" : ""}" data-qr-src="${esc(a.src)}">${esc(a.label)}</button>`).join("")
        : "";
      const qrImgHtml = firstSrc ? `<img class="about-qr-pic" src="${esc(firstSrc)}" alt="${t("about.qr_alt")}" loading="lazy" />` : `<div class="about-qr-empty">${svgIcon("coffee", 40)}</div>`;
      const qrHtml = `
        <section class="about-card about-sponsor">
          <div class="about-sponsor-main">
            <div class="about-sponsor-head">
              <span class="about-sponsor-ico">${svgIcon("coffee", 22)}</span>
              <span class="about-sponsor-title">${t("about.coffee_title")}</span>
            </div>
            <div class="about-qr-text">${esc(s.about_qr_text || "")}</div>
            ${btnHtml ? `<div class="about-amt-group" role="group" aria-label="${t("about.select_amount")}">${btnHtml}</div>` : ""}
          </div>
          <div class="about-sponsor-qr">
            ${qrImgHtml}
            <div class="about-qr-tip">${t("about.scan_tip")}</div>
          </div>
        </section>`;

      app.innerHTML = `<div class="essay"><div class="about-wrap">
        ${head}
        ${bioHtml}
        ${timelineHtml}
        ${recentHtml}
        ${bigHtml}
        ${contactHtml}
        ${qrHtml}
      </div></div>`;
      // 赞助金额按钮：点击切换对应收款码图片
      app.querySelectorAll(".about-amt-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const src = btn.getAttribute("data-qr-src") || "";
          app.querySelectorAll(".about-amt-btn").forEach(b => b.classList.toggle("is-active", b === btn));
          const pic = app.querySelector(".about-sponsor-qr .about-qr-pic");
          if (!/^https?:\/\//i.test(src)) return; // 该金额未配置二维码，仅高亮不切图
          if (pic) { pic.src = src; }
          else {
            const box = app.querySelector(".about-sponsor-qr");
            if (box) box.innerHTML = `<img class="about-qr-pic" src="${esc(src)}" alt="${t("about.qr_alt")}" loading="lazy" /><div class="about-qr-tip">${t("about.scan_tip")}</div>`;
          }
        });
      });
    } catch (e) {
      app.innerHTML = `<div class="essay"><div class="about-wrap"><div class="essay-empty">${esc(e.message)}</div></div></div>`;
    }
  }

  /* ================= 友情链接（/links） ================= */

  /** 相对时间：x 天前 / 刚刚 */
  function timeAgo(iso) {
    if (!iso) return "";
    const ts = new Date(iso).getTime();
    if (!ts) return "";
    const diff = Date.now() - ts;
    const d = Math.floor(diff / 86400000);
    if (d <= 0) return t("common.today");
    if (d === 1) return t("common.yesterday");
    if (d < 30) return t("common.day_ago", { n: d });
    if (d < 365) return t("common.month_ago", { n: Math.floor(d / 30) });
    return t("common.year_ago", { n: Math.floor(d / 365) });
  }

  /** 友站卡片头像：有图显示图片（裂图回退首字），无图直接首字 */
  function friendAvatar(name, url) {
    const initial = (name || "?").trim().charAt(0).toUpperCase();
    const img = url
      ? `<img src="${esc(url)}" alt="${esc(name)}" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />`
      : "";
    const fb = `<span class="links-avatar-fb" style="${url ? "display:none" : "display:flex"}">${esc(initial)}</span>`;
    return `<div class="links-avatar">${img}${fb}</div>`;
  }

  /* 友站最近发文行：今天=主题色高亮 / 昨天 / N 天前 / 超 1 个月灰色；最新文章标题可点击直达友站文章 */
  function friendLastPostHtml(f) {
    if (!f.feed_url) {
      return `<div class="links-card-update is-unsubscribed"><span class="links-card-update-text">${t("links.not_subscribed")}</span></div>`;
    }
    if (!f.last_post_at) {
      const st = String(f.feed_status || "");
      if (st && st !== "ok") {
        return `<div class="links-card-update is-error"><span class="links-card-update-text">${t("links.fetch_error")}</span></div>`;
      }
      return `<div class="links-card-update is-pending"><span class="links-card-update-text">${t("links.fetch_pending")}</span></div>`;
    }
    const ts = Date.parse(f.last_post_at);
    if (!Number.isFinite(ts)) return "";
    const days = Math.floor((Date.now() - ts) / 864e5);
    let cls = "", text = "";
    if (days <= 0) { cls = " is-today"; text = t("links.last_post_today"); }
    else if (days === 1) { text = t("links.last_post_yesterday"); }
    else if (days <= 30) { text = t("links.last_post_days", { n: days }); }
    else { cls = " is-stale"; text = t("links.last_post_stale"); }
    const post = f.last_post_title
      ? `<span class="links-card-post" data-post-link="${esc(f.last_post_link || "")}" title="${esc(f.last_post_title)}">《${esc(f.last_post_title)}》</span>`
      : "";
    return `<div class="links-card-update${cls}"><span class="links-card-update-text">${text}</span>${post}</div>`;
  }

  async function renderLinks() {
    const activeCat = new URLSearchParams(location.search).get("category") || "全部";
    app.innerHTML = `<div class="essay"><div class="links-wrap"><div class="essay-empty">${t("common.loading")}</div></div></div>`;
    try {
      const res = await api(`/api/friends?category=${encodeURIComponent(activeCat)}`);
      const { list = [], stats = {}, categories = [] } = res;
      const cats = ["全部", ...categories];
      const filterHtml = cats.map(c => {
        const href = c === "全部" ? "/links" : `/links?category=${encodeURIComponent(c)}`;
        return `<a class="links-cat${c === activeCat ? " is-active" : ""}" href="${href}">${c === "全部" ? t("links.category_all") : esc(c)}</a>`;
      }).join("");

      const gridHtml = list.length
        ? `<div class="links-grid">${list.map(f => `
            <a class="links-card" href="${esc(f.url)}" target="_blank" rel="noopener noreferrer nofollow">
              <div class="links-card-top">
                ${friendAvatar(f.name, f.avatar)}
                <div class="links-card-info">
                  <div class="links-card-name">${esc(f.name)}</div>
                  <div class="links-card-domain">${esc((f.url || "").replace(/^https?:\/\//i, "").replace(/\/$/, ""))}</div>
                </div>
                <span class="links-card-arrow">${svgIcon("arrow-up-right", 16)}</span>
              </div>
              <div class="links-card-desc">${esc(f.description || t("links.no_desc"))}</div>
              ${friendLastPostHtml(f)}
              <div class="links-card-foot">
                ${f.category ? `<span class="links-card-cat">${esc(f.category)}</span>` : ""}
              </div>
            </a>`).join("")}</div>`
        : `<div class="essay-empty">${t("links.empty_apply_tip")}</div>`;

      app.innerHTML = `<div class="essay"><div class="links-wrap">
        <div class="links-page-head">
          <div class="links-eyebrow">${t("links.eyebrow")}</div>
          <h1 class="links-title">${t("nav.links")}</h1>
          <p class="links-subtitle">${t("links.subtitle")}</p>
          <div class="links-stats">
            <div class="links-stat"><b>${stats.total ?? 0}</b><span>${t("links.stat_total")}</span></div>
            <div class="links-stat"><b>${stats.categories ?? 0}</b><span>${t("links.stat_categories")}</span></div>
            <div class="links-stat"><b>${stats.newThisMonth ?? 0}</b><span>${t("links.stat_new")}</span></div>
          </div>
        </div>
        <div class="links-cats">${filterHtml}</div>
        <div class="links-apply-banner">
          <div>
            <div class="links-apply-title">${t("links.apply_banner_title")}</div>
            <div class="links-apply-desc">${t("links.apply_banner_desc")}</div>
          </div>
          <a class="links-apply-btn" href="/links/apply">${t("links.apply")} ${svgIcon("arrow-right", 16)}</a>
        </div>
        ${gridHtml}
      </div></div>`;
      // 同步浏览器标签页标题与 SEO
      setSeo({
        title: `${t("nav.links")} · ${state.settings.site_title}`,
        description: state.settings.essay_subtitle || "",
        path: activeCat === "全部" ? "/links" : `/links?category=${encodeURIComponent(activeCat)}`,
      });
    } catch (e) {
      app.innerHTML = `<div class="essay"><div class="links-wrap"><div class="essay-empty">${esc(e.message)}</div></div></div>`;
    }
  }

  /* ================= 友圈（/friends） ================= */

  /* 头像：后端已缓存为稳定 URL（自定义/favicon/qlogo），加载失败降级 RSS 图标（不用首字占位） */
  function friendAvatarHtml(post) {
    const src = post.avatar || "";
    return `
      <span class="friend-avatar">
        ${src ? `<img src="${esc(src)}" alt="${esc(post.friend_name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none';var fb=this.parentElement.querySelector('.friend-avatar-fallback');if(fb)fb.style.display='flex'" />` : ""}
        <span class="friend-avatar-fallback"${src ? ' style="display:none"' : ""}>${svgIcon("rss", 20)}</span>
      </span>`;
  }

  /* 文章配图：复用首页九宫格样式（比例盒在图片加载前已确定，不会引起瀑布流重排） */
  function friendImagesHtml(images) {
    if (!images || !images.length) return "";
    const mod = images.length === 1 ? "single" : images.length === 2 ? "double" : "multi";
    const cells = images.slice(0, 9)
      .map(src => `<div class="bber-content-img friend-content-img"><img src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer" /></div>`)
      .join("");
    return `<div class="bber-container-img bber-img-${mod} friend-imgs">${cells}</div>`;
  }

  /* 友圈图片防盗链兜底：直链（no-referrer）加载失败 → 换站内 /imgproxy 反代再试一次。
     error 事件不冒泡，用捕获阶段委托监听；data-proxied 防止反代也失败时死循环 */
  document.addEventListener("error", e => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || img.dataset.proxied || !img.closest(".friend-imgs")) return;
    img.dataset.proxied = "1";
    img.src = "/imgproxy?u=" + encodeURIComponent(img.src);
  }, true);

  /* 友链卡片「最新文章」标题点击直达友站文章（卡片本身是整卡 <a>，需拦截冒泡） */
  document.addEventListener("click", e => {
    const el = e.target && e.target.closest ? e.target.closest(".links-card-post[data-post-link]") : null;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    const u = el.dataset.postLink || "";
    if (/^https?:\/\//i.test(u)) window.open(u, "_blank", "noopener");
  }, true);

  /* 热度档位：>=200 热 / >=80 温 / 其余默认 */
  function friendHeatHtml(clicks) {
    const tier = clicks >= 200 ? " is-hot" : clicks >= 80 ? " is-warm" : "";
    return `<span class="friend-post-heat${tier}" title="热度">${svgIcon("flame", 12)} ${clicks}°C</span>`;
  }

  /* ---- 友圈瀑布流布局（与首页即刻同一算法：>=1200 三列 / >=768 两列 / 其余一列） ---- */
  let friendsEls = [];
  const friendsRO = typeof ResizeObserver !== "undefined"
    ? new ResizeObserver(() => {
        if (friendsRafId) return;
        friendsRafId = requestAnimationFrame(() => {
          friendsRafId = 0;
          friendsLayout();
        });
      })
    : null;
  let friendsRafId = 0;
  let friendsWrapRO = null; // 容器宽度变化（断点切换）重排

  function friendsLayout() {
    const container = document.getElementById("friendsWaterfall");
    if (!container || friendsEls.length === 0) return;
    const width = container.offsetWidth;
    if (!width) return;

    const cols = width >= 1200 ? 3 : width >= 768 ? 2 : 1;
    const colWidth = (width - GAP * (cols - 1)) / cols;
    const heights = new Array(cols).fill(0);

    // 两阶段：先纯读高度，再纯写位置，避免强制同步布局
    const measured = friendsEls.map(el => (el ? el.getBoundingClientRect().height : 0));
    friendsEls.forEach((el, index) => {
      if (!el) return;
      let minH = Infinity;
      let col = 0;
      for (let i = 0; i < cols; i++) {
        if (heights[i] < minH) {
          minH = heights[i];
          col = i;
        }
      }
      el.style.position = "absolute";
      el.style.width = `${colWidth}px`;
      el.style.left = `${col * (colWidth + GAP)}px`;
      el.style.top = `${heights[col]}px`;
      el.style.transition = "left .3s ease, top .3s ease, width .3s ease, transform .3s ease, box-shadow .3s ease, border-color .3s ease";
      heights[col] += measured[index] + GAP;
    });

    const maxH = Math.max(...heights);
    container.style.height = `${maxH > 0 ? maxH - GAP : 0}px`;
  }

  function observeFriendsResize(container) {
    if (friendsWrapRO) friendsWrapRO.disconnect();
    if (typeof ResizeObserver === "undefined") return;
    let lastWidth = container.offsetWidth;
    friendsWrapRO = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;
      const width = entry.contentRect.width;
      if (Math.abs(width - lastWidth) < 1) return;
      lastWidth = width;
      friendsLayout();
    });
    friendsWrapRO.observe(container);
  }

  /* 单张友圈卡片 */
  function friendPostCardHtml(post) {
    return `
      <a class="friend-post-item" href="${esc(post.link)}" target="_blank" rel="noopener noreferrer" data-post-id="${post.id}">
        <div class="friend-head">
          ${friendAvatarHtml(post)}
          <div class="friend-meta">
            <span class="friend-name">${esc(post.friend_name)}</span>
            <span class="friend-tag friend-tag-${post.tag}">${esc(post.tag_name)}</span>
          </div>
        </div>
        <h3 class="friend-post-title">${esc(post.title)}</h3>
        <p class="friend-post-summary">${esc(post.excerpt)}</p>
        ${friendImagesHtml(post.images)}
        <hr class="friend-post-divider" />
        <div class="friend-post-footer">
          <span class="friend-post-time">
            ${svgIcon("clock", 12)}
            ${timeAgo(post.published_at)}
          </span>
          ${friendHeatHtml(post.clicks)}
          <span class="friend-post-link">
            阅读原文
            ${svgIcon("arrow-up-right", 12)}
          </span>
        </div>
      </a>`;
  }

  /* 挂载/重排瀑布流（首屏与追加新卡片后调用） */
  function mountFriendsWaterfall() {
    const waterfall = document.getElementById("friendsWaterfall");
    if (!waterfall) return;
    friendsEls = Array.from(waterfall.children);
    if (friendsRO) {
      friendsRO.disconnect();
      friendsEls.forEach(el => friendsRO.observe(el));
    }
    friendsLayout();
    observeFriendsResize(waterfall);
  }

  /* 点击热度上报：sendBeacon 不阻塞跳转；不支持时 fetch keepalive 兜底 */
  function reportFriendClick(postId) {
    const url = `/api/friends/posts/${postId}/click`;
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(url)) return;
      fetch(url, { method: "POST", keepalive: true }).catch(() => {});
    } catch { /* 统计失败不影响跳转 */ }
  }

  function bindFriendCardClicks(container) {
    if (!container) return;
    container.querySelectorAll(".friend-post-item").forEach(item => {
      if (item.dataset.clickBound) return;
      item.dataset.clickBound = "1";
      item.addEventListener("click", () => reportFriendClick(item.dataset.postId));
    });
  }

  function setFriendsLoadMoreText() {
    const el = document.getElementById("friendsLoadMore");
    if (!el) return;
    if (state.friendsLoading) el.innerHTML = `<span class="spinner"></span><span>${t("feed.loading_more")}</span>`;
    else if (!state.friendsDone) el.innerHTML = `<span>${t("feed.scroll_more")}</span>`;
    else el.innerHTML = state.friendsTotal ? `<span>${t("feed.reached_end")}</span>` : "";
  }

  let friendsLoadMoreObserver = null;
  function observeFriendsLoadMore() {
    if (friendsLoadMoreObserver) friendsLoadMoreObserver.disconnect();
    const sentinel = document.getElementById("friendsLoadMore");
    if (!sentinel) return;
    friendsLoadMoreObserver = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && !state.friendsLoading && !state.friendsDone) loadMoreFriends();
      },
      { rootMargin: "300px 0px 300px 0px", threshold: 0 }
    );
    friendsLoadMoreObserver.observe(sentinel);
  }

  async function loadMoreFriends() {
    if (state.friendsLoading || state.friendsDone) return;
    state.friendsLoading = true;
    setFriendsLoadMoreText();
    try {
      const next = state.friendsPage + 1;
      const data = await api(`/api/friends/posts?page=${next}`);
      const waterfall = document.getElementById("friendsWaterfall");
      if (waterfall && data.list && data.list.length) {
        waterfall.insertAdjacentHTML("beforeend", data.list.map(friendPostCardHtml).join(""));
        bindFriendCardClicks(waterfall);
        mountFriendsWaterfall();
      }
      state.friendsPage = next;
      state.friendsDone = !data.has_more;
    } catch (e) {
      state.friendsDone = true; // 失败后停止滚动触发，避免反复报错
      toast(e.message);
    } finally {
      state.friendsLoading = false;
      setFriendsLoadMoreText();
    }
  }

  async function renderFriends() {
    app.innerHTML = `<div class="essay"><div class="friends-wrap"><div class="essay-empty">${t("common.loading")}</div></div></div>`;
    try {
      state.friendsPage = 1;
      state.friendsLoading = false;
      state.friendsDone = false;
      const data = await api("/api/friends/posts?page=1");
      const posts = data.list || [];
      state.friendsTotal = Number(data.total || 0);
      state.friendsDone = !data.has_more;

      // 横幅背景图与全站一致（后台「横幅背景图」设置，同 photos/links 页）
      const fs = state.settings || {};
      const fbg = bannerInlineBg(fs);
      const fHasBg = fs.banner_bg_mode === "random" || /^https?:\/\//i.test(fs.banner_bg_image || "");
      app.innerHTML = `<div class="essay">
        <div class="banner-card friends-banner">
          <div class="banner-inner${fHasBg ? " has-bg" : ""}"${fHasBg ? ` data-banner-bg="1"` : ""}${fbg ? ` style="background-image:url('${esc(fbg).replace(/'/g, "%27")}')"` : ""}>
            <div class="banner-content">
              <div>
                <div class="banner-tips">${esc(fs.essay_tips || "")}</div>
                <span class="banner-title">友圈</span>
              </div>
              <div class="banner-bottom">
                <div class="banner-desc">朋友们的最新动态 · 共 ${state.friendsTotal} 篇</div>
              </div>
            </div>
          </div>
        </div>
        <div class="friends-wrap">
          ${posts.length
            ? `<div class="friends-list" id="friendsWaterfall">${posts.map(friendPostCardHtml).join("")}</div>
               <div class="essay-loadmore" id="friendsLoadMore"></div>`
            : `<div class="essay-empty">友圈还没有动态<br /><small style="color:var(--muted)">站长添加友站订阅后，朋友们的最新文章会出现在这里</small></div>`}
        </div>
      </div>`;

      setSeo({
        title: `友圈 · ${state.settings.site_title}`,
        description: "朋友们的最新动态",
        path: "/friends",
      });

      if (posts.length) {
        // 挂载瀑布流：头像尺寸固定、文本有 clamp，高度与图片加载无关，可立即布局；
        // RO 兜底字体晚到/语言切换等高度变化，容器 RO 处理断点切换
        mountFriendsWaterfall();
        bindFriendCardClicks(document.getElementById("friendsWaterfall"));
        setFriendsLoadMoreText();
        observeFriendsLoadMore();
      }
    } catch (e) {
      app.innerHTML = `<div class="essay"><div class="friends-wrap"><div class="essay-empty">${esc(e.message)}</div></div></div>`;
    }
  }

  /* ================= 申请友链（/links/apply） ================= */
  async function renderLinksApply() {
    const s = state.settings;
    const cats = String(s.links_categories || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const catOpts = cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
    const siteUrl = s.site_domain ? s.site_domain.replace(/\/$/, "") : location.origin;

    app.innerHTML = `<div class="essay"><div class="links-apply-wrap">
      <div class="links-page-head">
        <div class="links-eyebrow">${t("links.apply_eyebrow")}</div>
        <h1 class="links-title">${t("links.apply")}</h1>
        <p class="links-subtitle">${t("links.apply_subtitle")}</p>
      </div>
      <div class="links-apply-grid">
        <div class="links-info-card">
          <div class="links-info-title">${svgIcon("info", 18)} ${t("links.site_info_title")}</div>
          <p>${t("links.site_info_desc")}</p>
          <div class="links-siteinfo">
            <div><span>${t("links.apply_site_name")}</span><b data-copy="${esc(s.site_title || "")}">${esc(s.site_title || "")}</b></div>
            <div><span>${t("links.apply_site_url")}</span><b data-copy="${esc(siteUrl)}">${esc(siteUrl)}</b></div>
            <div><span>${t("links.apply_site_brief")}</span><b data-copy="${esc(s.essay_subtitle || "")}">${esc(s.essay_subtitle || "")}</b></div>
          </div>
        </div>
        <div class="links-info-card las-card">
          <div class="links-info-title">${svgIcon("list", 18)} ${t("links.apply_status_title")}</div>
          <p style="margin:.2rem 0 .8rem">${t("links.apply_status_sub")}</p>
          <div class="las-tabs" data-las-tabs>
            <button class="las-tab is-active" data-las-tab="all">${t("links.tab_all")} <span class="las-tab-count" data-las-count="all">0</span></button>
            <button class="las-tab" data-las-tab="pending">${t("links.tab_pending")} <span class="las-tab-count" data-las-count="pending">0</span></button>
            <button class="las-tab" data-las-tab="approved">${t("links.tab_approved")} <span class="las-tab-count" data-las-count="approved">0</span></button>
            <button class="las-tab" data-las-tab="rejected">${t("links.tab_rejected")} <span class="las-tab-count" data-las-count="rejected">0</span></button>
          </div>
          <div class="las-list" data-las-list></div>
          <div class="las-pager" data-las-pager></div>
        </div>
        <div class="links-info-card">
          <div class="links-info-title">${svgIcon("scroll-text", 18)} ${t("links.rules_title")}</div>
          <p>${t("links.rules_intro")}</p>
          <ol class="links-rules">
            <li>${t("links.rules_1")}</li>
            <li>${t("links.rules_2")}</li>
            <li>${t("links.rules_3")}</li>
            <li>${t("links.rules_4")}</li>
            <li>${t("links.rules_5")}</li>
          </ol>
        </div>
        <form class="links-info-card" id="linksApplyForm">
          <div class="links-info-title">${svgIcon("send", 18)} ${t("links.apply_form_title")}</div>
          <p style="margin:.2rem 0 1rem">${t("links.apply_form_tip")}</p>
          <div class="field"><label>${t("links.apply_site_name")} *</label><input name="name" maxlength="60" placeholder="${t("links.apply_name_ph")}" required /></div>
          <div class="field">
            <label>${t("links.apply_site_url")} *</label>
            <div style="display:flex;gap:.5rem">
              <input name="url" placeholder="https://example.com" required style="flex:1" />
              <button type="button" class="btn" id="linksFetchBtn">${t("links.fetch_auto")}</button>
            </div>
          </div>
          <div class="field">
            <label>${t("links.apply_feed_url")}</label>
            <input name="feed_url" maxlength="500" placeholder="${t("links.apply_feed_ph")}" />
            <small style="color:var(--anzhiyu-secondtext)">${t("links.apply_feed_hint")}</small>
          </div>
          <div class="field"><label>${t("links.apply_desc")}</label><input name="description" maxlength="300" placeholder="${t("links.apply_desc_ph")}" /></div>
          <div class="field"><label>${t("links.apply_email")}</label><input name="email" type="email" maxlength="120" placeholder="you@example.com" /></div>
          <div class="field"><label>${t("links.apply_category")}</label><select name="category">${catOpts}</select></div>
          <button class="btn primary" type="submit">${t("links.apply_submit")} ${svgIcon("check", 16)}</button>
          <div class="links-review">
            <div class="links-info-title">${t("links.review_title")}</div>
            <ol class="links-review-steps">
              <li class="is-done"><b>${t("links.review_1_title")}</b><span>${t("links.review_1_desc")}</span></li>
              <li><b>${t("links.review_2_title")}</b><span>${t("links.review_2_desc")}</span></li>
              <li><b>${t("links.review_3_title")}</b><span>${t("links.review_3_desc")}</span></li>
            </ol>
          </div>
        </form>
      </div>
    </div></div>`;

    // 同步浏览器标签页标题与 SEO
    setSeo({
      title: `${t("links.apply")} · ${s.site_title}`,
      description: t("links.apply_seo_desc"),
      path: "/links/apply",
      noindex: true,
    });

    // 自动获取站点信息
    const form = document.getElementById("linksApplyForm");
    const fetchBtn = document.getElementById("linksFetchBtn");
    if (fetchBtn && form) {
      fetchBtn.addEventListener("click", async () => {
        const url = form.querySelector('[name="url"]').value.trim();
        if (!url) { toast(t("links.fill_url_first")); return; }
        fetchBtn.disabled = true; fetchBtn.textContent = t("links.fetching");
        try {
          const info = await api(`/api/friends/info?url=${encodeURIComponent(url)}`);
          if (info.name) form.querySelector('[name="name"]').value = info.name;
          if (info.description) form.querySelector('[name="description"]').value = info.description;
          if (info.url) form.querySelector('[name="url"]').value = info.url;
          if (info.feed_url) {
            const feedEl = form.querySelector('[name="feed_url"]');
            if (feedEl && !feedEl.value.trim()) feedEl.value = info.feed_url;
          }
          toast(t("links.fetch_auto_ok"));
        } catch (err) {
          toast(err.message || t("links.fetch_auto_fail"));
        } finally {
          fetchBtn.disabled = false; fetchBtn.textContent = t("links.fetch_auto");
        }
      });
      form.addEventListener("submit", async e => {
        e.preventDefault();
        const fd = new FormData(form);
        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        try {
          await api("/api/friends/apply", { method: "POST", body: Object.fromEntries(fd) });
          toast(t("links.apply_toast"));
          navigate("/links");
        } catch (err) {
          toast(err.message || t("links.submit_failed"));
        } finally {
          btn.disabled = false;
        }
      });
    }

    // ===== 申请状态列表（tab + 分页 + 懒加载） =====
    const lasState = { tab: "all", page: 1, per_page: 10, counts: null };

    function lasTime(iso) {
      if (!iso) return "";
      const d = new Date(iso);
      const now = new Date();
      const diff = (now - d) / 86400000;
      const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      if (diff < 1) return `${t("links.time_today")} ${hhmm}`;
      if (diff < 2) return `${t("links.time_yesterday")} ${hhmm}`;
      if (diff < 365) return `${d.getMonth() + 1}-${d.getDate()} ${hhmm}`;
      return d.toISOString().slice(0, 10);
    }

    function lasStatusTag(status) {
      const cls = status === "approved" ? "is-approved" : status === "rejected" ? "is-rejected" : "is-pending";
      const label = t(`links.status_${status}`) || status;
      return `<span class="las-status ${cls}">${label}</span>`;
    }

    function lasListItem(row) {
      const approved = row.status === "approved";
      const cardOpen = approved ? `<a class="links-card las-apply-card" href="${esc(row.url)}" target="_blank" rel="noopener nofollow">` : `<div class="links-card las-apply-card">`;
      const cardClose = approved ? `</a>` : `</div>`;
      const domain = (row.url || "").replace(/^https?:\/\//i, "").replace(/\/$/, "");
      return `${cardOpen}
        <div class="links-card-top">
          ${friendAvatar(row.name, row.avatar)}
          <div class="links-card-info">
            <div class="links-card-name">${esc(row.name)}</div>
            <div class="links-card-domain">${esc(domain)}</div>
          </div>
          ${lasStatusTag(row.status)}
        </div>
        ${row.description ? `<div class="links-card-desc">${esc(row.description)}</div>` : ""}
        <div class="las-apply-foot">
          ${row.category ? `<span class="links-card-cat">${esc(row.category)}</span>` : ""}
          <span class="las-apply-time">${lasTime(row.created_at)}</span>
        </div>
      ${cardClose}`;
    }

    function lasPagerHTML(total, page, per_page) {
      const pages = Math.ceil(total / per_page);
      if (pages <= 1) return "";
      const cur = page;
      const show = 5;
      let start = Math.max(1, cur - Math.floor(show / 2));
      let end = Math.min(pages, start + show - 1);
      start = Math.max(1, end - show + 1);
      const nums = [];
      if (start > 1) { nums.push(1); if (start > 2) nums.push("..."); }
      for (let i = start; i <= end; i++) nums.push(i);
      if (end < pages) { if (end < pages - 1) nums.push("..."); nums.push(pages); }
      const prev = `<button class="las-page-btn" data-las-page="${cur - 1}" ${cur <= 1 ? "disabled" : ""}>‹</button>`;
      const next = `<button class="las-page-btn" data-las-page="${cur + 1}" ${cur >= pages ? "disabled" : ""}>›</button>`;
      return `<div class="las-pager-inner">${prev}${nums.map(n => typeof n === "string" ? `<span class="las-ell">${n}</span>` : `<button class="las-page-btn${n === cur ? " is-active" : ""}" data-las-page="${n}">${n}</button>`).join("")}${next}</div>`;
    }

    async function lasLoad() {
      const listEl = document.querySelector("[data-las-list]");
      const pagerEl = document.querySelector("[data-las-pager]");
      if (!listEl) return;
      listEl.innerHTML = `<div class="las-loading">${t("links.fetching")}</div>`;
      try {
        const params = new URLSearchParams({ page: String(lasState.page), per_page: String(lasState.per_page) });
        if (lasState.tab !== "all") params.set("status", lasState.tab);
        const d = await api(`/api/friends/all-applications?${params}`);
        lasState.counts = d.counts;
        Object.keys(d.counts).forEach(k => {
          const c = document.querySelector(`[data-las-count="${k}"]`);
          if (c) c.textContent = d.counts[k];
        });
        if (!d.list || d.list.length === 0) {
          const emptyKey = lasState.tab === "all" ? "links.no_records" : lasState.tab === "pending" ? "links.no_pending" : lasState.tab === "approved" ? "links.no_approved" : "links.no_rejected";
          listEl.innerHTML = `<div class="las-empty">${t(emptyKey)}</div>`;
        } else {
          listEl.innerHTML = d.list.map(lasListItem).join("");
        }
        if (pagerEl) pagerEl.innerHTML = lasPagerHTML(d.total, d.page, d.per_page);
      } catch (e) {
        listEl.innerHTML = `<div class="las-empty">${esc(e.message || "加载失败")}</div>`;
      }
    }

    document.querySelectorAll("[data-las-tab]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-las-tab]").forEach(b => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        lasState.tab = btn.dataset.lasTab;
        lasState.page = 1;
        lasLoad();
      });
    });

    document.addEventListener("click", e => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.matches("[data-las-page]")) {
        const p = parseInt(target.dataset.lasPage, 10);
        if (!Number.isFinite(p)) return;
        lasState.page = p;
        lasLoad();
      }
    });

    (async () => {
      try {
        const d = await api("/api/friends/all-applications?page=1&per_page=1");
        lasState.counts = d.counts;
        Object.keys(d.counts).forEach(k => {
          const c = document.querySelector(`[data-las-count="${k}"]`);
          if (c) c.textContent = d.counts[k];
        });
        if (d.counts.pending > 0) {
          document.querySelectorAll("[data-las-tab]").forEach(b => b.classList.remove("is-active"));
          const tb = document.querySelector('[data-las-tab="pending"]');
          if (tb) tb.classList.add("is-active");
          lasState.tab = "pending";
        }
        lasLoad();
      } catch {}
    })();
  }

  /** 联系方式 → lucide 图标名映射，未知类型回退 link */
  function contactIcon(type) {
    const t = String(type || "").toLowerCase();
    if (t.includes("github")) return "github";
    if (t.includes("mail") || t.includes("邮箱") || t.includes("email")) return "mail";
    if (t.includes("rss")) return "rss";
    if (t.includes("qq")) return "message-circle";
    if (t.includes("微博") || t.includes("weibo")) return "at-sign";
    if (t.includes("tg") || t.includes("telegram")) return "send";
    if (t.includes("b站") || t.includes("bilibili")) return "play";
    return "link";
  }

  /** 水合服务端直出的文章页：保留 SSR DOM（无重绘闪烁），仅绑定交互/增强排版 */
  /** 文章打赏卡片（SSR/SPA 通用）：已启用且有二维码时插入正文后，未启用则移除残留 */
  function hydrateRewardCard(root) {
    const enabled = state.settings.reward_enabled && state.settings.reward_qrcode;
    root.querySelectorAll(".reward-card").forEach(el => {
      if (!enabled) el.remove();
    });
    if (!enabled) return;
    const body = root.querySelector(".article-body");
    if (!body || root.querySelector(".reward-card")) return;
    const div = document.createElement("div");
    div.className = "reward-card";
    div.innerHTML = `
      <div class="reward-head">${svgIcon("coffee", 18)} ${esc(state.settings.reward_text || t("posts.reward_default"))}</div>
      <div class="reward-qr-wrap"><img class="reward-qr" src="${esc(state.settings.reward_qrcode)}" alt="${t("posts.reward_qr_alt")}" loading="lazy" referrerpolicy="no-referrer" /></div>`;
    body.insertAdjacentElement("afterend", div);
  }

  let tocDelegationBound = false;
  /** 目录链接点击委托：SSR/SPA 下统一处理，避免局部绑定失效导致点击不跳转 */
  function bindTocDelegation() {
    if (tocDelegationBound) return;
    tocDelegationBound = true;
    document.addEventListener("click", e => {
      const el = e.target && e.target.nodeType === 1 ? e.target : e.target.parentElement;
      const link = el && el.closest ? el.closest('a[href^="#toc-"]') : null;
      if (!link) return;
      if (!link.closest("[data-toc-sidebar], [data-toc-drawer]")) return;
      e.preventDefault();
      e.stopPropagation(); // 阻止 SPA 链接拦截器等后续 document 监听器重复处理
      const id = link.getAttribute("href").slice(1);
      const card = document.querySelector(".article-card");
      let target = null;
      if (card) {
        try {
          target = card.querySelector("#" + (window.CSS && CSS.escape ? CSS.escape(id) : id));
        } catch {
          target = card.querySelector("#" + id);
        }
      }
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      // 关闭移动端抽屉
      document.querySelector("[data-toc-drawer]")?.classList.remove("open");
      document.querySelector("[data-toc-mask]")?.classList.remove("open");
      document.querySelector("[data-toc-fab]")?.classList.remove("is-hidden");
    });
  }

  /** 文章目录 TOC：扫描正文 h2/h3，生成可折叠目录并支持点击平滑滚动 + 滚动高亮 */
  function buildArticleToc(root) {
    // 清理旧实例（SPA 切换 / SSR 水合重复调用时，全局清理避免残留）
    document.querySelectorAll("[data-toc-sidebar], [data-toc-fab], [data-toc-mask], [data-toc-drawer]").forEach(el => el.remove());
    const cardEl = root.classList && root.classList.contains("article-card") ? root : root.querySelector(".article-card");
    if (!cardEl) return;
    const body = cardEl.querySelector(".article-body");
    if (!body) return;
    const headings = Array.from(body.querySelectorAll("h2, h3"));
    if (headings.length < 2) return; // 标题太少不展示目录
    headings.forEach((h, i) => {
      if (!h.id) h.id = "toc-" + i;
    });

    const listHtml = headings
      .map((h, i) => {
        const isSub = h.tagName === "H3";
        const text = (h.textContent || "").trim().replace(/[#*`]/g, "").slice(0, 50);
        return `<li class="post-toc-item ${isSub ? "is-sub" : ""}" data-toc-idx="${i}"><a href="#${h.id}">${esc(text) || t("posts.toc_empty_heading")}</a></li>`;
      })
      .join("");

    // ---------- 桌面端：文章卡片右侧 sticky 悬浮目录（可折叠） ----------
    const aside = document.createElement("aside");
    aside.className = "toc-sidebar";
    aside.setAttribute("data-toc-sidebar", "");
    aside.innerHTML = `
      <div class="toc-sidebar-head">
        <span class="toc-sidebar-title">${svgIcon("list", 14)} ${t("posts.toc")}</span>
        <span class="toc-sidebar-count">${headings.length}</span>
        <button class="toc-sidebar-fold" data-toc-fold type="button" aria-label="${t("posts.toc_collapse")}">${svgIcon("chevron-right", 16)}</button>
      </div>
      <nav class="toc-sidebar-body"><ul>${listHtml}</ul></nav>`;
    cardEl.insertAdjacentElement("afterend", aside);

    // ---------- 移动端：右下角悬浮按钮 + 底部抽屉 ----------
    const fab = document.createElement("button");
    fab.className = "toc-fab";
    fab.setAttribute("data-toc-fab", "");
    fab.type = "button";
    fab.setAttribute("aria-label", t("posts.toc_open"));
    fab.innerHTML = svgIcon("list", 20);
    document.body.appendChild(fab);

    const mask = document.createElement("div");
    mask.className = "toc-drawer-mask";
    mask.setAttribute("data-toc-mask", "");
    document.body.appendChild(mask);

    const drawer = document.createElement("div");
    drawer.className = "toc-drawer";
    drawer.setAttribute("data-toc-drawer", "");
    drawer.innerHTML = `
      <div class="toc-drawer-head">
        <span>${t("posts.toc_open")}</span>
        <button class="toc-drawer-close" data-toc-close type="button" aria-label="${t("posts.toc_close")}">${svgIcon("x", 18)}</button>
      </div>
      <nav class="toc-drawer-body"><ul>${listHtml}</ul></nav>`;
    document.body.appendChild(drawer);

    const toggleDrawer = open => {
      mask.classList.toggle("open", open);
      drawer.classList.toggle("open", open);
      fab.classList.toggle("is-hidden", open);
    };

    // ---------- 事件绑定 ----------
    aside.querySelector("[data-toc-fold]").addEventListener("click", () => {
      aside.classList.toggle("collapsed");
    });
    fab.addEventListener("click", () => toggleDrawer(true));
    mask.addEventListener("click", () => toggleDrawer(false));
    drawer.querySelector("[data-toc-close]").addEventListener("click", () => toggleDrawer(false));
    // 目录链接点击走全局委托（bindTocDelegation），兼容 SSR/SPA 重复渲染
    bindTocDelegation();

    // ---------- 滚动高亮当前章节 ----------
    const allItems = document.querySelectorAll(".post-toc-item");
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        entries => {
          entries.forEach(en => {
            if (!en.isIntersecting) return;
            const idx = headings.indexOf(en.target);
            allItems.forEach(li => li.classList.toggle("is-active", Number(li.dataset.tocIdx) === idx));
          });
        },
        { rootMargin: "-15% 0px -70% 0px" }
      );
      headings.forEach(h => observer.observe(h));
    }
  }

  /* ==================== 文章页返回顶部 ==================== */
  const backTop = document.getElementById("backTop");
  let backTopShown = false;

  function syncBackTop() {
    if (!backTop) return;
    // 只服务三类长页面：文章详情、首页无限下拉流、友圈无限下拉流
    const p = location.pathname;
    const show =
      (p === "/" || p.startsWith("/post/") || p === "/friends") &&
      (window.scrollY || document.documentElement.scrollTop || 0) > 480;
    if (show === backTopShown) return;
    backTopShown = show;
    backTop.hidden = !show; // 淡入交给 CSS animation，无需等下一帧
  }

  window.addEventListener("scroll", syncBackTop, { passive: true });

  backTop?.addEventListener("click", () => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  });

  async function hydrateSsrPost(slug) {
    try {
      const p = await api("/api/posts/" + encodeURIComponent(slug));
      if (state.activeView !== "post") return;
      const card = Array.from(app.querySelectorAll(".article-card[data-ssr-post]")).find(
        el => el.dataset.ssrPost === slug
      );
      if (!card) {
        // DOM 已不在（例如快速切页后又返回）：走常规渲染
        renderPostDetail(slug);
        return;
      }
      setSeo({
        title: p.title + " · " + state.settings.site_title,
        description: p.excerpt,
        path: "/post/" + encodeURIComponent(p.slug),
        image: p.cover,
        type: "article",
      });
      // 正文用 marked 重新渲染（音乐卡片等增强）；爬虫已抓到 SSR 版本
      const bodyEl = card.querySelector(".article-body");
      if (bodyEl) bodyEl.innerHTML = sanitizeHtml(marked.parse(p.content_md || ""));
      hydrateMusicCards(app);
      hydrateVideos(app);
      hydrateRewardCard(card);
      buildArticleToc(card);
      const metaEl = card.querySelector(".article-meta");
      if (metaEl) metaEl.textContent = timeAgo(p.created_at);
      // P2 内容翻译：SSR 直出卡片没有翻译条/标题包裹，水合时按当前语言补上（原文 HTML 仍保留给爬虫）
      if (xlateEnabled()) {
        const h1 = card.querySelector("h1");
        if (h1 && !h1.querySelector("[data-xlate-title]")) {
          Array.from(h1.childNodes).forEach(n => {
            if (n.nodeType === 3 && n.nodeValue.trim()) {
              const sp = document.createElement("span");
              sp.setAttribute("data-xlate-title", "");
              sp.textContent = n.nodeValue;
              h1.replaceChild(sp, n);
            }
          });
        }
        if (!card.querySelector("[data-xlate-root]")) {
          card
            .querySelector(".article-body")
            ?.insertAdjacentHTML("beforebegin", xlateBarHtml("post", p.id));
        }
      }
      // 评论表单回填本地缓存（SSR 时无法读取访客 localStorage）
      const form = card.querySelector("[data-comment-form]");
      if (form) {
        const nick = localStorage.getItem("moments_nick") || "";
        const email = localStorage.getItem("moments_email") || "";
        const web = getSavedWebsite();
        const nEl = form.querySelector('input[name="nickname"]');
        if (nEl) nEl.value = nick;
        const emEl = form.querySelector('input[name="email"]');
        if (emEl) emEl.value = email;
        const wEl = form.querySelector('input[name="website"]');
        if (wEl) wEl.value = web;
        const avEl = form.querySelector("[data-qq-avatar]");
        if (avEl) avEl.textContent = (nick || "?").slice(0, 1).toUpperCase();
      }
      // 管理员操作区
      if (state.admin) {
        const actions = card.querySelector(".article-actions");
        if (actions) {
          actions.innerHTML = `<button class="btn" data-act="edit-post">编辑</button>
            <button class="btn danger" data-act="del-post">删除</button>
            <a class="btn" href="/posts">返回列表</a>`;
        }
      }
      card.querySelector('[data-act="edit-post"]')?.addEventListener("click", () => openPostEditor(p));
      card.querySelector('[data-act="del-post"]')?.addEventListener("click", async () => {
        if (!confirm("确定删除这篇文章？")) return;
        try {
          await api("/api/posts/" + p.id, { method: "DELETE" });
          toast("已删除");
          navigate("/posts");
        } catch (err) {
          toast(err.message);
        }
      });
      hydrateCommentSection({
        ctype: "post",
        cid: p.id,
        slug: p.slug,
        quote: p.title,
        comment_count: p.comment_count || 0,
      });
    } catch (e) {
      if (state.activeView !== "post") return;
      app.innerHTML = `<div class="essay"><div class="posts-wrap"><div class="essay-empty"><span class="empty-ico">${svgIcon("search", 56)}</span><span>${esc(e.message)}</span><a class="btn" href="/posts">${t("common.back")}</a></div></div></div>`;
    }
  }

  async function renderPostDetail(slug, preview) {
    state.activeView = "post";
    // 服务端已直出文章正文（#app 内带 data-ssr-post）：直接水合，不重绘
    if (!preview) {
      const ssrCard = Array.from(app.querySelectorAll(".article-card[data-ssr-post]")).find(
        el => el.dataset.ssrPost === slug
      );
      if (ssrCard) {
        hydrateSsrPost(slug);
        return;
      }
    }
    app.innerHTML = `<div class="essay"><div class="posts-wrap"><div class="essay-loading"><span class="spinner"></span><span>${t("common.loading")}</span></div></div></div>`;
    try {
      const p = await api("/api/posts/" + encodeURIComponent(slug) + (preview ? "?preview=1" : ""));
      if (state.activeView !== "post") return;
      setSeo({
        title: p.title + " · " + state.settings.site_title,
        description: p.excerpt,
        path: "/post/" + encodeURIComponent(p.slug),
        image: p.cover,
        type: "article",
      });
      app.innerHTML = `
      <div class="essay">
        <div class="post-layout">
        <div class="article-card">
          <a class="article-back" href="/" title="${t("posts.back_home")}">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"></path></svg>
            ${t("posts.back_home")}
          </a>
          <h1>${p.pinned ? `<span class="top-badge">${svgIcon("pin", 13)}<span>${t("feed.pinned")}</span></span>` : ""}<span data-xlate-title>${esc(p.title)}</span>${p.status === "draft" ? '<span class="draft-tag">草稿</span>' : ""}</h1>
          <div class="article-meta">${timeAgo(p.created_at)}</div>
          ${xlateEnabled() ? xlateBarHtml("post", p.id) : ""}
          <div class="article-body" data-xlate-body>${sanitizeHtml(marked.parse(p.content_md || ""))}</div>
          ${
            state.settings.reward_enabled && state.settings.reward_qrcode
              ? `<div class="reward-card">
                  <div class="reward-head">${svgIcon("coffee", 18)} ${esc(state.settings.reward_text || t("posts.reward_default"))}</div>
                  <div class="reward-qr-wrap"><img class="reward-qr" src="${esc(state.settings.reward_qrcode)}" alt="${t("posts.reward_qr_alt")}" loading="lazy" referrerpolicy="no-referrer" /></div>
                </div>`
              : ""
          }
          ${
            state.admin
              ? `<div class="article-actions">
                  <button class="btn" data-act="edit-post">编辑</button>
                  <button class="btn danger" data-act="del-post">删除</button>
                  <a class="btn" href="/posts">返回列表</a>
                </div>`
              : `<div class="article-actions"><a class="btn" href="/posts">${t("posts.back_list_short")}</a></div>`
          }
          <section class="article-comments" data-comment-section>
            <h3 class="comment-section-title">${t("comment.title")}<span class="comment-count-badge" data-article-comments-count></span></h3>
            <div class="comment-list" data-comment-list><span class="spinner"></span></div>
            <form class="comment-form-wrap comment-form-inline" data-comment-form data-ctype="post" data-cid="${p.id}" data-slug="${esc(p.slug)}">
              <div class="comment-form-row comment-user-row">
                <span class="qq-avatar" data-qq-avatar>${esc((localStorage.getItem("moments_nick") || "?").slice(0, 1).toUpperCase())}</span>
                <input name="nickname" placeholder="${t("comment.nick_or_qq_ph")}" maxlength="20" value="${esc(localStorage.getItem("moments_nick") || "")}" required autocomplete="off" />
              </div>
              <div class="comment-form-row">
                <input name="email" type="email" placeholder="${t("comment.email_ph")}" maxlength="100" value="${esc(localStorage.getItem("moments_email") || "")}" required />
                <input name="website" placeholder="${t("comment.website_ph")}" maxlength="200" value="${esc(getSavedWebsite())}" />
              </div>
              <div class="comment-toolbar">
                <button type="button" class="comment-tool-btn" data-emoji-btn title="${t("comment.owo")}">${svgIcon("smile", 18)}</button>
                <button type="button" class="comment-tool-btn" data-img-upload-btn title="${t("comment.upload_image")}">${svgIcon("image", 18)}</button>
                <input type="file" accept="image/*" data-img-file hidden />
                <input type="text" class="comment-img-url-input" data-img-url-input placeholder="${t("comment.image_url_ph")}" maxlength="500" />
                <button type="button" class="comment-tool-btn comment-random-btn" data-random-comment title="${t("comment.random_one")}">${svgIcon("dices", 18)}</button>
              </div>
              <textarea name="content" placeholder="${t("comment.placeholder_mention")}" maxlength="500" required style="min-height:100px"></textarea>
              <div class="comment-img-preview" data-comment-img-preview style="display:none"></div>
              <label class="comment-notify-row"><input type="checkbox" name="notify_reply" value="1" checked /> ${t("comment.notify_mine")}</label>
              <div class="comment-form-foot">
                <button class="btn primary" type="submit">${t("comment.submit")}</button>
              </div>
            </form>
          </section>
        </div>
        </div>
      </div>`;
      hydrateMusicCards(app);
      hydrateVideos(app);
      hydrateRewardCard(app);
      buildArticleToc(app);
      app.querySelector('[data-act="edit-post"]')?.addEventListener("click", () => openPostEditor(p));
      app.querySelector('[data-act="del-post"]')?.addEventListener("click", async () => {
        if (!confirm("确定删除这篇文章？")) return;
        try {
          await api("/api/posts/" + p.id, { method: "DELETE" });
          toast("已删除");
          navigate("/posts");
        } catch (e) {
          toast(e.message);
        }
      });
      // 文章内联评论区：直接渲染在正文下方，与说说共用评论逻辑（楼中楼/@/QQ头像/折叠）
      hydrateCommentSection({
        ctype: "post",
        cid: p.id,
        slug: p.slug,
        quote: p.title,
        comment_count: p.comment_count || 0,
      });
    } catch (e) {
      app.innerHTML = `<div class="essay"><div class="posts-wrap"><div class="essay-empty"><span class="empty-ico">${svgIcon("search", 56)}</span><span>${esc(e.message)}</span><a class="btn" href="/posts">${t("common.back")}</a></div></div></div>`;
    }
  }

  /* ================= 管理：解锁 ================= */

  /** 更新顶栏「后台」导航地址为秘密入口（桌面导航 + 移动菜单各一份） */
  function updateAdminNavHref() {
    document.querySelectorAll(".admin-only-nav").forEach(link => {
      link.setAttribute("href", state.adminPath || "/admin");
    });
  }

  function setAdminPath(p) {
    if (!p || p === state.adminPath) return;
    state.adminPath = p;
    try { localStorage.setItem("moments_admin_path", p); } catch (_) {}
    updateAdminNavHref();
  }

  async function refreshAdmin() {
    try {
      const data = await api("/api/admin/session");
      state.admin = !!data.admin;
      if (data.admin && data.admin_path) setAdminPath(data.admin_path);
    } catch (_) {
      state.admin = false;
    }
    renderAdminArea();
  }

  function renderAdminArea() {
    // 未登录时顶栏不显示任何后台入口（「解锁」按钮一并隐藏，后台对访客隐形）
    const html = state.admin
      ? `
      <button class="btn primary" data-nav="new-moment"><span class="label-text">＋ 说说</span></button>
      <button class="btn" data-nav="new-post"><span class="label-text">写文章</span></button>
      <button class="btn ghost" data-nav="logout" title="退出">退出</button>`
      : "";
    adminArea.innerHTML = html;
    const mobileAdmin = document.getElementById("adminAreaMobile");
    if (mobileAdmin) mobileAdmin.innerHTML = html;
    document.querySelectorAll(".admin-only-nav").forEach(link => {
      link.hidden = !state.admin;
    });
    updateAdminNavHref();
    syncFab();
  }

  /** 悬浮 + 仅管理员、且不在后台页、不在文章页时显示（文章页有 TOC 悬浮按钮，避免右下角重叠） */
  function syncFab() {
    fabPublish.hidden = !state.admin || location.pathname === state.adminPath || location.pathname.startsWith("/post/");
  }

  fabPublish.addEventListener("click", () => openMomentComposer());

  function openLogin() {
    const modal = openModal(`
      <div class="modal-head"><h3>站主解锁</h3></div>
      <form data-login-form>
        <div class="field">
          <label>管理密码</label>
          <input type="password" name="password" placeholder="输入 ADMIN_PASSWORD" autocomplete="current-password" required />
        </div>
        <div class="modal-foot">
          <button type="button" class="btn" data-close>取消</button>
          <button type="submit" class="btn primary">解锁</button>
        </div>
      </form>`);
    modal.querySelector("[data-close]").addEventListener("click", closeModal);
    modal.querySelector("input").focus();
    modal.querySelector("form").addEventListener("submit", async e => {
      e.preventDefault();
      const password = modal.querySelector('input[name="password"]').value;
      try {
        const data = await api("/api/admin/login", { method: "POST", body: { password, path: state.adminPath } });
        state.admin = true;
        if (data.admin_path) setAdminPath(data.admin_path);
        renderAdminArea();
        closeModal();
        toast("已解锁");
        if (location.pathname !== state.adminPath) navigate(state.adminPath, { replace: true });
        else route();
      } catch (err) {
        toast(err.status === 401 ? "密码错误" : err.message);
      }
    });
  }

  /* ================= 管理：发动态 ================= */

  /** 后台编辑评论内容/图片：小弹窗，PUT /api/admin/comments/:cid */
  function openCommentEditor(cid, content, images) {
    let imgs = Array.isArray(images) ? [...images] : [];
    const modal = openModal(`
      <div class="modal-head"><h3>编辑评论</h3><button type="button" class="modal-x" data-close aria-label="关闭">×</button></div>
      <form class="comment-edit-form" data-comment-edit-form data-cid="${cid}">
        <div class="field">
          <label>评论内容</label>
          <textarea name="content" maxlength="500" style="min-height:90px">${esc(content || "")}</textarea>
        </div>
        <div class="field">
          <label>评论图片（点右上角 × 可删除，最多 3 张）</label>
          <div class="cmt-edit-imgs" data-cmt-edit-imgs>${renderImgs()}</div>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn" data-close>取消</button>
          <button type="submit" class="btn primary">保存</button>
        </div>
      </form>`);
    modal.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", closeModal));
    const form = modal.querySelector("[data-comment-edit-form]");
    const imgBox = modal.querySelector("[data-cmt-edit-imgs]");
    function renderImgs() {
      if (!imgs.length) return `<div style="color:var(--anzhiyu-secondtext);font-size:.8rem">（无图片）</div>`;
      return imgs.map((u, i) => `<span class="cmt-edit-img"><img src="${esc(u)}" alt="" referrerpolicy="no-referrer" /><button type="button" class="cmt-edit-img-x" data-rm="${i}" aria-label="删除图片">×</button></span>`).join("");
    }
    imgBox.innerHTML = renderImgs();
    imgBox.addEventListener("click", e => {
      const btn = e.target.closest("[data-rm]");
      if (!btn) return;
      imgs.splice(Number(btn.dataset.rm), 1);
      imgBox.innerHTML = renderImgs();
    });
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const v = form.content.value.trim();
      if (!v && !imgs.length) return toast("评论内容和图片不能都为空");
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        await api(`/api/admin/comments/${cid}`, { method: "PUT", body: { content: v, images: imgs } });
        closeModal();
        toast("已更新");
        renderAdminComments(document.getElementById("adminPanel"));
      } catch (err) {
        toast(err.message);
        btn.disabled = false;
      }
    });
    setTimeout(() => form.content.focus(), 50);
  }

  /** 后台查看说说：弹窗预览单条说说（复用时间线渲染逻辑，不跳转首页） */
  function openMomentView(m) {
    const modal = openModal(`
      <div class="modal-head">
        <h3>说说预览</h3>
        <button type="button" class="modal-x" data-close aria-label="关闭">×</button>
      </div>
      <div class="moment-view">
        <div class="mv-meta">
          <time datetime="${esc(m.created_at)}">${timeAgo(m.created_at)}</time>
          ${m.location ? `<span class="mv-loc">${svgIcon("locationDot", 14)}${esc(m.location)}</span>` : ""}
          <span class="mv-stats">赞 ${m.like_count || 0} · 评论 ${m.comment_count || 0}</span>
        </div>
        ${m.content || (Array.isArray(m.videos) ? m.videos.length : m.video ? 1 : 0) || (m.images && m.images.length)
          ? `<div class="datacont">${renderContentHtml(m.content)}${videosHtml(m)}</div>${imagesGridHtml(m)}`
          : `<div class="comment-hint">这条说说没有正文内容</div>`}
      </div>`);
    modal.querySelector("[data-close]").addEventListener("click", closeModal);
    hydrateVideos(modal);
    hydrateMusicCards(modal);
  }

  /** 说说编辑器（独立）：发布即刻弹窗（插入行 + 音乐坞 + 图片工具条 + 一键定位） */
  function openMomentComposer(existing) {
    const isEdit = !!existing;
    const draft = {
      images: Array.isArray(existing?.images) ? [...existing.images] : [],
      videos: Array.isArray(existing?.videos)
        ? existing.videos.map(v => ({ ...v }))
        : existing?.video ? [{ ...existing.video }] : [],
    };
    const modal = openModal(`
      <div class="modal-head composer-head">
        <div class="ch-text">
          <h3>${isEdit ? "编辑即刻" : "发布即刻"}</h3>
          <p class="composer-sub">${isEdit ? "修改后将立即同步到时间线" : "记录此刻的想法，发布后将立即出现在时间线中"}</p>
        </div>
        <button type="button" class="modal-x" data-close aria-label="关闭">×</button>
      </div>
      <form data-moment-form>
        <div class="field">
          <label>内容<sup>*</sup></label>
          <textarea name="content" placeholder="记录此刻的想法…（支持简单 Markdown 语法）" maxlength="5000" style="min-height:112px"></textarea>
        </div>
        <div class="composer-insert">
          <span class="ci-label">插入：</span>
          <button type="button" class="ci-btn" data-ins-img>${mdIcon("image")}图片</button>
          <button type="button" class="ci-btn" data-ins-video>${mdIcon("video")}视频</button>
          <button type="button" class="ci-btn" data-ins-music>${mdIcon("music")}音乐</button>
          <span class="ci-sep"></span>
          <button type="button" class="ci-btn" data-ins-center title="将选中的文字居中（再点一次取消）">${mdIcon("alignCenter")}居中</button>
        </div>
        <!-- 图片面板 -->
        <div class="composer-panel" data-panel="img" hidden>
          <div class="pick-toolbar">
            <button type="button" class="btn pt-upload" data-add-img>${mdIcon("upload")}上传图片</button>
            <div class="pick-url">
              <input type="url" placeholder="或粘贴图片链接后回车添加" data-img-url />
              <button type="button" class="pick-url-add" data-add-url title="添加链接图片">＋</button>
            </div>
          </div>
          <div class="pick-grid" data-pick-grid></div>
          <input type="file" name="images" accept="image/jpeg,image/png,image/gif,image/webp" multiple hidden />
          <div class="upload-progress" data-img-progress></div>
          <p class="field-hint">支持 JPG/PNG/WebP，最多 9 张；可拖拽排序，也可 Ctrl+V 粘贴图片上传。</p>
        </div>
        <!-- 视频面板 -->
        <div class="composer-panel" data-panel="video" hidden>
          <div class="seg">
            <button type="button" data-vtab="mp4-upload" class="on">上传 MP4</button>
            <button type="button" data-vtab="url">在线地址</button>
          </div>
          <div data-vpanel="mp4-upload">
            <button type="button" class="btn block" data-video-pick>上传 MP4</button>
            <input type="file" accept="video/mp4" name="video-file" hidden />
            <div class="upload-progress" data-video-progress></div>
            <p class="field-hint">也可直接 Ctrl+V 粘贴视频文件上传（建议 ≤100MB）。</p>
          </div>
          <div data-vpanel="url" hidden>
            <div class="emp-row">
              <input type="url" name="video-url" placeholder="粘贴 B站 / YouTube 分享链接，或 .m3u8 / .mp4 直链" />
              <button type="button" class="btn primary" data-video-add-url>添加</button>
            </div>
            <div class="emp-row">
              <input type="url" data-moment-poster placeholder="封面图地址（选填，仅直链视频需要）" />
              <button type="button" class="btn" data-moment-poster-upload>上传</button>
              <input type="file" accept="image/*" data-moment-poster-file hidden />
            </div>
            <p class="field-hint">可点「上传」或 Ctrl+V 粘贴图片，自动回填封面地址。</p>
            <div class="emp-help">支持粘贴 B站 / YouTube 分享链接（自动取封面、点击播放）；也支持 .m3u8 或 .mp4 直链。可添加多条。</div>
          </div>
          <div class="video-preview" data-video-preview hidden></div>
        </div>
        <!-- 音乐面板 -->
        <div class="composer-panel" data-panel="music">
          <div data-music-box></div>
        </div>
        <div class="field">
          <label>地点</label>
          <div class="loc-wrap">
            <span class="loc-pin">${mdIcon("pin")}</span>
            <input name="location" placeholder="此刻在哪里？（可选）" maxlength="100" />
            <button type="button" class="loc-btn" data-locate title="一键定位当前位置">${mdIcon("crosshair")}</button>
          </div>
        </div>
        <div class="modal-foot compact">
          <button type="button" class="btn" data-close>取消</button>
          <button type="submit" class="btn primary">${mdIcon("rocket")}发布</button>
        </div>
      </form>`);

    const form = modal.querySelector("form");
    const ta = modal.querySelector('textarea[name="content"]');
    const grid = modal.querySelector("[data-pick-grid]");
    const fileInput = modal.querySelector('input[name="images"]');
    const insertRow = modal.querySelector(".composer-insert");

    // 编辑器内嵌可播放音乐坞（[music=ID] 实时渲染可试听卡片）
    editorMusicDock(ta, insertRow);

    // 面板选项卡切换：图片/视频/音乐 互斥显示，再点收起
    const panels = modal.querySelectorAll(".composer-panel");
    const ciBtns = modal.querySelectorAll(".ci-btn[data-ins-img], .ci-btn[data-ins-video], .ci-btn[data-ins-music]");
    function showPanel(name, btn) {
      const wasOpen = btn.classList.contains("on");
      ciBtns.forEach(b => b.classList.remove("on"));
      panels.forEach(p => (p.hidden = true));
      if (wasOpen) return; // 再点收起
      btn.classList.add("on");
      const panel = modal.querySelector(`[data-panel="${name}"]`);
      if (panel) panel.hidden = false;
    }
    modal.querySelector("[data-ins-img]").addEventListener("click", function () { showPanel("img", this); });
    modal.querySelector("[data-ins-video]").addEventListener("click", function () { showPanel("video", this); });
    modal.querySelector("[data-ins-center]").addEventListener("click", () => mdWrapCenter(ta));

    // 视频 tab 切换
    let vtab = "mp4-upload";
    modal.querySelectorAll("[data-vtab]").forEach(btn => {
      btn.addEventListener("click", () => {
        vtab = btn.dataset.vtab;
        modal.querySelectorAll("[data-vtab]").forEach(b => b.classList.toggle("on", b === btn));
        modal.querySelectorAll("[data-vpanel]").forEach(p => (p.hidden = p.dataset.vpanel !== vtab));
      });
    });

    // 视频预览卡片
    const videoFileInput = modal.querySelector('input[name="video-file"]');
    const videoPreview = modal.querySelector("[data-video-preview]");
    const vpCard = (v, idx) => {
      const isEmbed = v.kind === "embed";
      const kindLabel = isEmbed ? (v.provider === "youtube" ? "YouTube" : "哔哩哔哩") : v.kind === "hls" ? "M3U8" : "MP4";
      // embed 不请求站外封面，直接文字占位；mp4/hls 用本地 poster（无则「无封面」）
      let media;
      if (isEmbed) {
        media = `<div class="vp-no-poster">${kindLabel}</div>`;
      } else if (v.poster) {
        media = `<img class="vp-poster" src="${esc(v.poster)}" alt="封面" referrerpolicy="no-referrer" />`;
      } else {
        media = `<div class="vp-no-poster">无封面</div>`;
      }
      return `
        <div class="vp-card">
          ${media}
          <div class="vp-info">
            <span class="vp-kind">${kindLabel}</span>
            <span class="vp-src">${esc(isEmbed ? v.vid : (v.src || "").slice(0, 60))}</span>
          </div>
          <button type="button" class="btn ghost sm" data-rm-video data-idx="${idx}">移除</button>
        </div>`;
    };
    function renderVideoPreview() {
      if (!draft.videos.length) { videoPreview.hidden = true; videoPreview.innerHTML = ""; return; }
      videoPreview.hidden = false;
      videoPreview.innerHTML = draft.videos.map(vpCard).join("");
      // 本地 poster 也可能加载失败：裂图 → 降级为「无封面」
      videoPreview.querySelectorAll("img.vp-poster").forEach(img => {
        img.addEventListener("error", () => {
          const ph = document.createElement("div");
          ph.className = "vp-no-poster";
          ph.textContent = "无封面";
          img.replaceWith(ph);
        });
      });
    }
    // 事件委托：移除某个视频
    videoPreview.addEventListener("click", e => {
      const btn = e.target.closest("[data-rm-video]");
      if (!btn) return;
      const idx = Number(btn.dataset.idx);
      if (Number.isInteger(idx)) draft.videos.splice(idx, 1);
      renderVideoPreview();
    });

    // 音乐插入面板：面板显示时初始化音乐搜索
    const musicBox = modal.querySelector("[data-music-box]");
    let musicInited = false;
    modal.querySelector("[data-ins-music]").addEventListener("click", function () {
      showPanel("music", this);
      if (!musicInited && !this.classList.contains("on")) return;
      if (!musicInited && this.classList.contains("on")) {
        toggleMusicInsertPanel(musicBox, ta);
        musicInited = true;
      }
    });

    // 编辑模式：回填内容 / 地点 / 视频
    if (isEdit) {
      ta.value = existing.content || "";
      const locInput0 = modal.querySelector('input[name="location"]');
      if (locInput0 && existing.location) locInput0.value = existing.location;
      if (draft.videos.length) renderVideoPreview();
    }
    // 封面后台任务 Promise：发布前等待它完成（带超时兜底），避免封面还没传完
    // 就提交导致该条说说永久无封面
    let videoPosterPromise = null;
    // 上传本地 MP4（文件选择 / 粘贴共用）
    async function uploadMomentVideo(file) {
      if (!file) return;
      const prog = modal.querySelector("[data-video-progress]");
      prog.textContent = `上传视频 ${Math.round(file.size / 1048576)}MB，0%`;
      try {
        // HEVC 检测：iPhone 默认录制为 hvc1，Firefox/部分 Chrome 不能解码 → 有声音没画面
        // 转码为 H.264 后所有浏览器可播；H.264 视频直传无影响
        let videoToUpload = file;
        if (await detectHevcMp4(file)) {
          prog.textContent = "检测到 HEVC 视频，正在转码为 H.264…";
          videoToUpload = await transcodeHevcToAvc(file, p => {
            // 100% 后 ffmpeg 还要做音频封装（原 faststart 已移除），期间可能持续数秒~数十秒
            if (modal.isConnected) prog.textContent = p >= 0.995 ? "正在封装视频，请稍候…" : `转码 HEVC → H.264 ${Math.round(p * 100)}%（首次加载转码器约 30MB）`;
          });
          if (!modal.isConnected) return; // 弹窗已关：放弃后续上传，不再写已废弃的 draft
        }
        const data = await uploadMedia(videoToUpload, "video", p => {
          if (modal.isConnected) prog.textContent = `上传视频 ${Math.round(videoToUpload.size / 1048576)}MB，${Math.round(p * 100)}%`;
        });
        if (!modal.isConnected) return;
        const added = { kind: "mp4", src: data.key, poster: null };
        draft.videos.push(added);
        const uploadedSrc = data.key;
        renderVideoPreview();
        // 视频上传完成后异步截取并上传封面（不阻塞插入，失败静默；用户也可事后自定义）
        // 注意：从转码后的文件截取封面（HEVC 原文件在 canvas 上可能无法渲染）
        videoPosterPromise = (async () => {
          try {
            if (modal.isConnected) prog.textContent = "截取封面…";
            const posterBlob = await extractVideoPoster(videoToUpload);
            if (!posterBlob) { if (modal.isConnected) prog.textContent = ""; return; }
            const posterData = await uploadFile(new File([posterBlob], "poster.jpg", { type: "image/jpeg" }), "image");
            // 弹窗已关，或该视频已被用户移除：不写 draft
            if (!modal.isConnected || !draft.videos.includes(added) || added.src !== uploadedSrc) return;
            added.poster = posterData.key;
            renderVideoPreview();
          } catch {}
          if (modal.isConnected) prog.textContent = "";
        })();
      } catch (err) {
        if (modal.isConnected) { prog.textContent = ""; toast(err.message); }
      }
    }
    // 美化：点按钮唤起文件选择
    modal.querySelector("[data-video-pick]").addEventListener("click", () => videoFileInput.click());
    videoFileInput.addEventListener("change", () => {
      const f = videoFileInput.files[0];
      videoFileInput.value = ""; // 允许再次选择同一个文件
      uploadMomentVideo(f);
    });

    // 在线地址「添加」：把 B站/YouTube 链接或直链加入视频列表
    const addUrlBtn = modal.querySelector("[data-video-add-url]");
    if (addUrlBtn) {
      const doAddUrl = () => {
        const vu = modal.querySelector('input[name="video-url"]');
        const mp = modal.querySelector("[data-moment-poster]");
        const url = (vu?.value || "").trim();
        if (!url) return toast("请输入视频链接");
        const poster = (mp?.value || "").trim();
        const emb = parseEmbedUrl(url);
        if (emb) {
          draft.videos.push({ kind: "embed", provider: emb.provider, vid: emb.vid, src: "", poster: null });
        } else {
          const isHls = /\.m3u8($|\?)/i.test(url.split("?")[0] + "?");
          const ok = isHls || /\.mp4($|\?)/i.test(url.split("?")[0] + "?");
          if (!ok) return toast("请输入 B站/YouTube 分享链接，或 .m3u8 / .mp4 直链");
          draft.videos.push({ kind: isHls ? "hls" : "mp4", src: url, poster: poster || null });
        }
        if (vu) vu.value = "";
        if (mp) mp.value = "";
        if (draft.videos.length > 9) draft.videos.length = 9;
        renderVideoPreview();
        toast("已添加视频");
      };
      addUrlBtn.addEventListener("click", doAddUrl);
      const vu = modal.querySelector('input[name="video-url"]');
      if (vu) vu.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); doAddUrl(); } });
    }

    // 图片：上传 / 链接添加 / 缩略图删除与拖拽排序
    function renderPicks() {
      grid.innerHTML = draft.images
        .map(
          (src, i) => `
      <div class="pick-item" draggable="true" data-drag-idx="${i}">
        <img src="${esc(thumbSrc(src))}" alt=""${thumbSrc(src) !== src ? ` data-orig="${esc(src)}"` : ""} />
        <button type="button" class="remove" data-rm-img="${i}">×</button>
      </div>`
        )
        .join("");
    }
    renderPicks();
    modal.querySelector("[data-add-img]").addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", async () => {
      const files = [...fileInput.files];
      fileInput.value = "";
      if (!files.length) return;
      const room = 9 - draft.images.length;
      if (files.length > room) {
        toast("最多 9 张，多余的已忽略");
        files.splice(room);
      }
      const prog = modal.querySelector("[data-img-progress]");
      for (const file of files) {
        prog.textContent = `处理图片 ${file.name} …`;
        try {
          const data = await uploadMedia(file, "image", p => {
            prog.textContent = `上传图片 ${file.name} ${Math.round(p * 100)}%`;
          });
          draft.images.push(data.key);
          renderPicks();
        } catch (err) {
          toast(err.message);
        }
      }
      prog.textContent = draft.images.length ? `已选 ${draft.images.length} 张` : "";
    });

    const urlInput = modal.querySelector("[data-img-url]");
    const addUrlImg = () => {
      const v = urlInput.value.trim();
      if (!v) return;
      if (draft.images.length >= 9) return toast("最多 9 张图片");
      draft.images.push(v);
      urlInput.value = "";
      renderPicks();
    };
    modal.querySelector("[data-add-url]").addEventListener("click", addUrlImg);
    urlInput.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        addUrlImg();
      }
    });

    // 粘贴单张图片 → 上传并加入草稿（图片面板粘贴用）
    async function addPastedImage(file) {
      if (draft.images.length >= 9) return toast("最多 9 张图片");
      const prog = modal.querySelector("[data-img-progress]");
      prog.textContent = `处理粘贴图片 …`;
      try {
        const data = await uploadMedia(file, "image", p => {
          if (modal.isConnected) prog.textContent = `上传粘贴图片 ${Math.round(p * 100)}%`;
        });
        draft.images.push(data.key);
        renderPicks();
      } catch (err) {
        toast(err.message);
      }
      if (modal.isConnected) prog.textContent = draft.images.length ? `已选 ${draft.images.length} 张` : "";
    }

    // 上传封面图并回填到指定输入框（封面上传按钮 / 封面框粘贴共用）
    async function uploadMomentPoster(input, file) {
      const old = input.value;
      input.value = "上传中…";
      try {
        const data = await uploadMedia(file, "image", () => {});
        if (input.isConnected) { input.value = data.key; input.dispatchEvent(new Event("input")); }
        toast("封面已上传");
      } catch (err) {
        if (input.isConnected) input.value = old;
        toast(err.message);
      }
    }
    const posterInputM = modal.querySelector("[data-moment-poster]");
    const posterFileInput = modal.querySelector("[data-moment-poster-file]");
    modal.querySelector("[data-moment-poster-upload]").addEventListener("click", () => posterFileInput.click());
    posterFileInput.addEventListener("change", () => {
      const f = posterFileInput.files[0];
      posterFileInput.value = "";
      if (f) uploadMomentPoster(posterInputM, f);
    });

    // 弹窗内粘贴分流：按当前激活面板 / 焦点决定去向（仅拦截文件，文本粘贴照常）
    modal.addEventListener("paste", e => {
      const cd = e.clipboardData;
      if (!cd) return;
      const items = [...cd.items];
      const imgFile = items.find(it => it.kind === "file" && it.type.startsWith("image/"))?.getAsFile();
      const videoFile = items.find(it => it.kind === "file" && (it.type.startsWith("video/") || /\.mp4$/i.test(it.getAsFile?.()?.name || "")))?.getAsFile();
      // 1) 焦点在封面框：粘贴图片 → 回填封面
      if (document.activeElement === posterInputM && imgFile) {
        e.preventDefault();
        uploadMomentPoster(posterInputM, imgFile);
        return;
      }
      // 2) 图片面板可见：图片文件 → 加图；图片 URL 文本 → 当链接图
      const imgPanel = modal.querySelector('[data-panel="img"]');
      if (imgPanel && !imgPanel.hidden) {
        if (imgFile) { e.preventDefault(); addPastedImage(imgFile); return; }
        const txt = cd.getData("text/plain").trim();
        if (/^https?:\/\//i.test(txt)) { e.preventDefault(); urlInput.value = txt; addUrlImg(); return; }
      }
      // 3) 视频面板 + 上传 MP4 标签可见：粘贴视频文件 → 上传
      const videoPanel = modal.querySelector('[data-panel="video"]');
      const mp4Panel = videoPanel?.querySelector('[data-vpanel="mp4-upload"]');
      if (videoPanel && !videoPanel.hidden && mp4Panel && !mp4Panel.hidden && videoFile) {
        e.preventDefault();
        uploadMomentVideo(videoFile);
      }
    });

    let dragIdx = null;
    grid.addEventListener("dragstart", e => {
      const it = e.target.closest(".pick-item");
      if (!it) return;
      dragIdx = Number(it.dataset.dragIdx);
      it.classList.add("dragging");
    });
    grid.addEventListener("dragend", () => {
      dragIdx = null;
      grid.querySelectorAll(".pick-item.dragging").forEach(it => it.classList.remove("dragging"));
    });
    grid.addEventListener("dragover", e => {
      if (dragIdx === null) return;
      e.preventDefault();
      const it = e.target.closest(".pick-item");
      if (!it) return;
      const to = Number(it.dataset.dragIdx);
      if (to === dragIdx) return;
      const [moved] = draft.images.splice(dragIdx, 1);
      draft.images.splice(to, 0, moved);
      dragIdx = to;
      renderPicks();
    });
    grid.addEventListener("click", e => {
      const rm = e.target.closest("[data-rm-img]");
      if (rm) {
        draft.images.splice(Number(rm.dataset.rmImg), 1);
        renderPicks();
      }
    });

    // 地点一键定位（浏览器取坐标 → 同源 Worker 代理 OSM 反查地名，失败降级经纬度）
    const locInput = modal.querySelector('input[name="location"]');
    const locBtn = modal.querySelector("[data-locate]");
    locBtn.addEventListener("click", async () => {
      if (!navigator.geolocation) return toast("当前环境不支持定位（需 HTTPS 或 localhost）");
      const requestPos = opts =>
        new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, opts));
      locBtn.disabled = true;
      const oldHtml = locBtn.innerHTML;
      locBtn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px"></span>';

      // 两段式：先用 2 分钟内缓存/低精度快速取位（12s）；超时再开高精度 GPS 冷定位（25s）。
      // 手机 GPS 冷启动在室内常需 15s 以上，单次 10s 极易误报超时。
      let pos = null;
      let lastErr = null;
      try {
        pos = await requestPos({ enableHighAccuracy: false, timeout: 12000, maximumAge: 120000 });
      } catch (e1) {
        if (e1.code === 1) {
          lastErr = e1; // 权限被拒绝不必重试
        } else {
          toast("正在使用 GPS 精确定位，请稍候…");
          try {
            pos = await requestPos({ enableHighAccuracy: true, timeout: 25000, maximumAge: 0 });
          } catch (e2) {
            lastErr = e2;
          }
        }
      }

      if (!pos) {
        // 浏览器定位失败 → IP 定位兜底（Cloudflare 边缘自带数据，城市级，不依赖代理和外部服务）
        try {
          const j = await api("/api/geo/ip");
          if (Number.isFinite(j.latitude) && Number.isFinite(j.longitude)) {
            pos = { coords: { latitude: j.latitude, longitude: j.longitude } };
            toast("浏览器定位不可用，已改用 IP 定位（城市级精度）");
          }
        } catch (_) {}
      }

      if (!pos) {
        locBtn.disabled = false;
        locBtn.innerHTML = oldHtml;
        const code = lastErr?.code;
        const msg =
          code === 1
            ? "定位权限被拒绝，请在浏览器地址栏允许定位"
            : code === 2
              ? "暂时获取不到位置：请确认手机已开启系统定位（GPS），并到窗边或室外重试"
              : code === 3
                ? "定位超时：室内 GPS 信号弱或手机网络不佳，请到窗边/室外重试，并检查定位开关与网络"
                : "定位失败：" + (lastErr?.message || "未知错误");
        toast(msg);
        return;
      }

      const { latitude, longitude } = pos.coords;
      try {
        const j = await api(
          `/api/geo/reverse?lat=${latitude.toFixed(6)}&lon=${longitude.toFixed(6)}`
        );
        locInput.value = j.place || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        toast("已填入当前位置");
      } catch (_) {
        locInput.value = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        toast("地名解析失败，已填入经纬度");
      }
      locBtn.disabled = false;
      locBtn.innerHTML = oldHtml;
    });

    modal.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", closeModal));

    form.addEventListener("submit", async e => {
      e.preventDefault();
      const content = form.content.value.trim();
      const location = form.location.value.trim();
      // 视频已通过「添加」按钮进入 draft.videos；提交前兜底清掉未添加的残留输入
      if (!content && !draft.images.length && !draft.videos.length) return toast("内容不能为空");
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      // 封面仍在后台截取/上传时等待完成（最多 15s 兜底，超时先发布保证不卡死），
      // 否则该条说说会以 poster=null 永久落库
      if (videoPosterPromise) {
        btn.textContent = "封面处理中…";
        try {
          await Promise.race([videoPosterPromise, new Promise(r => setTimeout(r, 15000))]);
        } catch {}
      }
      try {
        if (isEdit) {
          await api(`/api/moments/${existing.id}`, {
            method: "PUT",
            body: { content, images: draft.images, videos: draft.videos, location },
          });
          closeModal();
          toast("已更新");
        } else {
          await api("/api/moments", {
            method: "POST",
            body: { content, images: draft.images, videos: draft.videos, location },
          });
          closeModal();
          toast("发布成功");
        }
        route();
        // 若在后台管理页，刷新说说列表（回到第 1 页看到新说说）
        // 注意：本函数内 location 被「定位输入框的值」遮蔽，必须用 window.location
        if (window.location.pathname.startsWith("/admin")) {
          renderAdminMoments(document.getElementById("adminPanel"), 1);
        }
      } catch (err) {
        toast(err.message);
        btn.disabled = false;
      }
    });
  }

  /* ================= 管理：写文章 ================= */

  function openPostEditor(existing) {
    const isEdit = !!existing;
    const modal = openModal(`
      <div class="modal-head"><h3>${isEdit ? "编辑文章" : "写文章"}</h3></div>
      <form data-post-form>
        <div class="field">
          <label>标题</label>
          <input name="title" maxlength="100" required value="${esc(existing?.title || "")}" />
        </div>
        <div class="field">
          <label>封面（选填，可上传或粘贴图片 URL）</label>
          <div style="display:flex;gap:8px">
            <input name="cover" placeholder="/media/... 或 https://..." value="${esc(existing?.cover || "")}" />
            <button type="button" class="btn" data-cover-upload style="white-space:nowrap">上传</button>
          </div>
          <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" hidden name="cover-file" />
        </div>
        <div class="field">
          <label>摘要（选填，留空自动取正文开头）</label>
          <input name="excerpt" maxlength="300" value="${esc(existing?.excerpt || "")}" />
        </div>
        <div class="field">
          <label>正文（Markdown）</label>
          <textarea name="content_md" required>${esc(existing?.content_md || "")}</textarea>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn" data-close>取消</button>
          <button type="submit" class="btn" name="status" value="draft">存草稿</button>
          <button type="submit" class="btn primary" name="status" value="published">${isEdit && existing.status !== "draft" ? "保存" : "发布"}</button>
        </div>
      </form>`, { size: "lg" });

    attachPostEditorTools(modal, "content_md");

    const coverInput = modal.querySelector('input[name="cover"]');
    const coverFile = modal.querySelector('input[name="cover-file"]');
    modal.querySelector("[data-cover-upload]").addEventListener("click", () => coverFile.click());
    coverFile.addEventListener("change", async () => {
      const file = coverFile.files[0];
      if (!file) return;
      try {
        toast("正在处理封面图片…");
        const data = await uploadMedia(file, "image");
        coverInput.value = data.key;
        toast("封面已上传");
      } catch (err) {
        toast(err.message);
      }
    });

    modal.querySelector("[data-close]").addEventListener("click", closeModal);

    modal.querySelector("form").addEventListener("submit", async e => {
      e.preventDefault();
      const submitter = e.submitter;
      const status = (submitter && submitter.value) || "published";
      const f = e.currentTarget;
      const payload = {
        title: f.title.value.trim(),
        cover: f.cover.value.trim(),
        excerpt: f.excerpt.value.trim(),
        content_md: f.content_md.value,
        status,
      };
      try {
        if (isEdit) {
          await api("/api/posts/" + existing.id, { method: "PUT", body: payload });
        } else {
          await api("/api/posts", { method: "POST", body: payload });
        }
        closeModal();
        toast(status === "draft" ? "草稿已保存" : "文章已发布");
        route();
      } catch (err) {
        toast(err.message);
      }
    });
  }

  /* ================= 后台管理页 ================= */

  // 一级导航：subs 存在时为分组（页内渲染二级子 tab），key 为默认（首个）叶子
  const ADMIN_NAV = [
    { key: "overview", label: "概览", icon: "layout-dashboard", subs: [
      { key: "overview", label: "概览" },
      { key: "analytics", label: "访问统计" },
    ]},
    { key: "moments", label: "说说", icon: "message-circle" },
    { key: "posts", label: "文章", icon: "file-text" },
    { key: "photos", label: "相册", icon: "image" },
    { key: "comments", label: "评论", icon: "message-square" },
    { key: "media", label: "媒体", icon: "folder" },
    { key: "music_player", label: "音乐", icon: "music", subs: [
      { key: "music_player", label: "播放器" },
      { key: "music_library", label: "曲库" },
    ]},
    { key: "appearance", label: "站点", icon: "settings", subs: [
      { key: "appearance", label: "外观" },
      { key: "i18n", label: "多语言" },
      { key: "about", label: "关于我" },
      { key: "friends", label: "友链" },
      { key: "ai", label: "AI 助手" },
    ]},
    { key: "security", label: "系统", icon: "shield", subs: [
      { key: "security", label: "安全与通知" },
      { key: "ops", label: "运维监控" },
      { key: "seo", label: "搜索收录" },
    ]},
  ];
  // 叶子 tab 扁平表（校验/标题用）
  const ADMIN_TABS = ADMIN_NAV.flatMap(n =>
    (n.subs ? n.subs.map(s => ({ key: s.key, label: s.label })) : [{ key: n.key, label: n.label }])
  );
  const findAdminNav = key => ADMIN_NAV.find(n => n.key === key || (n.subs && n.subs.some(s => s.key === key)));

  /**
   * 首次部署设初始密码：D1 无 password_hash 且环境变量 ADMIN_PASSWORD 未设置时，
   * /admin SSR 注入 x-admin-setup=1，前端渲染此表单。提交后写入 SHA-256 哈希并登录。
   */
  function renderAdminSetup() {
    setSeo({ title: `初始化 · ${state.settings.site_title}`, path: location.pathname, noindex: true });
    app.innerHTML = `
      <div class="essay"><div class="admin-wrap">
        <div class="admin-lock">
          <span class="lock-icon">${svgIcon("lock", 40)}</span>
          <h3 style="margin:0 0 .5rem">设置初始管理密码</h3>
          <p style="margin:0 0 1rem;color:var(--muted)">首次部署，请设置管理密码（6-128 位）</p>
          <form data-admin-setup>
            <input type="password" name="new_password" placeholder="设置管理密码" autocomplete="new-password" required minlength="6" maxlength="128"
              style="margin-bottom:.5rem;text-align:center" />
            <input type="password" name="confirm_password" placeholder="再次输入密码" autocomplete="new-password" required minlength="6" maxlength="128"
              style="margin-bottom:.75rem;text-align:center" />
            <button class="btn primary block" type="submit">设置并登录</button>
            <p class="setup-msg" style="margin:.6rem 0 0;font-size:.8rem;color:#f56c6c;min-height:1em"></p>
          </form>
        </div>
      </div></div>`;
    const form = app.querySelector("[data-admin-setup]");
    const msg = app.querySelector(".setup-msg");
    form.querySelector('input[name="new_password"]').focus();
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const newPwd = form.querySelector('input[name="new_password"]').value;
      const confirmPwd = form.querySelector('input[name="confirm_password"]').value;
      const btn = form.querySelector("button");
      msg.textContent = "";
      if (newPwd !== confirmPwd) {
        msg.textContent = "两次输入的密码不一致";
        return;
      }
      if (newPwd.length < 6) {
        msg.textContent = "密码至少 6 位";
        return;
      }
      btn.disabled = true;
      try {
        const data = await api("/api/admin/setup", {
          method: "POST",
          body: { new_password: newPwd, path: location.pathname },
        });
        state.admin = true;
        if (data.admin_path) setAdminPath(data.admin_path);
        toast("初始密码已设置，已自动登录");
        renderAdminArea();
        route();
      } catch (err) {
        msg.textContent = err.message || "设置失败";
        btn.disabled = false;
      }
    });
  }

  function renderAdmin() {
    const curPath = location.pathname;
    setSeo({ title: `管理后台 · ${state.settings.site_title}`, path: curPath, noindex: true });
    if (!state.admin) {
      app.innerHTML = `
        <div class="essay"><div class="admin-wrap">
          <div class="admin-lock">
            <span class="lock-icon">${svgIcon("lock", 40)}</span>
            <h3 style="margin:0 0 .5rem">站主解锁</h3>
            <p>请输入管理密码</p>
            <form data-entry-login>
              <input type="password" name="password" placeholder="管理密码" autocomplete="current-password" required
                style="margin-bottom:.75rem;text-align:center" />
              <button class="btn primary block" type="submit">解锁</button>
              <p class="entry-login-msg" style="margin:.6rem 0 0;font-size:.8rem;color:#f56c6c;min-height:1em"></p>
            </form>
          </div>
        </div></div>`;
      const form = app.querySelector("[data-entry-login]");
      const msg = app.querySelector(".entry-login-msg");
      form.querySelector("input").focus();
      form.addEventListener("submit", async e => {
        e.preventDefault();
        const password = form.querySelector('input[name="password"]').value;
        const btn = form.querySelector("button");
        btn.disabled = true;
        msg.textContent = "";
        try {
          // path 用当前地址（秘密入口路径即凭证）
          const data = await api("/api/admin/login", { method: "POST", body: { password, path: location.pathname } });
          state.admin = true;
          if (data.admin_path) setAdminPath(data.admin_path);
          renderAdminArea();
          toast("已解锁");
          route();
        } catch (err) {
          msg.textContent = err.status === 429 ? err.message : err.status === 401 ? "密码错误" : err.message;
          btn.disabled = false;
        }
      });
      return;
    }
    const hour = new Date().getHours();
    const greet = hour < 6 ? "夜深了" : hour < 11 ? "早上好" : hour < 14 ? "中午好" : hour < 18 ? "下午好" : "晚上好";
    const dateStr = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
    if (!ADMIN_TABS.some(t => t.key === state.adminTab)) state.adminTab = "overview";
    const curTab = ADMIN_TABS.find(t => t.key === state.adminTab) || ADMIN_TABS[0];
    app.innerHTML = `
      <div class="admin-app">
        <div class="admin-side-mask" data-admin-side-toggle></div>
        <aside class="admin-side">
          <div class="admin-brand">
            <span class="admin-logo">${svgIcon("pen-nib", 20)}</span>
            <div class="admin-brand-name"><b>${esc(state.settings.site_title || "moments")}</b><small>管理后台</small></div>
          </div>
          <nav class="admin-nav">
            ${ADMIN_NAV.map(n => {
              const active = n.key === state.adminTab || (n.subs && n.subs.some(s => s.key === state.adminTab));
              return `
              <button class="admin-nav-item ${active ? "is-active" : ""}" data-admin-tab="${n.key}">
                <span class="admin-nav-ico">${svgIcon(n.icon, 18)}</span>
                <span class="admin-nav-label">${n.label}</span>
              </button>`;
            }).join("")}
          </nav>
          <div class="admin-side-foot">
            <button class="btn ghost sm" data-nav="logout" title="退出登录">退出</button>
            <a class="admin-back-home" href="/" data-link>← 返回首页</a>
          </div>
        </aside>
        <main class="admin-main">
          <header class="admin-head">
            <div>
              <h2>${greet}，站长</h2>
              <span class="admin-head-date">${dateStr} · ${curTab.label}</span>
            </div>
            <div class="admin-head-actions">
              <button class="btn ghost sm admin-side-toggle" data-admin-side-toggle type="button">${svgIcon("menu", 16)} 菜单</button>
              <a class="btn ghost sm" href="/" data-link>查看网站</a>
            </div>
          </header>
          <div class="admin-panel" id="adminPanel">
            <div class="essay-loading"><span class="spinner"></span><span>加载中...</span></div>
          </div>
        </main>
      </div>`;
    loadAdminTab(state.adminTab);
    // 手机端：汉堡按钮 / 遮罩 开合抽屉；点导航项后自动收起；打开时锁背景滚动
    const appEl = app.querySelector(".admin-app");
    if (appEl) {
      const syncScroll = () => {
        document.body.style.overflow = appEl.classList.contains("is-open") ? "hidden" : "";
      };
      app.querySelectorAll("[data-admin-side-toggle]").forEach(el => {
        el.addEventListener("click", () => {
          appEl.classList.toggle("is-open");
          syncScroll();
        });
      });
      appEl.querySelectorAll(".admin-nav-item").forEach(item => {
        item.addEventListener("click", () => {
          appEl.classList.remove("is-open");
          syncScroll();
        });
      });
    }
  }

  const ADMIN_RENDERERS = {
    overview: renderAdminOverview,
    analytics: renderAdminAnalytics,
    moments: renderAdminMoments,
    posts: renderAdminPosts,
    photos: renderAdminPhotos,
    friends: renderAdminFriends,
    about: renderAdminAbout,
    comments: renderAdminComments,
    appearance: renderAdminAppearance,
    i18n: renderAdminI18n,
    media: renderAdminMedia,
    music_player: renderAdminMusicPlayer,
    music_library: renderAdminMusicLibrary,
    ai: renderAdminAI,
    seo: renderAdminSeo,
    security: renderAdminSecurity,
    ops: renderAdminOps,
  };

  function loadAdminTab(tab) {
    const panel = document.getElementById("adminPanel");
    if (!panel) return;
    const renderer = ADMIN_RENDERERS[tab];
    if (!renderer) return;
    const nav = findAdminNav(tab);
    if (nav && nav.subs) {
      // 分组：顶部二级子 tab + 子面板，渲染函数只负责子面板内容
      panel.innerHTML = `
        <div class="admin-subtabs">
          ${nav.subs.map(s => `
            <button class="admin-subtab ${s.key === tab ? "is-active" : ""}" data-admin-subtab="${s.key}">${s.label}</button>
          `).join("")}
        </div>
        <div class="admin-subpanel" id="adminSubPanel"></div>`;
      panel.querySelectorAll("[data-admin-subtab]").forEach(b => {
        b.addEventListener("click", () => {
          state.adminTab = b.dataset.adminSubtab;
          renderAdmin();
        });
      });
      renderer(document.getElementById("adminSubPanel"));
    } else {
      renderer(panel);
    }
  }

  /* ---------- 后台 Tab：概览仪表盘 ---------- */
  async function renderAdminOverview(panel) {
    let d;
    try { d = await api("/api/admin/overview"); } catch (e) { panel.innerHTML = `<p>概览加载失败：${esc(e.message)}</p>`; return; }
    const cards = [
      { label: "说说", icon: "message-circle", val: d.moments, tab: "moments" },
      { label: "文章", icon: "file-text", val: d.posts, tab: "posts" },
      { label: "评论", icon: "message-square", val: d.comments, tab: "comments" },
      { label: "相册", icon: "image", val: d.photos, tab: "photos" },
    ];
    // 近 7 天评论趋势 SVG 面积图
    const trend = d.trend || [];
    const max = Math.max(1, ...trend.map(t => t.count));
    const W = 640, H = 180, pad = 28;
    const n = trend.length;
    const x = i => pad + (i * (W - pad * 2)) / Math.max(1, n - 1);
    const y = v => H - pad - (v / max) * (H - pad * 2);
    const pts = trend.map((t, i) => `${x(i).toFixed(1)},${y(t.count).toFixed(1)}`);
    const linePts = pts.join(" ");
    const areaPts = `${pad},${H - pad} ${linePts} ${x(n - 1).toFixed(1)},${H - pad}`;
    const total = trend.reduce((s, t) => s + t.count, 0);
    panel.innerHTML = `
      <div class="ov-cards">
        ${cards.map(c => `
          <div class="ov-card" data-admin-tab="${c.tab}">
            <div class="ov-card-ico">${svgIcon(c.icon, 26)}</div>
            <div class="ov-card-num">${c.val}</div>
            <div class="ov-card-label">${c.label}</div>
          </div>`).join("")}
      </div>
      <div class="ov-chart-card">
        <div class="ov-chart-head">
          <h3>近 7 天评论</h3>
          <span class="ov-chart-sub">共 ${total} 条 · 峰值 ${max}</span>
        </div>
        <svg class="ov-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img">
          <defs><linearGradient id="ovFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--anzhiyu-main)" stop-opacity="0.28"/>
            <stop offset="100%" stop-color="var(--anzhiyu-main)" stop-opacity="0"/>
          </linearGradient></defs>
          ${[0.25, 0.5, 0.75].map(f => `<line x1="${pad}" y1="${(pad + (H - pad * 2) * f).toFixed(1)}" x2="${W - pad}" y2="${(pad + (H - pad * 2) * f).toFixed(1)}" stroke="var(--anzhiyu-card-border)" stroke-dasharray="4 5"/>`).join("")}
          <polygon points="${areaPts}" fill="url(#ovFill)"/>
          <polyline points="${linePts}" fill="none" stroke="var(--anzhiyu-main)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
          ${trend.map((t, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(t.count).toFixed(1)}" r="3.5" fill="var(--anzhiyu-card-bg)" stroke="var(--anzhiyu-main)" stroke-width="2"/>`).join("")}
        </svg>
        <div class="ov-chart-axis">${trend.map(t => `<span>${t.date.slice(5)}</span>`).join("")}</div>
      </div>
      <p class="ov-tip">提示：点击上方数字卡片可快速跳转到对应管理页。</p>`;
  }

  /* ---------- 后台 Tab：访问统计 ---------- */
  let analyticsDays = 7;
  let analyticsSub = "overview";
  let analyticsStart = ""; // 自定义日期范围起始（YYYY-MM-DD），为空则用 days
  let analyticsEnd = "";   // 自定义日期范围结束

  // 生成当前查询参数：自定义范围用 start/end，否则用 days
  function analyticsQS() {
    return analyticsStart && analyticsEnd
      ? `start=${encodeURIComponent(analyticsStart)}&end=${encodeURIComponent(analyticsEnd)}`
      : `days=${analyticsDays}`;
  }
  // CSV 导出：headers 为表头数组，rows 为行数组
  function exportCSV(filename, headers, rows) {
    const escCell = v => { v = String(v ?? ""); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
    const csv = [headers.map(escCell).join(","), ...rows.map(r => r.map(escCell).join(","))].join("\n");
    // BOM 让 Excel 正确识别 UTF-8
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function renderAdminAnalytics(panel) {
    const rangeLabel = analyticsStart && analyticsEnd
      ? `${analyticsStart} ~ ${analyticsEnd}`
      : `近 ${analyticsDays} 天`;
    const head = `
      <div class="ov-chart-head" style="margin-bottom:1rem">
        <h3>访问统计</h3>
        <span class="an-subtabs">
          <button type="button" class="an-subtab ${analyticsSub === "overview" ? "on" : ""}" data-asub="overview">总览</button>
          <button type="button" class="an-subtab ${analyticsSub === "daily" ? "on" : ""}" data-asub="daily">每日明细</button>
          <button type="button" class="an-subtab ${analyticsSub === "sources" ? "on" : ""}" data-asub="sources">来源分析</button>
          <button type="button" class="an-subtab ${analyticsSub === "posts" ? "on" : ""}" data-asub="posts">文章统计</button>
        </span>
        <span class="an-days">
          ${[7, 30, 90].map(d => `<button type="button" class="an-daybtn ${!analyticsStart && analyticsDays === d ? "on" : ""}" data-andays="${d}">${d}天</button>`).join("")}
        </span>
        <span class="an-daterange">
          <input type="date" class="an-date-input" id="anDateStart" value="${analyticsStart}" max="${new Date().toISOString().slice(0,10)}">
          <span class="an-date-sep">~</span>
          <input type="date" class="an-date-input" id="anDateEnd" value="${analyticsEnd}" max="${new Date().toISOString().slice(0,10)}">
          <button type="button" class="btn sm an-date-btn" data-arange>查询</button>
          ${(analyticsStart && analyticsEnd) ? `<button type="button" class="btn sm an-date-clear" data-aclear>清除</button>` : ""}
        </span>
        <span class="an-range-label">${rangeLabel}</span>
      </div>`;
    panel.innerHTML = `${head}<div class="essay-loading"><span class="spinner"></span><span>加载中...</span></div>`;
    panel.querySelectorAll("[data-asub]").forEach(b => b.addEventListener("click", () => { analyticsSub = b.dataset.asub; renderAdminAnalytics(panel); }));
    panel.querySelectorAll("[data-andays]").forEach(b => b.addEventListener("click", () => { analyticsDays = Number(b.dataset.andays); analyticsStart = ""; analyticsEnd = ""; renderAdminAnalytics(panel); }));
    panel.querySelector("[data-arange]")?.addEventListener("click", () => {
      const sv = panel.querySelector("#anDateStart").value;
      const ev = panel.querySelector("#anDateEnd").value;
      if (!sv || !ev) { alert("请选择开始和结束日期"); return; }
      if (sv > ev) { alert("开始日期不能晚于结束日期"); return; }
      analyticsStart = sv; analyticsEnd = ev;
      renderAdminAnalytics(panel);
    });
    panel.querySelector("[data-aclear]")?.addEventListener("click", () => { analyticsStart = ""; analyticsEnd = ""; renderAdminAnalytics(panel); });
    if (analyticsSub === "posts") return renderAnalyticsPosts(panel, head);
    if (analyticsSub === "daily") return renderAnalyticsDaily(panel, head);
    if (analyticsSub === "sources") return renderAnalyticsSources(panel, head);

    let s, v;
    try {
      [s, v] = await Promise.all([
        api(`/api/admin/analytics/summary?${analyticsQS()}`),
        api(`/api/admin/analytics/visitors?limit=50`),
      ]);
    } catch (e) { panel.innerHTML = `${head}<p>加载失败：${esc(e.message)}</p>`; return; }

    const fmtDur = sec => { sec = Number(sec) || 0; const m = Math.floor(sec / 60), r = sec % 60; return m ? `${m}分${r}秒` : `${r}秒`; };
    // 静态路由 → 中文名；详情页回退用标题；都没有则显示原路径
    const PAGE_NAMES = { "/": "首页", "/moments": "说说", "/posts": "文章", "/about": "关于", "/links": "友链", "/photos": "相册", "/search": "搜索", "/music": "音乐", "/feed": "订阅" };
    const pageName = (path, title) => { path = path || "/"; return PAGE_NAMES[path] || (title ? title : path); };
    // IPv6 太长：缩写显示前 3 段，完整地址仍可点击复制
    const shortIp = ip => {
      if (!ip) return "隐藏";
      if (!ip.includes(":")) return ip;
      const seg = ip.split(":").filter(Boolean);
      return seg.length > 3 ? seg.slice(0, 3).join(":") + "…" : ip;
    };
    // 环比对比：箭头 + 百分比
    const trendPct = (cur, prev) => {
      if (!prev) return cur > 0 ? { dir: "up", pct: 100 } : null; // 上期为 0
      const diff = (cur - prev) / prev * 100;
      if (Math.abs(diff) < 0.1) return null;
      return { dir: diff > 0 ? "up" : "down", pct: Math.abs(Math.round(diff * 10) / 10) };
    };
    const arrowHtml = (cur, prev) => {
      const t = trendPct(cur, prev);
      if (!t) return `<span class="an-prev-flat">持平</span>`;
      return `<span class="an-prev-${t.dir}">${t.dir === "up" ? "↑" : "↓"} ${t.pct}%</span>`;
    };
    const cards = [
      { label: "浏览量 PV", val: s.pv, prev: s.prevPv },
      { label: "独立访客 UV", val: s.uv, prev: s.prevUv },
      { label: "人均浏览", val: s.pvPerUv, prev: s.prevPvPerUv },
      { label: "来源数", val: s.refCount, prev: s.prevRefCount },
      { label: "访问页面", val: s.pathCount, prev: s.prevPathCount },
      { label: "平均停留", val: fmtDur(s.avgDuration), prev: s.prevAvgDuration ? fmtDur(s.prevAvgDuration) : 0, raw: [s.avgDuration, s.prevAvgDuration] },
    ];
    const barList = (title, rows) => {
      const max = Math.max(1, ...rows.map(r => r.n));
      return `<div class="an-block"><h4>${title}</h4>${rows.length ? rows.map(r => {
        const nm = r.href ? `<a href="${esc(r.href)}" target="_blank" rel="noopener nofollow" title="${esc(r.href)}">${esc(r.name || "未知")}</a>` : `<span title="${esc(r.name)}">${esc(r.name || "未知")}</span>`;
        return `<div class="an-barrow"><span class="an-barname">${nm}</span><span class="an-bartrack"><span class="an-barfill" style="width:${(r.n / max * 100).toFixed(1)}%"></span></span><span class="an-barnum">${r.n}</span></div>`;
      }).join("") : `<p class="an-empty">暂无数据</p>`}</div>`;
    };
    // 趋势图（PV/UV 双折线）
    const trend = s.trend || [];
    const W = 640, H = 170, pad = 30;
    const maxV = Math.max(1, ...trend.map(t => Math.max(t.pv, t.uv)));
    const x = i => pad + (i * (W - pad * 2)) / Math.max(1, trend.length - 1);
    const y = v => H - pad - (v / maxV) * (H - pad * 2);
    const line = arr => trend.map((t, i) => `${x(i).toFixed(1)},${y(arr(t)).toFixed(1)}`).join(" ");

    const visitorList = v.list || [];
    let vPage = 1;
    const vPerPage = 15;
    const vPages = Math.ceil(visitorList.length / vPerPage) || 1;
    const visitorHtml = list => list.map(sess => {
      const loc = [sess.country, sess.region, sess.city].filter(Boolean).join(" · ") || "未知";
      const pages = sess.pages.map(p => `<span class="an-page" title="${esc(p.path || "/")}">${esc(pageName(p.path, p.title))}<i>${fmtDur(p.dur)}</i></span>`).join("");
      const t = new Date(sess.last);
      return `<div class="an-visitor">
        <div class="an-vhead">
          <span class="an-vip" data-copy="${esc(sess.ip)}" title="点击复制完整 IP">${esc(shortIp(sess.ip))}</span>
          <span class="an-vloc">${esc(loc)}</span>
          <span class="an-vdev">${esc(sess.device)} · ${esc(sess.os)} · ${esc(sess.browser)}</span>
          <span class="an-vtime">${t.getMonth() + 1}/${t.getDate()} ${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}</span>
          <span class="an-vdur">停留 ${fmtDur(sess.duration)}</span>
        </div>
        <div class="an-vpages">${pages}</div>
      </div>`;
    }).join("");
    const vStart = (vPage - 1) * vPerPage;
    const vPager = vPages > 1 ? `<div class="an-pager"><button type="button" class="btn sm" data-vprev ${vPage <= 1 ? "disabled" : ""}>上一页</button><span>${vPage} / ${vPages}</span><button type="button" class="btn sm" data-vnext ${vPage >= vPages ? "disabled" : ""}>下一页</button></div>` : "";
    // 横轴日期标签抽样：数据点多时只显示约 8 个，避免 90 天挤爆
    const anAxisStep = Math.max(1, Math.ceil(trend.length / 8));
    const anAxisLabels = trend.map((t, i) => (i % anAxisStep === 0 || i === trend.length - 1) ? `<span>${t.date.slice(5)}</span>` : "").join("");

    panel.innerHTML = `
      ${head}
      <div class="ov-cards an-cards">${cards.map(c => `
        <div class="ov-card">
          <div class="ov-card-num">${c.val}</div>
          <div class="ov-card-label">${c.label}</div>
          <div class="ov-card-prev">${arrowHtml(c.raw ? c.raw[0] : c.val, c.raw ? c.raw[1] : c.prev)}</div>
        </div>`).join("")}</div>
      <div class="ov-chart-card">
        <div class="ov-chart-head"><h3>浏览趋势</h3><span class="ov-chart-sub">${rangeLabel}</span><button type="button" class="btn sm an-export-btn" data-export="overview">导出CSV</button></div>
        <svg class="ov-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img">
          ${[0.25, 0.5, 0.75].map(f => `<line x1="${pad}" y1="${(pad + (H - pad * 2) * f).toFixed(1)}" x2="${W - pad}" y2="${(pad + (H - pad * 2) * f).toFixed(1)}" stroke="var(--anzhiyu-card-border)" stroke-dasharray="4 5"/>`).join("")}
          <polyline points="${line(t => t.pv)}" fill="none" stroke="var(--anzhiyu-main)" stroke-width="2.5" stroke-linejoin="round"/>
          <polyline points="${line(t => t.uv)}" fill="none" stroke="#9ca3af" stroke-width="2" stroke-dasharray="5 4" stroke-linejoin="round"/>
        </svg>
        <div class="ov-chart-axis">${anAxisLabels}</div>
        <p class="an-legend"><span><i style="background:var(--anzhiyu-main)"></i>PV</span><span><i style="background:#9ca3af"></i>UV</span></p>
      </div>
      <div class="an-grid">
        ${barList("热门页面", s.topPaths.map(r => ({ name: pageName(r.name, r.title), n: r.n })))}
        ${barList("来源网站", s.referrers.map(r => ({ name: (() => { try { return new URL(r.name).host; } catch { return r.name; } })(), href: /^https?:\/\//i.test(r.name) ? r.name : "", n: r.n })))}
        ${barList("国家/地区", s.countries)}
        ${barList("设备", s.devices)}
      </div>
      <div class="an-block"><h4>最近访客（${visitorList.length} 个会话）</h4>
        <div id="anVisitorBox">${visitorHtml(visitorList.slice(vStart, vStart + vPerPage)) || `<p class="an-empty">暂无访客记录</p>`}</div>${vPager}</div>`;

    const refreshVisitors = () => {
      const box = panel.querySelector("#anVisitorBox");
      const pager = panel.querySelector(".an-pager");
      if (!box) return;
      const start = (vPage - 1) * vPerPage;
      box.innerHTML = visitorHtml(visitorList.slice(start, start + vPerPage)) || `<p class="an-empty">暂无访客记录</p>`;
      if (pager) pager.innerHTML = `<button type="button" class="btn sm" data-vprev ${vPage <= 1 ? "disabled" : ""}>上一页</button><span>${vPage} / ${vPages}</span><button type="button" class="btn sm" data-vnext ${vPage >= vPages ? "disabled" : ""}>下一页</button>`;
      bindVPager();
    };
    const bindVPager = () => {
      panel.querySelector("[data-vprev]")?.addEventListener("click", () => { if (vPage > 1) { vPage--; refreshVisitors(); } });
      panel.querySelector("[data-vnext]")?.addEventListener("click", () => { if (vPage < vPages) { vPage++; refreshVisitors(); } });
    };
    bindVPager();

    panel.querySelectorAll("[data-asub]").forEach(b => b.addEventListener("click", () => { analyticsSub = b.dataset.asub; renderAdminAnalytics(panel); }));
    panel.querySelectorAll("[data-andays]").forEach(b => b.addEventListener("click", () => { analyticsDays = Number(b.dataset.andays); analyticsStart = ""; analyticsEnd = ""; renderAdminAnalytics(panel); }));
    // 总览导出 CSV：趋势 + 排行
    panel.querySelector("[data-export=\"overview\"]")?.addEventListener("click", () => {
      const rows = trend.map(t => [t.date, t.pv, t.uv]);
      // 追加排行榜数据
      s.topPaths.forEach(r => rows.push([`热门页:${pageName(r.name, r.title)}`, r.n, ""]));
      exportCSV(`访问统计-总览-${rangeLabel}.csv`, ["日期/类别", "PV", "UV"], rows);
    });
  }

  /* ---------- 每日明细子标签 ---------- */
  async function renderAnalyticsDaily(panel, head) {
    const fmtDur = sec => { sec = Number(sec) || 0; const m = Math.floor(sec / 60), r = Math.round(sec % 60); return m ? `${m}分${r}秒` : `${r}秒`; };
    const PAGE_NAMES = { "/": "首页", "/moments": "说说", "/posts": "文章", "/about": "关于", "/links": "友链", "/photos": "相册", "/search": "搜索", "/music": "音乐", "/feed": "订阅" };
    const pageName = (path, title) => { path = path || "/"; return PAGE_NAMES[path] || (title ? title : path); };
    const hostOf = url => { try { return new URL(url).host; } catch { return url || "直接访问"; } };
    const barList = (title, rows) => {
      const max = Math.max(1, ...rows.map(r => r.n));
      return `<div class="an-block"><h4>${title}</h4>${rows.length ? rows.map(r => {
        const nm = r.href ? `<a href="${esc(r.href)}" target="_blank" rel="noopener nofollow" title="${esc(r.href)}">${esc(r.name || "未知")}</a>` : `<span title="${esc(r.name)}">${esc(r.name || "未知")}</span>`;
        return `<div class="an-barrow"><span class="an-barname">${nm}</span><span class="an-bartrack"><span class="an-barfill" style="width:${(r.n / max * 100).toFixed(1)}%"></span></span><span class="an-barnum">${r.n}</span></div>`;
      }).join("") : `<p class="an-empty">暂无数据</p>`}</div>`;
    };

    let data;
    try {
      data = await api(`/api/admin/analytics/daily?${analyticsQS()}`);
    } catch (e) { panel.innerHTML = `${head}<p>加载失败：${esc(e.message)}</p>`; return; }
    const list = data.list || [];
    const rangeLabel = analyticsStart && analyticsEnd ? `${analyticsStart} ~ ${analyticsEnd}` : `近 ${analyticsDays} 天`;
    if (!list.length) { panel.innerHTML = `${head}<p class="an-empty">${rangeLabel} 暂无访问记录</p>`; return; }

    let dPage = 1;
    const dPerPage = 15;
    const dPages = Math.ceil(list.length / dPerPage) || 1;

    const rowHtml = rows => rows.map((r, i) => {
      const idx = (dPage - 1) * dPerPage + i + 1;
      const devParts = [
        r.mobile ? `移动 ${r.mobile}` : "",
        r.desktop ? `桌面 ${r.desktop}` : "",
        r.tablet ? `平板 ${r.tablet}` : "",
      ].filter(Boolean).join(" · ") || "—";
      const topPage = r.topPath ? pageName(r.topPath, r.topTitle) : "—";
      const d = new Date(r.date);
      const isToday = r.date === new Date().toISOString().slice(0, 10);
      return `<tr class="an-day-row" data-date="${esc(r.date)}">
        <td class="an-day-idx">${idx}</td>
        <td class="an-day-date">${isToday ? "<strong>" : ""}${d.getMonth() + 1}/${d.getDate()}${isToday ? "</strong>" : ""}<small>${r.date.slice(0, 7)}</small></td>
        <td class="an-day-pv">${r.pv}</td>
        <td class="an-day-uv">${r.uv}</td>
        <td class="an-day-dur">${r.avgDuration ? fmtDur(r.avgDuration) : "—"}</td>
        <td class="an-day-dev">${devParts}</td>
        <td class="an-day-ref">${r.refCount || "—"}</td>
        <td class="an-day-top" title="${esc(r.topPath || "")}">${esc(topPage)}</td>
        <td class="an-day-toggle"><button type="button" class="btn sm an-day-btn">展开</button></td>
      </tr>
      <tr class="an-day-detail" data-date-detail="${esc(r.date)}" hidden><td colspan="9"></td></tr>`;
    }).join("");

    const pager = dPages > 1 ? `<div class="an-pager"><button type="button" class="btn sm" data-dprev ${dPage <= 1 ? "disabled" : ""}>上一页</button><span>${dPage} / ${dPages}</span><button type="button" class="btn sm" data-dnext ${dPage >= dPages ? "disabled" : ""}>下一页</button></div>` : "";

    // 区间汇总卡片
    const sum = data.summary || {};
    const sumCards = [
      { label: "总浏览量 PV", val: sum.pv || 0 },
      { label: "独立访客 UV", val: sum.uv || 0 },
      { label: "日均 PV", val: sum.avgPvPerDay || 0 },
      { label: "平均停留", val: sum.avgDuration ? fmtDur(sum.avgDuration) : "—" },
    ];

    panel.innerHTML = `${head}
      <div class="ov-cards an-cards4">${sumCards.map(c => `
        <div class="ov-card">
          <div class="ov-card-num">${c.val}</div>
          <div class="ov-card-label">${c.label}</div>
        </div>`).join("")}</div>
      <div class="an-day-toolbar"><button type="button" class="btn sm an-export-btn" data-export="daily">导出CSV</button></div>
      <div class="an-day-table-wrap">
        <table class="an-day-table">
          <thead><tr>
            <th>#</th><th>日期</th><th>PV</th><th>UV</th><th>平均停留</th><th>设备分布</th><th>来源数</th><th>热门页面</th><th></th>
          </tr></thead>
          <tbody id="anDayBody">${rowHtml(list.slice(0, dPerPage))}</tbody>
        </table>
      </div>
      <div id="anDayPager">${pager}</div>`;

    // innerHTML 被替换后重新绑定子 tab 和天数切换
    panel.querySelectorAll("[data-asub]").forEach(b => b.addEventListener("click", () => { analyticsSub = b.dataset.asub; renderAdminAnalytics(panel); }));
    panel.querySelectorAll("[data-andays]").forEach(b => b.addEventListener("click", () => { analyticsDays = Number(b.dataset.andays); analyticsStart = ""; analyticsEnd = ""; renderAdminAnalytics(panel); }));
    // 每日明细导出 CSV
    panel.querySelector("[data-export=\"daily\"]")?.addEventListener("click", () => {
      const rows = list.map(r => [r.date, r.pv, r.uv, r.avgDuration ? fmtDur(r.avgDuration) : "", `${r.mobile ? "移动" + r.mobile : ""} ${r.desktop ? "桌面" + r.desktop : ""} ${r.tablet ? "平板" + r.tablet : ""}`.trim(), r.refCount, r.topPath ? pageName(r.topPath, r.topTitle) : ""]);
      exportCSV(`访问统计-每日明细-${rangeLabel}.csv`, ["日期", "PV", "UV", "平均停留", "设备分布", "来源数", "热门页面"], rows);
    });

    const refreshDay = () => {
      const body = panel.querySelector("#anDayBody");
      const pg = panel.querySelector("#anDayPager");
      const start = (dPage - 1) * dPerPage;
      if (body) body.innerHTML = rowHtml(list.slice(start, start + dPerPage)) || `<tr><td colspan="9" class="an-empty">暂无数据</td></tr>`;
      if (pg) pg.innerHTML = dPages > 1 ? `<button type="button" class="btn sm" data-dprev ${dPage <= 1 ? "disabled" : ""}>上一页</button><span>${dPage} / ${dPages}</span><button type="button" class="btn sm" data-dnext ${dPage >= dPages ? "disabled" : ""}>下一页</button>` : "";
      bindRowEvents();
      bindPager();
    };

    const bindRowEvents = () => {
      panel.querySelectorAll(".an-day-row").forEach(row => {
        const btn = row.querySelector(".an-day-btn");
        if (!btn) return;
        const handler = async () => {
          const date = row.dataset.date;
          const detail = panel.querySelector(`[data-date-detail="${date}"]`);
          if (!detail) return;
          if (row.classList.contains("open")) { row.classList.remove("open"); detail.hidden = true; btn.textContent = "展开"; return; }
          row.classList.add("open"); detail.hidden = false; btn.textContent = "收起";
          if (detail.dataset.loaded) return;
          detail.querySelector("td").innerHTML = `<span class="spinner"></span> 加载中…`;
          try {
            const s = await api(`/api/admin/analytics/summary?date=${date}`);
            const cards = [
              { label: "浏览量 PV", val: s.pv },
              { label: "独立访客 UV", val: s.uv },
              { label: "人均浏览", val: s.pvPerUv || 0 },
              { label: "平均停留", val: fmtDur(s.avgDuration) },
            ];
            detail.querySelector("td").innerHTML = `
              <div class="an-day-expand">
                <div class="ov-cards an-cards4">${cards.map(c => `<div class="ov-card"><div class="ov-card-num">${c.val}</div><div class="ov-card-label">${c.label}</div></div>`).join("")}</div>
                <div class="an-grid">
                  ${barList("热门页面", (s.topPaths || []).map(r => ({ name: pageName(r.name, r.title), n: r.n })))}
                  ${barList("来源网站", (s.referrers || []).map(r => ({ name: hostOf(r.name), href: /^https?:\/\//i.test(r.name) ? r.name : "", n: r.n })))}
                  ${barList("国家/地区", s.countries || [])}
                  ${barList("设备", s.devices || [])}
                </div>
              </div>`;
            detail.dataset.loaded = "1";
          } catch (e) { detail.querySelector("td").innerHTML = `<p class="an-empty">加载失败：${esc(e.message)}</p>`; }
        };
        btn.addEventListener("click", handler);
      });
    };

    const bindPager = () => {
      const prev = panel.querySelector("[data-dprev]");
      const next = panel.querySelector("[data-dnext]");
      if (prev && !prev.disabled) prev.addEventListener("click", () => { dPage = Math.max(1, dPage - 1); refreshDay(); });
      if (next && !next.disabled) next.addEventListener("click", () => { dPage = Math.min(dPages, dPage + 1); refreshDay(); });
    };

    bindRowEvents();
    bindPager();
  }

  /* ---------- 来源分析子标签 ---------- */
  async function renderAnalyticsSources(panel, head) {
    const fmtDur = sec => { sec = Number(sec) || 0; const m = Math.floor(sec / 60), r = Math.round(sec % 60); return m ? `${m}分${r}秒` : `${r}秒`; };
    const TYPE_COLORS = { search: "#3b82f6", social: "#ec4899", direct: "#6b8e6b", external: "#f59e0b", internal: "#8b5cf6" };
    const TYPE_LABELS = { search: "搜索引擎", social: "社交媒体", direct: "直接访问", external: "外链", internal: "站内" };

    let data;
    try {
      data = await api(`/api/admin/analytics/sources?${analyticsQS()}`);
    } catch (e) { panel.innerHTML = `${head}<p>加载失败：${esc(e.message)}</p>`; return; }

    const types = data.types || [];
    const trend = data.trend || [];
    const refs = data.referrers || [];
    const totalPv = data.totalPv || 0;
    const rangeLabel = analyticsStart && analyticsEnd ? `${analyticsStart} ~ ${analyticsEnd}` : `近 ${analyticsDays} 天`;

    if (!totalPv) { panel.innerHTML = `${head}<p class="an-empty">${rangeLabel} 暂无访问记录</p>`; return; }

    // 环形图（SVG donut）
    const R = 70, cx = 90, cy = 90, strokeW = 22;
    const C = 2 * Math.PI * R;
    let acc = 0;
    const donutSegs = types.map(t => {
      const len = (t.pv / totalPv) * C;
      const seg = { color: TYPE_COLORS[t.key] || "#ccc", label: t.label, pct: t.pct, pv: t.pv, dash: `${len} ${C - len}`, offset: -acc };
      acc += len;
      return seg;
    });

    // 趋势堆叠柱状图
    const tW = 640, tH = 160, pad = 30;
    const dayCount = trend.length;
    const barW = dayCount > 1 ? Math.max(4, (tW - pad * 2) / dayCount - 2) : 20;
    const maxV = Math.max(1, ...trend.map(t => types.reduce((s, ty) => s + (Number(t[ty.key]) || 0), 0)));
    const x = i => pad + (i * (tW - pad * 2)) / Math.max(1, dayCount - 1) - barW / 2;
    const y = v => tH - pad - (v / maxV) * (tH - pad * 2);
    // 横轴日期标签：数据点多时抽样显示，避免 90 天挤爆
    const maxAxisLabels = 8;
    const axisStep = Math.max(1, Math.ceil(dayCount / maxAxisLabels));
    const axisLabels = trend.map((t, i) => (i % axisStep === 0 || i === dayCount - 1) ? `<span>${t.date.slice(5)}</span>` : "").join("");
    let bars = "";
    trend.forEach((t, i) => {
      let stackH = 0;
      types.forEach(ty => {
        const v = Number(t[ty.key]) || 0;
        if (!v) return;
        const h = (v / maxV) * (tH - pad * 2);
        bars += `<rect x="${x(i).toFixed(1)}" y="${(y(v) + stackH).toFixed(1)}" width="${barW}" height="${h.toFixed(1)}" fill="${TYPE_COLORS[ty.key]}" opacity="0.85" rx="1.5"><title>${t.date.slice(5)} ${ty.label}: ${v}</title></rect>`;
        stackH += h;
      });
    });

    // 来源明细列表
    const refList = refs.slice(0, 20);
    const maxRef = Math.max(1, ...refList.map(r => r.pv));

    panel.innerHTML = `${head}
      <div class="ov-cards">${types.map(t => `
        <div class="ov-card" style="border-top:3px solid ${TYPE_COLORS[t.key]}">
          <div class="ov-card-num">${t.pv}</div>
          <div class="ov-card-label">${t.label} · ${t.pct}%</div>
        </div>`).join("")}</div>

      <div class="an-grid" style="grid-template-columns:1fr 1.5fr">
        <div class="an-block an-src-donut">
          <h4>来源占比</h4>
          <svg viewBox="0 0 180 180" class="an-donut" role="img">
            <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="var(--anzhiyu-secondbg)" stroke-width="${strokeW}"/>
            ${donutSegs.map(s => `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${s.color}" stroke-width="${strokeW}" stroke-dasharray="${s.dash}" stroke-dashoffset="${s.offset}" transform="rotate(-90 ${cx} ${cy})"><title>${s.label}: ${s.pv} (${s.pct}%)</title></circle>`).join("")}
            <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="22" font-weight="700" fill="var(--anzhiyu-fontcolor)">${totalPv}</text>
            <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="12" fill="var(--anzhiyu-secondtext)">总 PV</text>
          </svg>
          <div class="an-donut-legend">${donutSegs.map(s => `<span><i style="background:${s.color}"></i>${s.label} ${s.pct}%</span>`).join("")}</div>
        </div>
        <div class="an-block an-src-trend">
          <h4>来源趋势 <small>${rangeLabel}</small></h4>
          <svg viewBox="0 0 ${tW} ${tH}" class="an-trend" preserveAspectRatio="none" role="img">
            ${[0.25, 0.5, 0.75].map(f => `<line x1="${pad}" y1="${(pad + (tH - pad * 2) * f).toFixed(1)}" x2="${tW - pad}" y2="${(pad + (tH - pad * 2) * f).toFixed(1)}" stroke="var(--anzhiyu-card-border)" stroke-dasharray="4 5"/>`).join("")}
            ${bars}
          </svg>
          <div class="ov-chart-axis">${axisLabels}</div>
        </div>
      </div>

      <div class="an-block">
        <h4>来源明细（Top ${refList.length}） <button type="button" class="btn sm an-export-btn" data-export="sources">导出CSV</button></h4>
        ${refList.length ? refList.map(r => `
          <div class="an-barrow">
            <span class="an-barname"><i class="an-src-tag" style="background:${TYPE_COLORS[r.type] || "#ccc"}" title="${TYPE_LABELS[r.type] || r.type}">${TYPE_LABELS[r.type] || r.type}</i><span title="${esc(r.name)}">${esc(r.name)}</span></span>
            <span class="an-bartrack"><span class="an-barfill" style="width:${(r.pv / maxRef * 100).toFixed(1)}%"></span></span>
            <span class="an-barnum">${r.pv}</span>
          </div>`).join("") : `<p class="an-empty">暂无数据</p>`}
      </div>`;

    // innerHTML 被替换后重新绑定子 tab 和天数切换
    panel.querySelectorAll("[data-asub]").forEach(b => b.addEventListener("click", () => { analyticsSub = b.dataset.asub; renderAdminAnalytics(panel); }));
    panel.querySelectorAll("[data-andays]").forEach(b => b.addEventListener("click", () => { analyticsDays = Number(b.dataset.andays); analyticsStart = ""; analyticsEnd = ""; renderAdminAnalytics(panel); }));
    // 来源分析导出 CSV
    panel.querySelector("[data-export=\"sources\"]")?.addEventListener("click", () => {
      const rows = refs.map(r => [r.name, TYPE_LABELS[r.type] || r.type, r.pv, r.uv, r.avgDur ? fmtDur(r.avgDur) : ""]);
      exportCSV(`访问统计-来源分析-${rangeLabel}.csv`, ["来源", "类型", "PV", "UV", "平均停留"], rows);
    });
  }

  /* ---------- 文章统计子标签 ---------- */
  async function renderAnalyticsPosts(panel, head) {
    const fmtDur = sec => { sec = Number(sec) || 0; const m = Math.floor(sec / 60), r = Math.round(sec % 60); return m ? `${m}分${r}秒` : `${r}秒`; };
    const shortIp = ip => { if (!ip) return "隐藏"; if (!ip.includes(":")) return ip; const s = ip.split(":").filter(Boolean); return s.length > 3 ? s.slice(0,3).join(":")+"…" : ip; };
    const hostOf = url => { try { return new URL(url).host; } catch { return url || "直接访问"; } };
    const barList = (title, rows) => {
      const max = Math.max(1, ...rows.map(r => r.n));
      return `<div class="an-block"><h4>${title}</h4>${rows.length ? rows.map(r => {
        const nm = r.href ? `<a href="${esc(r.href)}" target="_blank" rel="noopener nofollow" title="${esc(r.href)}">${esc(r.name || "未知")}</a>` : `<span title="${esc(r.name)}">${esc(r.name || "未知")}</span>`;
        return `<div class="an-barrow"><span class="an-barname">${nm}</span><span class="an-bartrack"><span class="an-barfill" style="width:${(r.n / max * 100).toFixed(1)}%"></span></span><span class="an-barnum">${r.n}</span></div>`;
      }).join("") : `<p class="an-empty">暂无数据</p>`}</div>`;
    };
    let data;
    try {
      data = await api(`/api/admin/analytics/posts?${analyticsQS()}`);
    } catch (e) { panel.innerHTML = `${head}<p>加载失败：${esc(e.message)}</p>`; return; }
    const posts = data.posts || [];
    const rangeLabel = analyticsStart && analyticsEnd ? `${analyticsStart} ~ ${analyticsEnd}` : `近 ${analyticsDays} 天`;
    if (!posts.length) { panel.innerHTML = `${head}<p class="an-empty">${rangeLabel} 暂无文章访问记录</p>`; return; }
    // 文章区汇总卡片
    const sum = data.summary || {};
    const sumCards = [
      { label: "文章数", val: sum.postCount || 0 },
      { label: "总浏览量 PV", val: sum.pv || 0 },
      { label: "独立访客 UV", val: sum.uv || 0 },
      { label: "平均每篇 PV", val: sum.avgPvPerPost || 0 },
    ];
    panel.innerHTML = `${head}
      <div class="ov-cards an-cards4">${sumCards.map(c => `
        <div class="ov-card">
          <div class="ov-card-num">${c.val}</div>
          <div class="ov-card-label">${c.label}</div>
        </div>`).join("")}</div>
      <div class="an-day-toolbar"><button type="button" class="btn sm an-export-btn" data-export="posts">导出CSV</button></div>
      <div class="an-post-list">${posts.map((p, i) => `
        <div class="an-post-row${p._open ? " open" : ""}" data-apost="${esc(p.path)}">
          <div class="an-post-main">
            <span class="an-post-rank">${i + 1}</span>
            <span class="an-post-title" title="${esc(p.path)}">${esc(p.title || p.path)}</span>
            <span class="an-post-pv">${p.pv} 次浏览</span>
            <span class="an-post-uv">${p.uv} 访客</span>
            <span class="an-post-dur">均 ${fmtDur(p.avg_dur)}</span>
            <span class="an-post-time">${p.last_visit ? p.last_visit.slice(5, 16).replace("T", " ") : ""}</span>
            <button type="button" class="an-post-toggle">详情</button>
          </div>
          <div class="an-post-detail" ${p._open ? "" : "hidden"} data-apost-detail="${esc(p.path)}"></div>
        </div>`).join("")}</div>`;

    panel.querySelectorAll("[data-apost]").forEach(row => {
      row.querySelector(".an-post-toggle").addEventListener("click", async () => {
        const detail = row.querySelector("[data-apost-detail]");
        if (row.classList.contains("open")) { row.classList.remove("open"); detail.hidden = true; return; }
        row.classList.add("open"); detail.hidden = false;
        if (detail.dataset.loaded) return;
        detail.innerHTML = `<span class="spinner"></span> 加载中…`;
        try {
          const d = await api(`/api/admin/analytics/post?path=${encodeURIComponent(row.dataset.apost)}&${analyticsQS()}`);
          const perUv = d.uv ? Math.round(d.pv / d.uv * 10) / 10 : 0;
          const cards = [
            { label: "浏览量 PV", val: d.pv },
            { label: "访客数 UV", val: d.uv },
            { label: "人均浏览", val: perUv },
            { label: "平均停留", val: fmtDur(d.avgDuration) },
          ];
          const visitorList2 = d.visitors || [];
          let dPage = 1;
          const dPerPage = 15;
          const dPages = Math.ceil(visitorList2.length / dPerPage) || 1;
          const visitorHtml2 = list => list.map(v => {
            const t = new Date(v.at);
            const fromHtml = v.from && /^https?:\/\//i.test(v.from)
              ? `<a class="an-vfrom" href="${esc(v.from)}" target="_blank" rel="noopener nofollow" title="${esc(v.from)}">${esc(hostOf(v.from))}</a>`
              : `<span class="an-vfrom">直接访问</span>`;
            return `<div class="an-visitor">
              <div class="an-vhead">
                <span class="an-vip" data-copy="${esc(v.ip)}" title="点击复制IP">${esc(shortIp(v.ip))}</span>
                <span class="an-vloc">${esc(v.loc)}</span>
                <span class="an-vdev">${esc(v.device)} · ${esc(v.os)} · ${esc(v.browser)}</span>
                <span class="an-vtime">${t.getMonth()+1}/${t.getDate()} ${String(t.getHours()).padStart(2,"0")}:${String(t.getMinutes()).padStart(2,"0")}</span>
                <span class="an-vdur">${fmtDur(v.dur)}</span>
                ${fromHtml}
              </div></div>`;
          }).join("");
          const dStart = (dPage - 1) * dPerPage;
          const dPager = dPages > 1 ? `<div class="an-pager"><button type="button" class="btn sm" data-dprev ${dPage <= 1 ? "disabled" : ""}>上一页</button><span>${dPage} / ${dPages}</span><button type="button" class="btn sm" data-dnext ${dPage >= dPages ? "disabled" : ""}>下一页</button></div>` : "";
          detail.innerHTML = `
            <div class="ov-cards an-cards4">${cards.map(c => `<div class="ov-card"><div class="ov-card-num">${c.val}</div><div class="ov-card-label">${c.label}</div></div>`).join("")}</div>
            <div class="an-grid">${barList("来源", d.referrers.map(r=>({name:hostOf(r.name),href:/^https?:\/\//i.test(r.name)?r.name:"",n:r.n})))}${barList("地域", d.regions)}</div>
            <div class="an-block"><h4>访客明细（${visitorList2.length} 条）</h4>
              <div class="an-detail-visitors">${visitorHtml2(visitorList2.slice(dStart, dStart + dPerPage)) || `<p class="an-empty">暂无记录</p>`}</div>${dPager}</div>`;
          detail.dataset.loaded = "1";
          const refreshDetailVisitors = () => {
            const box = detail.querySelector(".an-detail-visitors");
            const pager = detail.querySelector(".an-pager");
            if (!box) return;
            const start = (dPage - 1) * dPerPage;
            box.innerHTML = visitorHtml2(visitorList2.slice(start, start + dPerPage)) || `<p class="an-empty">暂无记录</p>`;
            if (pager) pager.innerHTML = `<button type="button" class="btn sm" data-dprev ${dPage <= 1 ? "disabled" : ""}>上一页</button><span>${dPage} / ${dPages}</span><button type="button" class="btn sm" data-dnext ${dPage >= dPages ? "disabled" : ""}>下一页</button>`;
            detail.querySelector("[data-dprev]")?.addEventListener("click", () => { if (dPage > 1) { dPage--; refreshDetailVisitors(); } });
            detail.querySelector("[data-dnext]")?.addEventListener("click", () => { if (dPage < dPages) { dPage++; refreshDetailVisitors(); } });
          };
          detail.querySelector("[data-dprev]")?.addEventListener("click", () => { if (dPage > 1) { dPage--; refreshDetailVisitors(); } });
          detail.querySelector("[data-dnext]")?.addEventListener("click", () => { if (dPage < dPages) { dPage++; refreshDetailVisitors(); } });
        } catch (e) { detail.innerHTML = `<p>加载失败：${esc(e.message)}</p>`; }
      });
    });
    // 子标签和天数切换按钮需要重新绑定（innerHTML 重写后旧事件丢失）
    panel.querySelectorAll("[data-asub]").forEach(b => b.addEventListener("click", () => { analyticsSub = b.dataset.asub; renderAdminAnalytics(panel); }));
    panel.querySelectorAll("[data-andays]").forEach(b => b.addEventListener("click", () => { analyticsDays = Number(b.dataset.andays); analyticsStart = ""; analyticsEnd = ""; renderAdminAnalytics(panel); }));
    // 文章统计导出 CSV
    panel.querySelector("[data-export=\"posts\"]")?.addEventListener("click", () => {
      const rows = posts.map(p => [p.title || p.path, p.path, p.pv, p.uv, p.avg_dur ? fmtDur(p.avg_dur) : "", p.last_visit ? p.last_visit.replace("T", " ").slice(0, 16) : ""]);
      exportCSV(`访问统计-文章统计-${rangeLabel}.csv`, ["标题", "路径", "PV", "UV", "平均停留", "最后访问"], rows);
    });
  }

  // 后台列表分页状态（跨重渲染保留）
  let adminMomPage = 1;
  const adminMomCursors = [null]; // adminMomCursors[page-1] = 该页起始游标
  let adminPostsPage = 1;
  let adminPhotosPage = 1;
  let adminPhotosFilter = "all"; // all | visible | hidden

  /** 后台列表多选 + 批量删除通用接线：rowSel 为行/卡片选择器，onDone 为删除成功后的重绘回调 */
  function wireBatch(panel, { rowSel, endpoint, label, onDone }) {
    const all = panel.querySelector("[data-batch-all]");
    const countEl = panel.querySelector("[data-batch-count]");
    const delBtn = panel.querySelector("[data-batch-del]");
    if (!all || !delBtn) return;
    const boxes = () => [...panel.querySelectorAll(`${rowSel} input.admin-check`)];
    const sync = () => {
      const bs = boxes();
      const checked = bs.filter(b => b.checked);
      if (countEl) countEl.textContent = checked.length;
      delBtn.disabled = checked.length === 0;
      all.checked = bs.length > 0 && checked.length === bs.length;
      all.indeterminate = checked.length > 0 && checked.length < bs.length;
    };
    all.addEventListener("change", () => {
      boxes().forEach(b => { b.checked = all.checked; });
      sync();
    });
    boxes().forEach(b => b.addEventListener("change", sync));
    delBtn.addEventListener("click", async () => {
      const ids = boxes().filter(b => b.checked).map(b => Number(b.value));
      if (!ids.length) return;
      if (!confirm(`确定删除选中的 ${ids.length} ${label}？此操作不可恢复`)) return;
      delBtn.disabled = true;
      const oldText = delBtn.textContent;
      delBtn.textContent = "删除中...";
      try {
        await api(endpoint, { method: "POST", body: { ids } });
        toast(`已删除 ${ids.length} ${label}`);
        onDone && onDone();
      } catch (err) {
        toast(err.message);
        delBtn.disabled = false;
        delBtn.textContent = oldText;
      }
    });
    sync();
  }

  async function renderAdminMoments(panel, page = adminMomPage) {
    adminMomPage = page;
    panel.innerHTML = `<div class="essay-loading"><span class="spinner"></span><span>加载中...</span></div>`;
    let list = [];
    let nextCursor = null;
    try {
      const cursor = adminMomCursors[page - 1];
      const data = await api(
        `/api/moments?limit=20&voter_id=${encodeURIComponent(state.voterId)}${cursor ? `&cursor=${cursor}` : ""}`
      );
      list = data.list;
      nextCursor = data.nextCursor ?? null;
    } catch (e) {
      panel.innerHTML = `<div class="essay-empty">${esc(e.message)}</div>`;
      return;
    }
    if (nextCursor != null && adminMomCursors[page] === undefined) adminMomCursors[page] = nextCursor;
    const hasMore = nextCursor != null;
    panel.innerHTML = `
      <div class="admin-panel-head">
        <h3>说说管理</h3>
        <button class="btn primary" data-admin-act="new-moment">＋ 发布说说</button>
      </div>
      <div class="admin-batch-bar">
        <label class="admin-batch-all"><input type="checkbox" data-batch-all /> 全选</label>
        <span class="admin-batch-info">已选 <strong data-batch-count>0</strong> 项</span>
        <button class="btn danger" data-batch-del disabled>批量删除</button>
      </div>
      ${
        list.length
          ? list
              .map(
                m => `
        <div class="admin-row">
          <label class="admin-check-cell"><input type="checkbox" class="admin-check" value="${m.id}" /></label>
          <div class="row-main">
            <div class="row-title">${esc(plainText(m.content, 80) || ((Array.isArray(m.videos) ? m.videos.length : m.video ? 1 : 0) ? "[视频说说]" : "[图片说说]"))}</div>
            <div class="row-sub">
              <span>${timeAgo(m.created_at)}</span>
              ${m.images && m.images.length ? `<span class="tag-mini">图片×${m.images.length}</span>` : ""}
              ${(Array.isArray(m.videos) ? m.videos.length : m.video ? 1 : 0) ? `<span class="tag-mini">视频×${Array.isArray(m.videos) ? m.videos.length : 1}</span>` : ""}
              ${m.location ? `<span>${svgIcon("locationDot", 14)} ${esc(m.location)}</span>` : ""}
              <span>赞 ${m.like_count || 0}</span><span>评论 ${m.comment_count || 0}</span>
            </div>
          </div>
          <div class="row-actions">
            <button class="btn" data-admin-act="view-moment" data-id="${m.id}">查看</button>
            <button class="btn" data-admin-act="edit-moment" data-id="${m.id}">编辑</button>
            <button class="btn danger" data-admin-act="del-moment" data-id="${m.id}">删除</button>
          </div>
        </div>`
              )
              .join("")
          : `<div class="essay-empty">还没有说说，点右上角发布第一条</div>`
      }
      <div class="pager">
        <button type="button" class="btn" data-pager="prev"${page <= 1 ? " disabled" : ""}>上一页</button>
        <span class="pager-info">第 ${page} 页</span>
        <button type="button" class="btn" data-pager="next"${hasMore ? "" : " disabled"}>下一页</button>
      </div>`;
    panel.querySelectorAll("[data-pager]").forEach(b =>
      b.addEventListener("click", () => renderAdminMoments(panel, b.dataset.pager === "prev" ? page - 1 : page + 1))
    );
    wireBatch(panel, { rowSel: ".admin-row", endpoint: "/api/moments/batch-delete", label: "条说说", onDone: () => renderAdminMoments(panel) });
  }

  async function renderAdminPosts(panel, page = adminPostsPage) {
    adminPostsPage = page;
    panel.innerHTML = `<div class="essay-loading"><span class="spinner"></span><span>加载中...</span></div>`;
    let list = [];
    let total = 0;
    let pvMap = {};
    try {
      const [data, stats] = await Promise.all([
        api(`/api/posts?page=${page}&per_page=20&admin=1`),
        api(`/api/admin/analytics/posts?days=90`).catch(() => ({ posts: [] })),
      ]);
      list = data.list;
      total = data.total ?? list.length;
      for (const p of stats.posts || []) pvMap[p.path] = p;
    } catch (e) {
      panel.innerHTML = `<div class="essay-empty">${esc(e.message)}</div>`;
      return;
    }
    const pages = Math.max(1, Math.ceil(total / 20));
    if (!list.length && page > 1) return renderAdminPosts(panel, pages); // 原页被删空时自动回退
    panel.innerHTML = `
      <div class="admin-panel-head">
        <h3>文章管理（${total}）</h3>
        <button class="btn primary" data-admin-act="new-post">＋ 写文章</button>
      </div>
      <div class="admin-batch-bar">
        <label class="admin-batch-all"><input type="checkbox" data-batch-all /> 全选</label>
        <span class="admin-batch-info">已选 <strong data-batch-count>0</strong> 项</span>
        <button class="btn danger" data-batch-del disabled>批量删除</button>
      </div>
      ${
        list.length
          ? list
              .map(
                p => `
        <div class="admin-row${p.pinned ? " is-pinned" : ""}">
          <label class="admin-check-cell"><input type="checkbox" class="admin-check" value="${p.id}" /></label>
          <div class="row-main">
            <div class="row-title">${esc(p.title)}${p.pinned ? '<span class="tag-mini pinned" style="margin-left:6px">置顶</span>' : ""}${p.status === "draft" ? '<span class="tag-mini draft" style="margin-left:6px">草稿</span>' : ""}</div>
            <div class="row-sub"><span>${timeAgo(p.created_at)}</span><span>/${esc(p.slug)}</span>${pvMap["/post/" + encodeURIComponent(p.slug)] ? `<span class="post-pv-num" data-pv-jump="${esc(p.slug)}" style="cursor:pointer">${pvMap["/post/" + encodeURIComponent(p.slug)].pv} 次浏览</span>` : ""}</div>
          </div>
          <div class="row-actions">
            <a class="btn" href="/post/${encodeURIComponent(p.slug)}${p.status === "draft" ? "?preview=1" : ""}">查看</a>
            ${p.status === "draft" ? `<button class="btn primary" data-admin-act="publish-post" data-id="${p.id}">发布</button>` : ""}
            <button class="btn${p.pinned ? " primary" : ""}" data-admin-act="pin-post" data-id="${p.id}" data-pinned="${p.pinned ? 1 : 0}">${p.pinned ? "取消置顶" : "置顶"}</button>
            <button class="btn" data-admin-act="edit-post" data-slug="${esc(p.slug)}">编辑</button>
            <button class="btn danger" data-admin-act="del-post" data-id="${p.id}">删除</button>
          </div>
        </div>`
              )
              .join("")
          : `<div class="essay-empty">还没有文章</div>`
      }
      ${pagerHtml(page, pages)}`;
    panel.querySelectorAll("[data-pager]").forEach(b =>
      b.addEventListener("click", () => renderAdminPosts(panel, b.dataset.pager === "prev" ? page - 1 : page + 1))
    );
    panel.querySelectorAll("[data-pv-jump]").forEach(el =>
      el.addEventListener("click", () => {
        const slug = el.dataset.pvJump;
        analyticsSub = "posts";
        state.adminTab = "analytics";
        renderAdmin();
        // 等统计面板渲染完后自动展开对应文章
        setTimeout(() => {
          const row = document.querySelector(`[data-apost="/post/${encodeURIComponent(slug)}"]`);
          if (row) row.querySelector(".an-post-toggle")?.click();
        }, 800);
      })
    );
    wireBatch(panel, { rowSel: ".admin-row", endpoint: "/api/posts/batch-delete", label: "篇文章", onDone: () => renderAdminPosts(panel) });
  }

  async function renderAdminPhotos(panel, page = adminPhotosPage) {
    adminPhotosPage = page;
    panel.innerHTML = `<div class="essay-loading"><span class="spinner"></span><span>加载中...</span></div>`;
    let list = [];
    let total = 0;
    try {
      const vParam = adminPhotosFilter === "visible" ? "&visible=1" : adminPhotosFilter === "hidden" ? "&visible=0" : "";
      const data = await api(`/api/admin/photos?page=${page}&per_page=24${vParam}`);
      list = data.list;
      total = data.total ?? list.length;
    } catch (e) {
      panel.innerHTML = `<div class="essay-empty">${esc(e.message)}</div>`;
      return;
    }
    const pages = Math.max(1, Math.ceil(total / 24));
    if (!list.length && page > 1) return renderAdminPhotos(panel, pages); // 原页被删空时自动回退
    const sourceLabel = t => (t === "moment" ? "说说" : t === "post" ? "文章" : "上传");
    panel.innerHTML = `
      <div class="admin-panel-head">
        <h3>相册管理（${total}）</h3>
        <div style="display:flex;gap:.5rem">
          <button class="btn" data-photo-act="sync">同步说说/文章图片</button>
          <button class="btn primary" data-photo-act="upload">上传图片</button>
        </div>
      </div>
      <div class="field-hint" style="margin-bottom:1rem">上传或同步的图片会出现在前台「相册」页；可设置标题、排序（升序）和是否显示。勾选图片可批量删除。</div>
      <div class="admin-batch-bar">
        <label class="admin-batch-all"><input type="checkbox" data-batch-all /> 全选</label>
        <span class="admin-batch-info">已选 <strong data-batch-count>0</strong> 项</span>
        <button class="btn" data-batch-show disabled>批量显示</button>
        <button class="btn" data-batch-hide disabled>批量隐藏</button>
        <button class="btn danger" data-batch-del disabled>批量删除</button>
      </div>
      <div style="display:flex;gap:.5rem;margin-bottom:.75rem;align-items:center;flex-wrap:wrap">
        <span class="ops-hint" style="font-size:.82rem;color:var(--anzhiyu-secondtext)">筛选：</span>
        <button class="btn sm ${adminPhotosFilter === "all" ? "primary" : ""}" data-photo-filter="all">全部</button>
        <button class="btn sm ${adminPhotosFilter === "visible" ? "primary" : ""}" data-photo-filter="visible">已显示</button>
        <button class="btn sm ${adminPhotosFilter === "hidden" ? "primary" : ""}" data-photo-filter="hidden">已隐藏</button>
      </div>
      <input type="file" accept="image/*" data-photo-file hidden multiple />
      ${
        list.length
          ? `<div class="photo-admin-grid">${list
              .map(
                p => `
            <div class="photo-admin-card" data-id="${p.id}">
              <div class="photo-admin-thumb">
                <input type="checkbox" class="admin-check photo-admin-check" value="${p.id}" title="选中用于批量操作" />
                <a href="${esc(fullSrc(p.src))}" data-lightbox="${esc(fullSrc(p.src))}" data-fancybox="admin-photos" style="display:block;width:100%;height:100%">
                  <img src="${esc(thumbSrc(p.src))}" alt="" referrerpolicy="no-referrer" loading="lazy" data-orig="${esc(fullSrc(p.src))}" />
                </a>
                <span class="photo-admin-src-tag">${sourceLabel(p.source_type)}</span>
              </div>
              <div class="photo-admin-fields">
                <input type="text" class="photo-title-input" placeholder="标题（可选）" value="${esc(p.title)}" />
                <div class="photo-admin-row">
                  <label class="photo-check">
                    <input type="checkbox" class="photo-visible-input" ${p.visible ? "checked" : ""} />
                    <span>显示</span>
                  </label>
                  <input type="number" class="photo-sort-input" value="${p.sort_order}" style="width:70px" title="排序（小的在前，同值按上传时间倒序）" />
                  <button class="btn photo-save-btn" data-photo-act="save">保存</button>
                  <button class="btn danger" data-photo-act="del">删除</button>
                </div>
              </div>
            </div>`
              )
              .join("")}</div>`
          : `<div class="essay-empty">还没有图片，点击「上传图片」或「同步说说/文章图片」</div>`
      }
      ${pagerHtml(page, pages)}`;

    panel.querySelectorAll("[data-pager]").forEach(b =>
      b.addEventListener("click", () => renderAdminPhotos(panel, b.dataset.pager === "prev" ? page - 1 : page + 1))
    );
    // 筛选按钮
    panel.querySelectorAll("[data-photo-filter]").forEach(btn =>
      btn.addEventListener("click", () => {
        adminPhotosFilter = btn.dataset.photoFilter;
        adminPhotosPage = 1;
        renderAdminPhotos(panel, 1);
      })
    );
    wireBatch(panel, { rowSel: ".photo-admin-card", endpoint: "/api/admin/photos/batch-delete", label: "张图片", onDone: () => renderAdminPhotos(panel) });
    // 批量显示/隐藏
    const batchToggle = async (visible) => {
      const ids = [...panel.querySelectorAll(".photo-admin-card input.admin-check:checked")].map(b => Number(b.value));
      if (!ids.length) return;
      try {
        await api("/api/admin/photos/batch-toggle", { method: "POST", body: { ids, visible } });
        toast(`已${visible ? "显示" : "隐藏"} ${ids.length} 张图片`);
        renderAdminPhotos(panel);
      } catch (err) { toast(err.message); }
    };
    const showBtn = panel.querySelector("[data-batch-show]");
    const hideBtn = panel.querySelector("[data-batch-hide]");
    if (showBtn) showBtn.addEventListener("click", () => batchToggle(1));
    if (hideBtn) hideBtn.addEventListener("click", () => batchToggle(0));
    // 同步批量按钮的 disabled 状态（与 wireBatch 的 delBtn 联动）
    const syncBatchBtns = () => {
      const checked = panel.querySelectorAll(".photo-admin-card input.admin-check:checked").length;
      if (showBtn) showBtn.disabled = checked === 0;
      if (hideBtn) hideBtn.disabled = checked === 0;
    };
    panel.querySelectorAll(".photo-admin-card input.admin-check").forEach(b => b.addEventListener("change", syncBatchBtns));
    const batchAll = panel.querySelector("[data-batch-all]");
    if (batchAll) batchAll.addEventListener("change", () => setTimeout(syncBatchBtns, 0));
    panel.querySelector('[data-photo-act="sync"]').addEventListener("click", async e => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = "同步中...";
      try {
        const r = await api("/api/admin/photos/sync", { method: "POST" });
        toast(`同步完成，新增 ${r.inserted} 张`);
        renderAdminPhotos(panel);
      } catch (err) {
        toast(err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = "同步说说/文章图片";
      }
    });

    // 上传
    const fileInput = panel.querySelector("[data-photo-file]");
    panel.querySelector('[data-photo-act="upload"]').addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
      const files = [...fileInput.files];
      if (!files.length) return;
      for (const file of files) {
        try {
          // 走 uploadMedia：图片自动生成 _w1200.jpg 缩略图（与说说/文章一致），否则相册页 thumbSrc 404
          const data = await uploadMedia(file, "image");
          if (!data?.key) throw new Error("上传失败");
          // 存储 canonical /media/<key>，由后端 serializePhoto 根据 r2_domain 动态转换为 R2 直连或代理
          await api("/api/admin/photos", { method: "POST", body: { src: data.key, title: file.name.replace(/\.[^.]+$/, "") } });
        } catch (err) {
          toast(`${file.name}: ${err.message}`);
        }
      }
      toast("上传完成");
      fileInput.value = "";
      renderAdminPhotos(panel);
    });

    // 单张保存 / 删除
    panel.querySelectorAll(".photo-admin-card").forEach(card => {
      const id = Number(card.dataset.id);
      card.querySelector('[data-photo-act="save"]').addEventListener("click", async () => {
        const title = card.querySelector(".photo-title-input").value;
        const sort_order = Number(card.querySelector(".photo-sort-input").value) || 0;
        const visible = card.querySelector(".photo-visible-input").checked;
        try {
          await api(`/api/admin/photos/${id}`, { method: "PUT", body: { title, sort_order, visible } });
          toast("已保存");
        } catch (err) {
          toast(err.message);
        }
      });
      card.querySelector('[data-photo-act="del"]').addEventListener("click", async () => {
        if (!confirm("删除这张图片？")) return;
        try {
          await api(`/api/admin/photos/${id}`, { method: "DELETE" });
          card.remove();
          toast("已删除");
        } catch (err) {
          toast(err.message);
        }
      });
    });
  }

  /* ================= 后台：关于我页面 ================= */
  function renderAdminAbout(panel) {
    const s = state.settings;
    panel.innerHTML = `
      <h3>关于我页面</h3>
      <form class="settings-form" data-settings-form>
        <div class="field">
          <label for="about_enabled">启用「关于我」页面<br /><small style="color:var(--anzhiyu-secondtext)">开启后顶栏显示「关于」入口，访问 /about 可查看</small></label>
          <label class="switch-row">
            <span class="toggle"><input type="checkbox" name="about_enabled" id="about_enabled" ${s.about_enabled ? "checked" : ""} /><span></span></span>
            <span>启用关于我页面（/about）</span>
          </label>
        </div>
        <div class="field">
          <label>顶部问候大标题</label>
          <input name="about_greeting" maxlength="60" value="${esc(s.about_greeting)}" />
        </div>
        <div class="field">
          <label>问候标题下方小字</label>
          <input name="about_greeting_sub" maxlength="200" value="${esc(s.about_greeting_sub)}" />
        </div>
        <div class="field">
          <label>关于页大头像（可选）<br /><small style="color:var(--anzhiyu-secondtext)">图片 URL 或上传；留空则用说说作者头像</small></label>
          <div style="display:flex;gap:.5rem;align-items:center">
            <input name="about_avatar" maxlength="300" value="${esc(s.about_avatar)}" placeholder="https://...（留空=作者头像）" style="flex:1" />
            <button type="button" class="btn" data-avatar-upload="about_avatar">上传</button>
            <input type="file" accept="image/*" data-avatar-file="about_avatar" hidden />
          </div>
          <div class="field-hint" data-avatar-preview="about_avatar" style="margin-top:.4rem">${/^https?:\/\//i.test(s.about_avatar || "") ? `<img src="${esc(s.about_avatar)}" alt="" style="width:48px;height:48px;border-radius:50%;object-fit:cover" referrerpolicy="no-referrer" />` : ""}</div>
        </div>
        <div class="field">
          <label>一句话签名</label>
          <input name="about_signature" maxlength="200" value="${esc(s.about_signature)}" />
        </div>
        <div class="field">
          <label>自我介绍正文（Markdown）</label>
          <textarea name="about_bio" maxlength="5000" rows="6" placeholder="支持 Markdown 语法…">${esc(s.about_bio)}</textarea>
        </div>
        <div class="field">
          <label>「一些数字」小卡片（每行一条：名称|数值|说明）</label>
          <textarea name="about_stats" maxlength="1000" rows="4" placeholder="坚持记录|多年|从开始写到现在&#10;记录天数|持续|几乎每天都在更新">${esc(s.about_stats)}</textarea>
        </div>
        <div class="field">
          <label>时间线（每行一条：日期|标题|描述）</label>
          <textarea name="about_timeline" maxlength="2000" rows="4" placeholder="2021|开始写博客|用文字记录生活的第一个节点">${esc(s.about_timeline)}</textarea>
        </div>
        <div class="field">
          <label>底部大数字统计（每行一条：数字|标签）</label>
          <textarea name="about_bigstats" maxlength="500" rows="3" placeholder="6|年记录&#10;120+|篇文字">${esc(s.about_bigstats)}</textarea>
        </div>
        <div class="field">
          <label>联系方式（每行一条：类型|值|链接）<br /><small style="color:var(--anzhiyu-secondtext)">链接可空；类型自动匹配图标（GitHub/邮箱/RSS/QQ 等）</small></label>
          <textarea name="about_contacts" maxlength="1000" rows="4" placeholder="GitHub|孤鸿剑尊|https://github.com/xxx&#10;邮箱|a@b.com|mailto:a@b.com">${esc(s.about_contacts)}</textarea>
        </div>
        <div class="field">
          <label>赞助卡说明文字</label>
          <input name="about_qr_text" maxlength="300" value="${esc(s.about_qr_text)}" />
        </div>
        <div class="field">
          <label>赞助金额按钮组（点击切换二维码）<br /><small style="color:var(--anzhiyu-secondtext)">每行一条：金额|该金额的二维码图片URL。URL 可留空（留空则该按钮只高亮不切图）</small></label>
          <textarea name="about_qr_amounts" maxlength="1000" rows="4" placeholder="10元|https://.../10.png&#10;30元|https://.../30.png&#10;60元|https://.../60.png">${esc(s.about_qr_amounts)}</textarea>
        </div>

        <div class="admin-panel-head" style="margin-top:1.75rem"><h3>文章打赏</h3></div>
        <div class="field">
          <label class="switch-row">
            <span class="toggle"><input type="checkbox" name="reward_enabled" ${s.reward_enabled ? "checked" : ""} /><span></span></span>
            <span>在文章底部展示打赏卡片</span>
          </label>
        </div>
        <div class="field">
          <label>打赏二维码图片 URL<br /><small style="color:var(--anzhiyu-secondtext)">微信/支付宝收款码图片地址，可上传到「媒体」后复制链接</small></label>
          <input name="reward_qrcode" maxlength="500" value="${esc(s.reward_qrcode)}" placeholder="https://.../qrcode.png" />
        </div>
        <div class="field">
          <label>打赏引导文案</label>
          <input name="reward_text" maxlength="300" value="${esc(s.reward_text)}" />
        </div>

        
        <button class="btn primary" type="submit">保存设置</button>
      </form>`;

    // 关于页头像上传 + 预览
    const avBtn = panel.querySelector('[data-avatar-upload="about_avatar"]');
    if (avBtn) {
      const fileInp = panel.querySelector('[data-avatar-file="about_avatar"]');
      const urlInp = panel.querySelector('[name="about_avatar"]');
      const preview = panel.querySelector('[data-avatar-preview="about_avatar"]');
      avBtn.addEventListener("click", () => fileInp.click());
      fileInp.addEventListener("change", async () => {
        const file = fileInp.files[0];
        if (!file) return;
        avBtn.disabled = true;
        avBtn.textContent = "上传中...";
        try {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("kind", "image");
          const res = await fetch("/api/admin/upload", { method: "POST", body: fd, credentials: "same-origin" });
          const json = await res.json();
          if (!res.ok || !json.data?.src) throw new Error(json.message || "上传失败");
          const full = /^https?:\/\//i.test(json.data.src) ? json.data.src : location.origin + json.data.src;
          urlInp.value = full;
          preview.innerHTML = `<img src="${esc(full)}" alt="" style="width:48px;height:48px;border-radius:50%;object-fit:cover" referrerpolicy="no-referrer" />`;
          toast("上传成功，记得点击保存设置");
        } catch (err) {
          toast(err.message);
        } finally {
          avBtn.disabled = false;
          avBtn.textContent = "上传";
          fileInp.value = "";
        }
      });
    }
  }

  /* ================= 后台：友链管理 ================= */
  async function renderAdminFriends(panel) {
    panel.innerHTML = `<h3>友链管理</h3><div class="field-hint">加载中…</div>`;
    let data;
    try {
      data = await api("/api/admin/friends");
    } catch (e) {
      panel.innerHTML = `<h3>友链管理</h3><div class="field-hint">${esc(e.message)}</div>`;
      return;
    }
    const list = data.list || [];
    const cats = String(state.settings.links_categories || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const catOpts = cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
    const statusText = { pending: "待审核", approved: "已上架", rejected: "已拒绝" };
    const feedTagText = { blog: "博客", community: "社区", tech: "技术" };

    const rows = list.map(f => `
      <div class="friend-admin-row" data-id="${f.id}">
        <div class="friend-admin-main">
          ${friendAvatar(f.name, f.avatar)}
          <div class="friend-admin-info">
            <div class="friend-admin-name">
              ${esc(f.name)}
              ${f.category ? `<span class="links-card-cat">${esc(f.category)}</span>` : ""}
              <span class="friend-admin-status s-${f.status}">${statusText[f.status] || f.status}</span>
              ${f.feed_url ? `<span class="friend-admin-status ${f.feed_enabled ? "s-approved" : "s-rejected"}">订阅${f.feed_enabled ? " · " + (feedTagText[f.feed_tag] || "博客") : "已停用"}</span>` : ""}
            </div>
            <a class="friend-admin-url" href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.url)}</a>
            <div class="friend-admin-desc">${esc(f.description || "—")}</div>
            ${f.feed_url ? `<div class="friend-admin-desc">订阅地址：${esc(f.feed_url)}</div>` : ""}
            ${f.feed_url && f.feed_status ? `<div class="friend-admin-desc">抓取状态：${esc(f.feed_status)}</div>` : ""}
            ${f.last_post_at ? `<div class="friend-admin-desc">最近更新：${timeAgo(f.last_post_at)}${f.last_post_title ? ` · <a href="${esc(f.last_post_link)}" target="_blank" rel="noopener" style="color:inherit">《${esc(f.last_post_title)}》</a>` : ""}</div>` : ""}
          </div>
        </div>
        <div class="friend-admin-actions">
          ${f.status === "pending" ? `<button class="btn sm" data-act="approve">通过</button><button class="btn sm ghost" data-act="reject">拒绝</button>` : ""}
          ${f.feed_url && f.feed_enabled ? `<button class="btn sm ghost" data-act="fetch">抓取</button>` : ""}
          <button class="btn sm ghost" data-act="edit">编辑</button>
          <button class="btn sm danger" data-act="del">删除</button>
        </div>
      </div>`).join("");

    panel.innerHTML = `
      <h3>友链管理（${list.length}）${data.pending_count ? ` <span class="friend-pending-badge">${data.pending_count} 条待审核</span>` : ""}</h3>
      <div class="field-hint" style="margin-bottom:1rem">访客在 /links/apply 提交的申请会进入「待审核」，通过后自动上架到 /links。也可在此直接新增友站。</div>

      <form class="settings-form" data-settings-form style="border:1px solid var(--anzhiyu-card-border,#e3e8ef);border-radius:10px;padding:.9rem 1rem;background:var(--anzhiyu-card-bg,#fafbfc);margin-bottom:1rem">
        <div class="field">
          <label>友圈功能<br /><small style="color:var(--anzhiyu-secondtext)">关闭后顶栏「友圈」入口隐藏，/friends 页面与公开文章接口返回 404；下方订阅配置保留，重新开启即恢复</small></label>
          <label class="switch-row">
            <span class="toggle"><input type="checkbox" name="friends_enabled" ${state.settings.friends_enabled !== false ? "checked" : ""} /><span></span></span>
            <span>启用友圈</span>
          </label>
        </div>
        <div class="field">
          <label>友圈抓取<br /><small style="color:var(--anzhiyu-secondtext)">每小时抓一轮，每轮最多 10 个源，每源保留最新 12 篇</small></label>
          <label class="switch-row">
            <span class="toggle"><input type="checkbox" name="friends_fetch_enabled" ${state.settings.friends_fetch_enabled ? "checked" : ""} /><span></span></span>
            <span>启用定时抓取</span>
          </label>
        </div>
        <div class="field">
          <label>来源配额（%）<br /><small style="color:var(--anzhiyu-secondtext)">友圈按配额交错展示，池内跨源轮转防霸榜；某池文章不足时余量自动让给其他池</small></label>
          <div style="display:flex;gap:.75rem;flex-wrap:wrap">
            <label style="display:flex;align-items:center;gap:.35rem;font-weight:normal">博客 <input name="friends_quota_blog" type="number" min="0" max="100" value="${esc(state.settings.friends_quota_blog)}" style="width:4.5rem" /></label>
            <label style="display:flex;align-items:center;gap:.35rem;font-weight:normal">社区 <input name="friends_quota_community" type="number" min="0" max="100" value="${esc(state.settings.friends_quota_community)}" style="width:4.5rem" /></label>
            <label style="display:flex;align-items:center;gap:.35rem;font-weight:normal">技术 <input name="friends_quota_tech" type="number" min="0" max="100" value="${esc(state.settings.friends_quota_tech)}" style="width:4.5rem" /></label>
          </div>
        </div>
        <button class="btn primary" type="submit">保存友圈设置</button>
      </form>

      <form class="settings-form" data-settings-form style="border:1px solid var(--anzhiyu-card-border,#e3e8ef);border-radius:10px;padding:.9rem 1rem;background:var(--anzhiyu-card-bg,#fafbfc);margin-bottom:1rem">
        <div class="field">
          <label>友链分类（每行一个）<br /><small style="color:var(--anzhiyu-secondtext)">列表页会自动加「全部」；此处可增删改，新增/编辑友站时分类下拉同步更新</small></label>
          <textarea name="links_categories" maxlength="500" rows="4" placeholder="技术&#10;设计&#10;生活随笔&#10;摄影">${esc(state.settings.links_categories)}</textarea>
        </div>
        <button class="btn primary" type="submit">保存分类</button>
      </form>

      <details class="friend-add-box" ${list.length === 0 ? "open" : ""}>
        <summary><b>＋ 新增友站</b></summary>
        <form id="friendAddForm" class="friend-form">
          <div class="friend-form-grid">
            <div class="field"><label>站点名称 *</label><input name="name" maxlength="60" required /></div>
            <div class="field">
              <label>站点地址 *</label>
              <div style="display:flex;gap:.5rem">
                <input name="url" placeholder="https://example.com" required style="flex:1" />
                <button type="button" class="btn" id="friendFetchBtn">自动获取</button>
              </div>
            </div>
            <div class="field"><label>站点简介</label><input name="description" maxlength="300" /></div>
            <div class="field"><label>图标 URL（可选）</label><input name="avatar" maxlength="500" placeholder="留空自动取对方 favicon" /></div>
            <div class="field"><label>分类</label><select name="category"><option value="">未分类</option>${catOpts}</select></div>
            <div class="field"><label>排序（升序）</label><input name="sort_order" type="number" value="0" /></div>
            <div class="field">
              <label>订阅地址（RSS/Atom，可选）</label>
              <div style="display:flex;gap:.5rem">
                <input name="feed_url" placeholder="留空则仅展示友链" style="flex:1" />
                <button type="button" class="btn" id="feedDetectBtn">探测</button>
              </div>
            </div>
            <div class="field"><label>友圈分类</label><select name="feed_tag"><option value="blog">博客</option><option value="community">社区</option><option value="tech">技术</option></select></div>
            <div class="field"><label class="switch-row"><span class="toggle"><input type="checkbox" name="feed_enabled" checked /><span></span></span><span>纳入友圈抓取</span></label></div>
          </div>
          <button class="btn primary" type="submit">添加</button>
        </form>
      </details>

      <div class="friend-admin-list">${rows || '<div class="field-hint">暂无友站</div>'}</div>
    `;

    // 新增
    const addForm = panel.querySelector("#friendAddForm");
    const fetchBtn = panel.querySelector("#friendFetchBtn");
    if (fetchBtn) {
      fetchBtn.addEventListener("click", async () => {
        const url = addForm.querySelector('[name="url"]').value.trim();
        if (!url) { toast("请先填写站点地址"); return; }
        fetchBtn.disabled = true; fetchBtn.textContent = "获取中…";
        try {
          const info = await api(`/api/friends/info?url=${encodeURIComponent(url)}`);
          if (info.name) addForm.querySelector('[name="name"]').value = info.name;
          if (info.description) addForm.querySelector('[name="description"]').value = info.description;
          if (!addForm.querySelector('[name="avatar"]').value && info.avatar) addForm.querySelector('[name="avatar"]').value = info.avatar;
          if (info.url) addForm.querySelector('[name="url"]').value = info.url;
          toast("已自动获取，可再微调");
        } catch (err) { toast(err.message || "获取失败，请手动填写"); }
        finally { fetchBtn.disabled = false; fetchBtn.textContent = "自动获取"; }
      });
    }
    // 探测订阅地址
    const detectBtn = panel.querySelector("#feedDetectBtn");
    if (detectBtn) {
      detectBtn.addEventListener("click", async () => {
        const url = addForm.querySelector('[name="url"]').value.trim();
        if (!url) { toast("请先填写站点地址"); return; }
        detectBtn.disabled = true; detectBtn.textContent = "探测中…";
        try {
          const r = await api(`/api/admin/friends/detect-feed?url=${encodeURIComponent(url)}`);
          addForm.querySelector('[name="feed_url"]').value = r.feed_url;
          toast("已发现订阅地址");
        } catch (err) { toast(err.message || "未发现订阅地址"); }
        finally { detectBtn.disabled = false; detectBtn.textContent = "探测"; }
      });
    }
    if (addForm) {
      addForm.addEventListener("submit", async e => {
        e.preventDefault();
        const fd = new FormData(addForm);
        const payload = Object.fromEntries(fd);
        payload.feed_enabled = addForm.querySelector('[name="feed_enabled"]').checked ? "1" : "0";
        const btn = addForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        try {
          await api("/api/admin/friends", { method: "POST", body: payload });
          toast("已添加");
          renderAdminFriends(panel);
        } catch (err) { toast(err.message); }
        finally { btn.disabled = false; }
      });
    }

    // 列表操作
    panel.querySelectorAll(".friend-admin-row").forEach(row => {
      const id = row.dataset.id;
      const act = (sel) => row.querySelector(`[data-act="${sel}"]`);
      const a = act("approve"); if (a) a.addEventListener("click", async () => { await api(`/api/admin/friends/${id}/approve`, { method: "POST" }); toast("已通过"); renderAdminFriends(panel); });
      const rj = act("reject"); if (rj) rj.addEventListener("click", async () => { await api(`/api/admin/friends/${id}/reject`, { method: "POST" }); toast("已拒绝"); renderAdminFriends(panel); });
      const dl = act("del"); if (dl) dl.addEventListener("click", async () => { if (!confirm("确定删除该友站？")) return; await api(`/api/admin/friends/${id}`, { method: "DELETE" }); toast("已删除"); renderAdminFriends(panel); });
      const ft = act("fetch");
      if (ft) ft.addEventListener("click", async () => {
        ft.disabled = true; ft.textContent = "抓取中…";
        try {
          const r = await api(`/api/admin/friends/${id}/fetch`, { method: "POST" });
          toast(r.status === "ok" ? "抓取完成" : r.status);
        } catch (err) { toast(err.message); }
        finally { renderAdminFriends(panel); }
      });
      const ed = act("edit"); if (ed) ed.addEventListener("click", () => openFriendEditor(panel, id, list.find(x => String(x.id) === id), cats));
    });
  }

  /** 编辑友站：内联替换该行内容为表单 */
  function openFriendEditor(panel, id, f, cats) {
    if (!f) return;
    const row = panel.querySelector(`.friend-admin-row[data-id="${id}"]`);
    if (!row) return;
    const catOpts = ['<option value="">未分类</option>', ...cats.map(c => `<option value="${esc(c)}"${c === f.category ? " selected" : ""}>${esc(c)}</option>`)].join("");
    const feedTagOpts = [["blog", "博客"], ["community", "社区"], ["tech", "技术"]]
      .map(([v, n]) => `<option value="${v}"${f.feed_tag === v ? " selected" : ""}>${n}</option>`).join("");
    row.innerHTML = `
      <form class="friend-form friend-edit-form" style="width:100%">
        <div class="friend-form-grid">
          <div class="field"><label>名称</label><input name="name" maxlength="60" value="${esc(f.name)}" required /></div>
          <div class="field"><label>地址</label><input name="url" value="${esc(f.url)}" required /></div>
          <div class="field"><label>简介</label><input name="description" maxlength="300" value="${esc(f.description)}" /></div>
          <div class="field"><label>图标 URL</label><input name="avatar" maxlength="500" value="${esc(f.avatar)}" /></div>
          <div class="field"><label>分类</label><select name="category">${catOpts}</select></div>
          <div class="field"><label>排序</label><input name="sort_order" type="number" value="${f.sort_order ?? 0}" /></div>
          <div class="field">
            <label>订阅地址（RSS/Atom）</label>
            <div style="display:flex;gap:.5rem">
              <input name="feed_url" value="${esc(f.feed_url || "")}" placeholder="留空则仅展示友链" style="flex:1" />
              <button type="button" class="btn" data-act="detect">探测</button>
            </div>
          </div>
          <div class="field"><label>友圈分类</label><select name="feed_tag">${feedTagOpts}</select></div>
          <div class="field"><label class="switch-row"><span class="toggle"><input type="checkbox" name="feed_enabled" ${f.feed_enabled ? "checked" : ""} /><span></span></span><span>纳入友圈抓取</span></label></div>
        </div>
        <div style="display:flex;gap:.5rem">
          <button class="btn primary sm" type="submit">保存</button>
          <button class="btn ghost sm" type="button" data-act="cancel">取消</button>
        </div>
      </form>`;
    const form = row.querySelector(".friend-edit-form");
    row.querySelector('[data-act="cancel"]').addEventListener("click", () => renderAdminFriends(panel));
    row.querySelector('[data-act="detect"]').addEventListener("click", async e => {
      const url = form.querySelector('[name="url"]').value.trim();
      if (!url) { toast("请先填写站点地址"); return; }
      const btn = e.currentTarget;
      btn.disabled = true; btn.textContent = "探测中…";
      try {
        const r = await api(`/api/admin/friends/detect-feed?url=${encodeURIComponent(url)}`);
        form.querySelector('[name="feed_url"]').value = r.feed_url;
        toast("已发现订阅地址");
      } catch (err) { toast(err.message || "未发现订阅地址"); }
      finally { btn.disabled = false; btn.textContent = "探测"; }
    });
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(form);
      const payload = Object.fromEntries(fd);
      payload.feed_enabled = form.querySelector('[name="feed_enabled"]').checked ? "1" : "0";
      try {
        await api(`/api/admin/friends/${id}`, { method: "PUT", body: payload });
        toast("已保存");
        renderAdminFriends(panel);
      } catch (err) { toast(err.message); }
    });
  }

  async function renderAdminComments(panel) {
    panel.innerHTML = `<div class="essay-loading"><span class="spinner"></span><span>加载中...</span></div>`;
    let list = [];
    let s;
    try {
      [list, s] = await Promise.all([
        api("/api/admin/comments?limit=200"),
        api("/api/admin/settings"),
      ]);
    } catch (e) {
      panel.innerHTML = `<div class="essay-empty">${esc(e.message)}</div>`;
      return;
    }
    list = list.list || [];
    const escA = v => esc(String(v ?? ""));
    panel.innerHTML = `
      <div class="admin-panel-head"><h3>邮件通知设置（Resend）</h3></div>
      <form class="settings-form" data-mail-settings-form style="max-width:680px">
        <div class="field">
          <label class="switch-row">
            <span class="toggle"><input type="checkbox" name="mail_enabled" ${s.mail_enabled ? "checked" : ""} /><span></span></span>
            启用评论邮件通知
          </label>
          <small style="color:var(--anzhiyu-secondtext)">新评论时给管理员发邮件；评论者勾选订阅后，被回复时也会收到邮件。发送走 Resend，免费额度 3000 封/月。</small>
        </div>
        <div class="field">
          <label>Resend API Key（<a href="https://resend.com/api-keys" target="_blank" rel="noopener">获取</a>）</label>
          <input name="mail_resend_key" type="password" maxlength="128" value="${escA(s.mail_resend_key)}" placeholder="re_xxxxxxxx" autocomplete="new-password" data-lpignore="true" data-1p-ignore="true" style="font-family:monospace" />
        </div>
        <div style="display:flex;gap:16px;flex-wrap:wrap">
          <div class="field" style="flex:1;min-width:200px">
            <label>发件邮箱（需在 Resend 验证域名）</label>
            <input name="mail_from" maxlength="200" value="${escA(s.mail_from)}" placeholder="notify@jxe.me" />
          </div>
          <div class="field" style="flex:1;min-width:200px">
            <label>管理员收件邮箱</label>
            <input name="mail_admin_to" type="email" maxlength="200" value="${escA(s.mail_admin_to)}" placeholder="hi@jxe.me" />
          </div>
        </div>
        <div style="display:flex;gap:24px;flex-wrap:wrap">
          <label class="switch-row">
            <span class="toggle"><input type="checkbox" name="mail_notify_admin" ${s.mail_notify_admin ? "checked" : ""} /><span></span></span>
            新评论通知管理员
          </label>
          <label class="switch-row">
            <span class="toggle"><input type="checkbox" name="mail_reply_notify" ${s.mail_reply_notify ? "checked" : ""} /><span></span></span>
            允许评论者订阅回复通知
          </label>
        </div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:.6rem">
          <button class="btn primary" type="submit">保存邮件设置</button>
          <span data-mail-msg style="font-size:.85rem;color:var(--anzhiyu-secondtext)"></span>
        </div>
      </form>

      <div class="admin-panel-head" style="margin-top:1.5rem"><h3>评论管理（${list.length}）</h3></div>
      ${
        list.length
          ? `<div class="admin-batch-bar">
        <label class="admin-batch-all"><input type="checkbox" data-batch-all /> 全选</label>
        <span class="admin-batch-info">已选 <strong data-batch-count>0</strong> 项</span>
        <button class="btn danger" data-batch-del disabled>批量删除</button>
      </div>` +
            list
              .map(
                c => {
                  // 头像：与前台评论区一致直接用 avatar_url（头像是外链/已缓存地址，不能走 thumbSrc 加 _w1200）
                  const avatarHtml = c.avatar_url
                    ? `<img class="admin-cmt-avatar" src="${esc(c.avatar_url)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-n="${esc((c.nickname || "?").slice(0, 1))}" onerror="commentAvatarFail(this)" />`
                    : `<span class="admin-cmt-avatar admin-cmt-avatar-txt">${esc((c.nickname || "?").slice(0, 1))}</span>`;
                  // 联系信息：邮箱（mailto）+ 网页（新窗口 nofollow）+ QQ，未填显示灰字
                  const contactHtml = [
                    c.email
                      ? `<a href="mailto:${esc(c.email)}" title="发邮件给 ${esc(c.nickname)}">${esc(c.email)}</a>`
                      : '<span class="muted">未填邮箱</span>',
                    c.website
                      ? `<a href="${esc(c.website)}" target="_blank" rel="nofollow noopener" title="${esc(c.website)}">🌐 ${esc(c.website.replace(/^https?:\/\//, "").replace(/\/$/, "").slice(0, 28))}</a>`
                      : '<span class="muted">未填网页</span>',
                    c.qq ? `<span title="QQ 号">QQ ${esc(c.qq)}</span>` : "",
                  ].filter(Boolean).join('<i class="row-contact-sep"></i>');
                  return `
        <div class="admin-row">
          <div class="admin-check-cell"><input type="checkbox" class="admin-check" value="${c.id}" /></div>
          ${avatarHtml}
          <div class="row-main">
            <div class="row-title">
              ${c.is_ai ? '<span class="tag-mini tag-ai">AI</span>' : c.is_owner ? '<span class="tag-mini">博主</span>' : ""}${c.parent_id > 0 ? '<span class="tag-mini tag-reply">回复</span>' : ""}<strong>${esc(c.nickname)}</strong>：${esc(c.content) || (c.images && c.images.length ? '<span style="color:var(--anzhiyu-secondtext)">[图片评论]</span>' : "")}
            </div>
            ${c.images && c.images.length ? `<div class="comment-images admin-cmt-imgs">${c.images.map(u => { const ts = thumbSrc(u); const orig = fullSrc(u); return `<img src="${esc(ts)}" alt="" loading="lazy" referrerpolicy="no-referrer" class="comment-img" data-lightbox="${esc(orig)}"${ts !== orig ? ` data-orig="${esc(orig)}"` : ""} />`; }).join("")}</div>` : ""}
            <div class="row-sub">
              <span>${timeAgo(c.created_at)}</span>
              <span class="tag-mini">${c.target_type === "post" ? "文章" : "说说"}</span>
              ${(() => {
                // 所属目标可点击直达：文章 /post/{slug}，说说 /#moment-{id}，均新窗口打开
                const label = esc(c.target_excerpt || "#" + c.target_id);
                if (c.target_type === "post") {
                  const href = c.post_slug ? `/post/${encodeURIComponent(c.post_slug)}` : "/posts";
                  return `<span>所属文章：<a class="row-target-link" href="${href}" target="_blank" rel="noopener">${label} ↗</a></span>`;
                }
                return `<span>所属说说：<a class="row-target-link" href="/#moment-${c.target_id}" target="_blank" rel="noopener">${label} ↗</a></span>`;
              })()}
            </div>
            <div class="row-contact">${contactHtml}</div>
            <div class="admin-reply-box" data-reply-box="${c.id}" hidden>
              <textarea maxlength="500" rows="2" placeholder="回复 @${esc(c.nickname)}："></textarea>
              <div class="admin-reply-ops">
                <button class="btn primary sm" data-admin-act="send-reply" data-cid="${c.id}">发送回复</button>
                <button class="btn sm" data-admin-act="cancel-reply" data-cid="${c.id}">取消</button>
              </div>
            </div>
          </div>
          <div class="row-actions">
            <button class="btn" data-admin-act="reply-comment" data-cid="${c.id}">回复</button>
            <button class="btn" data-admin-act="edit-comment" data-cid="${c.id}" data-content="${esc((c.content || "").replace(/"/g, "&quot;"))}" data-images='${esc(JSON.stringify(c.images || []))}'>编辑</button>
            <button class="btn danger" data-admin-act="del-comment" data-cid="${c.id}">删除</button>
          </div>
        </div>`;
                }
              )
              .join("")
          : `<div class="essay-empty">还没有评论</div>`
      }`;
    if (list.length) {
      wireBatch(panel, { rowSel: ".admin-row", endpoint: "/api/admin/comments/batch-delete", label: "条评论", onDone: () => renderAdminComments(panel) });
    }

    /* ---------- 邮件设置保存 ---------- */
    const mailForm = panel.querySelector("[data-mail-settings-form]");
    const mailMsg = panel.querySelector("[data-mail-msg]");
    mailForm.addEventListener("submit", async e => {
      e.preventDefault();
      const btn = mailForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        const updated = await api("/api/admin/settings", {
          method: "PUT",
          body: {
            mail_enabled: mailForm.mail_enabled.checked,
            mail_resend_key: mailForm.mail_resend_key.value.trim(),
            mail_from: mailForm.mail_from.value.trim(),
            mail_admin_to: mailForm.mail_admin_to.value.trim(),
            mail_notify_admin: mailForm.mail_notify_admin.checked,
            mail_reply_notify: mailForm.mail_reply_notify.checked,
          },
        });
        if (mailMsg) { mailMsg.style.color = "#23b26d"; mailMsg.textContent = "✓ 已保存"; }
        toast("邮件设置已保存");
      } catch (err) {
        if (mailMsg) { mailMsg.style.color = "#f56c6c"; mailMsg.textContent = "✗ " + err.message; }
      } finally {
        btn.disabled = false;
      }
    });
  }

  /** 后台：音乐播放器设置面板 */
  /* ---------- 后台 Tab：外观 ---------- */
  /* ---------- 后台 Tab：多语言 ---------- */
  async function renderAdminI18n(panel) {
    panel.innerHTML = `<div class="essay-loading"><span class="spinner"></span><span>加载中...</span></div>`;
    let s;
    try {
      s = await api("/api/admin/settings");
    } catch (e) {
      panel.innerHTML = `<div class="essay-empty">${esc(e.message)}</div>`;
      return;
    }
    const enabledLangs = String(s.i18n_langs || "zh-CN,zh-TW,en")
      .split(",")
      .map(x => x.trim())
      .filter(Boolean);
    const has = l => enabledLangs.indexOf(l) >= 0;
    const LANG_OPTS = [
      { v: "zh-CN", name: "简体中文", desc: "默认" },
      { v: "zh-TW", name: "繁體中文", desc: "台港澳访客自动使用" },
      { v: "en", name: "English", desc: "海外访客自动使用" },
    ];
    panel.innerHTML = `
      <div class="admin-panel-head"><h3>多语言</h3></div>
      <form class="settings-form" data-i18n-form>
        <details class="admin-fold" open>
          <summary class="admin-fold-summary">语言设置</summary>
          <div class="admin-fold-body">
            <label class="switch-row">
              <span class="toggle"><input type="checkbox" name="i18n_enabled" ${s.i18n_enabled ? "checked" : ""} /><span></span></span>
              <span>
                启用多语言
                <br /><small style="color:var(--anzhiyu-secondtext)">关闭后全站只显示默认语言，顶栏语言切换按钮自动隐藏；访客已保存的语言选择会被保留</small>
              </span>
            </label>
            <div class="field">
              <label>默认语言<br /><small style="color:var(--anzhiyu-secondtext)">无法判定访客来源时使用；也对搜索引擎与关闭多语言时生效</small></label>
              <select name="i18n_default" style="max-width:240px">
                ${LANG_OPTS.map(o => `<option value="${o.v}"${s.i18n_default === o.v ? " selected" : ""}>${o.name}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <label>开放语言<br /><small style="color:var(--anzhiyu-secondtext)">勾选的语言才会出现在顶栏切换器并允许自动切换；默认语言始终包含在内</small></label>
              <div class="i18n-lang-grid">
                ${LANG_OPTS.map(
                  o => `
                  <label class="i18n-lang-opt">
                    <input type="checkbox" name="i18n_langs" value="${o.v}" ${has(o.v) ? "checked" : ""} />
                    <span><b>${o.name}</b><small>${o.desc}</small></span>
                  </label>`
                ).join("")}
              </div>
            </div>
            <label class="switch-row">
              <span class="toggle"><input type="checkbox" name="i18n_auto_detect" ${s.i18n_auto_detect !== false ? "checked" : ""} /><span></span></span>
              <span>
                按访问地自动判定
                <br /><small style="color:var(--anzhiyu-secondtext)">首次访问时：大陆→简体，台湾/香港/澳门→繁体，其他地区→英语，浏览器语言作为补充判定。访客手动选择后永远以手动选择为准</small>
              </span>
            </label>
            <label class="switch-row">
              <span class="toggle"><input type="checkbox" name="i18n_content_translate" ${s.i18n_content_translate !== false ? "checked" : ""} /><span></span></span>
              <span>
                动态内容翻译
                <br /><small style="color:var(--anzhiyu-secondtext)">说说、文章、关于页：繁体走本地转换，英语优先走百度翻译（国内直连、快速稳定），失败自动回退 Workers AI；译文永久缓存，原文修改后自动重译</small>
              </span>
            </label>
            <div class="field">
              <label>百度翻译凭证（可选）<br /><small style="color:var(--anzhiyu-secondtext)">在 <a href="https://fanyi-api.baidu.com/" target="_blank" rel="noopener">百度翻译开放平台</a> 开通「通用翻译API」后获取；标准版免费不限字符量（QPS=1），留空则仅使用 Workers AI 翻译</small></label>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
                <input name="baidu_translate_appid" maxlength="32" value="${esc(s.baidu_translate_appid || "")}" placeholder="APP ID" autocomplete="off" />
                <input name="baidu_translate_key" maxlength="64" value="${esc(s.baidu_translate_key || "")}" placeholder="密钥" autocomplete="new-password" />
              </div>
            </div>
          </div>
        </details>
        <button class="btn primary" type="submit">保存设置</button>
      </form>`;
  }

  async function renderAdminAppearance(panel) {
    panel.innerHTML = `<div class="essay-loading"><span class="spinner"></span><span>加载中...</span></div>`;
    let s;
    try {
      s = await api("/api/admin/settings");
    } catch (e) {
      panel.innerHTML = `<div class="essay-empty">${esc(e.message)}</div>`;
      return;
    }
    panel.innerHTML = `
      <div class="admin-panel-head"><h3>站点外观</h3></div>
      <form class="settings-form" data-settings-form>
        <details class="admin-fold">
          <summary class="admin-fold-summary">基础信息</summary>
          <div class="admin-fold-body">
        <div class="field">
          <label>站点名称（顶栏品牌 / 浏览器标题）</label>
          <input name="site_title" maxlength="40" value="${esc(s.site_title)}" required />
        </div>
        <div class="field">
          <label>首页导航文字</label>
          <input name="nav_feeds_name" maxlength="12" value="${esc(s.nav_feeds_name)}" required />
        </div>
        <div class="field">
          <label>首页每页条数（1-50）<br /><small style="color:var(--anzhiyu-secondtext)">首页时间线每次加载的数量，超出后向下滚动分页加载；越小越省流量和服务器请求</small></label>
          <input name="feed_page_size" type="number" min="1" max="50" value="${esc(s.feed_page_size)}" required />
        </div>
        <div class="field">
          <label>顶栏品牌头像<br /><small style="color:var(--anzhiyu-secondtext)">仅图片 URL，或点击"上传"选择本地图片；留空显示默认笔尖图标</small></label>
          <div style="display:flex;gap:.5rem;align-items:center">
            <input name="brand_avatar" maxlength="200" value="${esc(s.brand_avatar)}" placeholder="https://...（留空=默认图标）" style="flex:1" />
            <button type="button" class="btn" data-avatar-upload="brand_avatar">上传</button>
            <input type="file" accept="image/*" data-avatar-file="brand_avatar" hidden />
          </div>
          <div class="field-hint" data-avatar-preview="brand_avatar" style="margin-top:.4rem">${/^https?:\/\//i.test(s.brand_avatar || "") ? `<img src="${esc(s.brand_avatar)}" alt="" style="width:48px;height:48px;border-radius:50%;object-fit:cover" referrerpolicy="no-referrer" />` : ""}</div>
        </div>
        <div class="field">
          <label>站点图标（favicon）<br /><small style="color:var(--anzhiyu-secondtext)">仅图片 URL，或点"上传"选本地图片；留空=默认笔尖图标</small></label>
          <div style="display:flex;gap:.5rem;align-items:center">
            <input name="site_icon" maxlength="300" value="${esc(s.site_icon)}" placeholder="https://...（留空=默认图标）" style="flex:1" />
            <button type="button" class="btn" data-avatar-upload="site_icon">上传</button>
            <input type="file" accept="image/*" data-avatar-file="site_icon" hidden />
          </div>
          <div class="field-hint" data-avatar-preview="site_icon" style="margin-top:.4rem">${/^https?:\/\//i.test(s.site_icon || "") ? `<img src="${esc(s.site_icon)}" alt="" style="width:48px;height:48px;object-fit:cover" referrerpolicy="no-referrer" />` : ""}</div>
        </div>
        <div class="field">
          <label>评论表情包（OwO JSON 地址）<br /><small style="color:var(--anzhiyu-secondtext)">评论区表情面板的图片表情来源，OwO 格式 JSON；默认站内 /owo.json。可换成任意 owo.json 直链（如 Twikoo/Artalk 表情包），留空=用默认</small></label>
          <input name="comment_emoji_owo_url" maxlength="500" value="${esc(s.comment_emoji_owo_url)}" placeholder="/owo.json" />
        </div>
        <div class="field">
          <label>说说作者昵称<br /><small style="color:var(--anzhiyu-secondtext)">卡片左上角昵称；未设置作者头像时，头像显示昵称首字符</small></label>
          <input name="author_name" maxlength="32" value="${esc(s.author_name)}" />
        </div>
        <div class="field">
          <label>说说作者头像（可选）<br /><small style="color:var(--anzhiyu-secondtext)">图片 URL 或本地"上传"；留空则用昵称首字符</small></label>
          <div style="display:flex;gap:.5rem;align-items:center">
            <input name="author_avatar" maxlength="200" value="${esc(s.author_avatar)}" placeholder="https://...（留空=昵称首字符）" style="flex:1" />
            <button type="button" class="btn" data-avatar-upload="author_avatar">上传</button>
            <input type="file" accept="image/*" data-avatar-file="author_avatar" hidden />
          </div>
          <div class="field-hint" data-avatar-preview="author_avatar" style="margin-top:.4rem">${/^https?:\/\//i.test(s.author_avatar || "") ? `<img src="${esc(s.author_avatar)}" alt="" style="width:48px;height:48px;border-radius:50%;object-fit:cover" referrerpolicy="no-referrer" />` : ""}</div>
        </div>
        <div class="field">
          <label>文章卡片头像<br /><small style="color:var(--anzhiyu-secondtext)">仅图片 URL，或点击"上传"选择本地图片；留空显示默认文档图标</small></label>
          <div style="display:flex;gap:.5rem;align-items:center">
            <input name="post_avatar" maxlength="200" value="${esc(s.post_avatar)}" placeholder="https://...（留空=默认图标）" style="flex:1" />
            <button type="button" class="btn" data-avatar-upload="post_avatar">上传</button>
            <input type="file" accept="image/*" data-avatar-file="post_avatar" hidden />
          </div>
          <div class="field-hint" data-avatar-preview="post_avatar" style="margin-top:.4rem">${/^https?:\/\//i.test(s.post_avatar || "") ? `<img src="${esc(s.post_avatar)}" alt="" style="width:48px;height:48px;border-radius:50%;object-fit:cover" referrerpolicy="no-referrer" />` : ""}</div>
        </div>
          </div>
        </details>

        <details class="admin-fold">
          <summary class="admin-fold-summary">横幅</summary>
          <div class="admin-fold-body">
        <div class="field">
          <label>小标签</label>
          <input name="essay_tips" maxlength="60" value="${esc(s.essay_tips)}" />
        </div>
        <div class="field">
          <label>大标题</label>
          <input name="essay_title" maxlength="40" value="${esc(s.essay_title)}" required />
        </div>
        <div class="field">
          <label>描述</label>
          <input name="essay_subtitle" maxlength="200" value="${esc(s.essay_subtitle)}" />
        </div>
        <div class="field">
          <label>发布按钮文字</label>
          <input name="essay_button_text" maxlength="20" value="${esc(s.essay_button_text)}" />
        </div>
        <div class="field">
          <label>按钮链接（可选）<br /><small style="color:var(--anzhiyu-secondtext)">填写 http(s) 链接后，横幅按钮改为点击跳转该链接；留空则保持默认发布/解锁行为</small></label>
          <input name="banner_button_url" maxlength="500" value="${esc(s.banner_button_url)}" placeholder="https://example.com" />
        </div>
        <div class="field">
          <label>外链打开方式<br /><small style="color:var(--anzhiyu-secondtext)">仅对 http(s) 外链生效；站内路径始终在当前标签内切换</small></label>
          <select name="banner_button_target" style="max-width:220px">
            <option value="_blank"${s.banner_button_target !== "_self" ? " selected" : ""}>新标签打开</option>
            <option value="_self"${s.banner_button_target === "_self" ? " selected" : ""}>当前标签打开</option>
          </select>
        </div>
        <div class="field">
          <label>背景图模式</label>
          <select name="banner_bg_mode" data-bg-mode>
            <option value="static"${s.banner_bg_mode !== "random" ? " selected" : ""}>固定图片</option>
            <option value="random"${s.banner_bg_mode === "random" ? " selected" : ""}>随机图片（本站代理缓存，更快更稳）</option>
          </select>
        </div>
        <div class="field">
          <div style="display:flex;gap:.6rem;align-items:center;flex-wrap:wrap">
            <button type="button" class="btn" data-bg-refresh>换一张</button>
            <span class="field-hint" style="margin:0">对当前图片不满意时点击：随机缓存模式会清除本站缓存重新抓图；动态接口模式会重新解析一张新图。立即生效，无需保存。</span>
          </div>
        </div>
        <div class="field" data-bg-panel="static">
          <label>背景图 URL（可选）<br /><small style="color:var(--anzhiyu-secondtext)">填图片 URL，或点"上传"存到 R2；留空用默认渐变</small></label>
          <div style="display:flex;gap:.5rem;align-items:center">
            <input name="banner_bg_image" maxlength="500" value="${esc(s.banner_bg_image)}" placeholder="https://... 或留空使用默认渐变" style="flex:1" />
            <button type="button" class="btn" data-banner-upload>上传</button>
            <input type="file" accept="image/*" data-banner-file hidden />
          </div>
          <div class="field-hint" data-banner-preview style="margin-top:.4rem">${s.banner_bg_image ? `<img src="${esc(s.banner_bg_image)}" alt="" style="max-width:100%;max-height:120px;border-radius:8px;object-fit:cover" referrerpolicy="no-referrer" />` : ""}</div>
        </div>
        <div class="field" data-bg-panel="random">
          <label>随机图源 URL<br /><small style="color:var(--anzhiyu-secondtext)">需包含 <code>{seed}</code> 占位符；同一时间桶内返回同一张图，命中本站缓存</small></label>
          <input name="banner_bg_source" maxlength="500" value="${esc(s.banner_bg_source)}" placeholder="https://picsum.photos/seed/{seed}/1350/300" />
          <label style="margin-top:.6rem">换图频率</label>
          <div style="display:flex;gap:.4rem;align-items:center;flex-wrap:wrap">
            <button type="button" class="btn" data-bg-int="1">每小时</button>
            <button type="button" class="btn" data-bg-int="24">每天</button>
            <button type="button" class="btn" data-bg-int="168">每周</button>
            <input type="number" name="banner_bg_interval" min="1" max="720" value="${esc(s.banner_bg_interval)}" style="width:120px" aria-label="自定义小时" />
            <span style="font-size:.8rem;color:var(--anzhiyu-secondtext)">小时（可自定义 1-720）</span>
          </div>
          <div class="field-hint" style="margin-top:.4rem">预览：<a href="/api/bg" target="_blank" rel="noopener" style="color:var(--anzhiyu-main)">/api/bg</a>（新标签打开，图片经本站抓取后缓存到 R2）</div>
        </div>
        <div class="field">
          <label class="switch-row">
            <span class="toggle"><input type="checkbox" name="site_bg_enabled" ${s.site_bg_enabled ? "checked" : ""} /><span></span></span>
            <span>全站背景图（跟随横幅取图模式，玻璃拟态）</span>
          </label>
          <div class="field-hint">背景取图跟随上方横幅模式：「固定图片」填动态随机接口 URL 时，每次刷新随横幅一起换图；「随机图片（本站代理缓存）」时走 R2 时间桶，全站同周期一张、更快更稳。文章正文、评论弹窗、灯箱与后台保持纯色。</div>
        </div>
        <div class="field sitebg-controls ${s.site_bg_enabled ? "" : "is-collapsed"}" data-sitebg-controls>
          <div class="sitebg-controls-inner">
          <label>玻璃效果微调（拖动即时预览，保存后对访客生效）</label>
          <div class="sitebg-range-row">
            <span>遮罩浓度</span>
            <input type="range" name="site_bg_mask" min="0" max="100" step="1" value="${esc(s.site_bg_mask)}" data-sitebg-live data-sitebg-unit="%" />
            <b data-sitebg-val>${esc(s.site_bg_mask)}%</b>
          </div>
          <div class="sitebg-range-row">
            <span>卡片不透明度</span>
            <input type="range" name="site_bg_card" min="0" max="100" step="1" value="${esc(s.site_bg_card)}" data-sitebg-live data-sitebg-unit="%" />
            <b data-sitebg-val>${esc(s.site_bg_card)}%</b>
          </div>
          <div class="sitebg-range-row">
            <span>页脚不透明度</span>
            <input type="range" name="site_bg_footer" min="0" max="100" step="1" value="${esc(s.site_bg_footer)}" data-sitebg-live data-sitebg-unit="%" />
            <b data-sitebg-val>${esc(s.site_bg_footer)}%</b>
          </div>
          <div class="sitebg-range-row">
            <span>毛玻璃模糊</span>
            <input type="range" name="site_bg_blur" min="0" max="40" step="1" value="${esc(s.site_bg_blur)}" data-sitebg-live data-sitebg-unit="px" />
            <b data-sitebg-val>${esc(s.site_bg_blur)}px</b>
          </div>
          <div class="sitebg-preview" data-sitebg-preview>
            <div class="sitebg-preview-mask"></div>
            <div class="sitebg-preview-topbar">顶部导航</div>
            <div class="sitebg-preview-card">卡片玻璃效果</div>
            <div class="sitebg-preview-footer">页脚效果</div>
          </div>
          <div class="field-hint">预览条实时反映当前滑块值（未保存时仅自己可见）。遮罩越大文字越清晰、背景越淡；卡片/页脚数值越小越透；模糊 0 = 无玻璃化。</div>
          </div>
        </div>
          </div>
        </details>

        <details class="admin-fold">
          <summary class="admin-fold-summary">页脚</summary>
          <div class="admin-fold-body">
        <div class="field">
          <label>页脚文案（可选，支持 HTML）<br /><small style="color:var(--anzhiyu-secondtext)">例如：© 2024 Jxe · 轻博客 · Powered by Moments</small></label>
          <textarea name="footer_text" maxlength="2000" rows="3" placeholder="© 2024 My Site. All rights reserved.">${esc(s.footer_text)}</textarea>
        </div>
        <div class="field">
          <label>网站运行起始时间（可选）<br /><small style="color:var(--anzhiyu-secondtext)">填写后页脚显示「网站已运行 X 天 HH:MM:SS」，支持 ISO 时间（如 2024-01-01T00:00:00）或 yyyy-mm-dd</small></label>
          <input name="footer_run_since" maxlength="40" value="${esc(s.footer_run_since)}" placeholder="2024-01-01T00:00:00" />
        </div>
        <div class="field">
          <label>主题自动切换模式<br /><small style="color:var(--anzhiyu-secondtext)">关闭=手动切换后锁定；跟随系统=系统深色/浅色切换时网站自动跟随；按时间=白天浅色、夜晚深色</small></label>
          <select name="theme_auto_mode" style="max-width:280px">
            <option value="off"${(s.theme_auto_mode || "off") === "off" ? " selected" : ""}>关闭（手动切换后锁定）</option>
            <option value="system"${(s.theme_auto_mode || "off") === "system" ? " selected" : ""}>跟随系统主题</option>
            <option value="time"${(s.theme_auto_mode || "off") === "time" ? " selected" : ""}>按时间切换（白天/夜晚）</option>
          </select>
        </div>
        <div class="field" data-theme-time-range style="display:${(s.theme_auto_mode || "off") === "time" ? "" : "none"}">
          <label>深色模式时段<br /><small style="color:var(--anzhiyu-secondtext)">开始时间到结束时间显示深色，其余时间浅色。支持跨天（如 18-6 表示晚 6 点到早 6 点深色）</small></label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
            <div><label style="font-size:.78rem;color:var(--anzhiyu-secondtext)">开始（时）</label><input name="theme_dark_start" type="number" min="0" max="23" value="${esc(s.theme_dark_start)}" placeholder="18" /></div>
            <div><label style="font-size:.78rem;color:var(--anzhiyu-secondtext)">结束（时）</label><input name="theme_dark_end" type="number" min="0" max="23" value="${esc(s.theme_dark_end)}" placeholder="6" /></div>
          </div>
        </div>
          </div>
        </details>

        <details class="admin-fold">
          <summary class="admin-fold-summary">导航设置</summary>
          <div class="admin-fold-body">
        <div class="field">
          <label class="switch-row">
            <span class="toggle"><input type="checkbox" name="links_enabled" ${s.links_enabled ? "checked" : ""} /><span></span></span>
            <span>显示「友链」入口（/links）</span>
          </label>
          <label class="switch-row">
            <span class="toggle"><input type="checkbox" name="photos_enabled" ${s.photos_enabled ? "checked" : ""} /><span></span></span>
            <span>显示「相册」入口（/photos）</span>
          </label>
          <small style="color:var(--anzhiyu-secondtext)">「关于我」入口开关在「关于我」Tab。三个入口可独立开关，关闭后顶栏与移动端菜单均不显示。</small>
        </div>
        <div class="field">
          <label>自定义导航项（可选，每行一条：名称|链接，最多 6 条）<br /><small style="color:var(--anzhiyu-secondtext)">显示在顶栏"即刻"之后、"后台"之前，新标签打开</small></label>
          <textarea name="nav_links" maxlength="1000" rows="3" placeholder="友链|https://example.com&#10;相册|https://example.com/photos">${esc(s.nav_links)}</textarea>
        </div>
          </div>
        </details>

        <details class="admin-fold">
          <summary class="admin-fold-summary">文章打赏</summary>
          <div class="admin-fold-body">
        <div class="field">
          <label class="switch-row">
            <span class="toggle"><input type="checkbox" name="reward_enabled" ${s.reward_enabled ? "checked" : ""} /><span></span></span>
            <span>在文章底部展示打赏卡片</span>
          </label>
        </div>
        <div class="field">
          <label>打赏二维码图片 URL<br /><small style="color:var(--anzhiyu-secondtext)">微信/支付宝收款码图片地址，可上传到「媒体」后复制链接</small></label>
          <input name="reward_qrcode" maxlength="500" value="${esc(s.reward_qrcode)}" placeholder="https://.../qrcode.png" />
        </div>
        <div class="field">
          <label>打赏引导文案</label>
          <input name="reward_text" maxlength="300" value="${esc(s.reward_text)}" />
        </div>
          </div>
        </details>

        <details class="admin-fold">
          <summary class="admin-fold-summary">评论头像设置</summary>
          <div class="admin-fold-body">
        <div class="field">
          <label>随机头像 API（回退源）<br /><small style="color:var(--anzhiyu-secondtext)">评论者无 QQ / Gravatar 时，从这里随机取头像。每行一条，按序自动故障转移；支持 {imgtype} 占位。留空=用默认 apihz</small></label>
          <textarea name="random_avatar_api" rows="3" style="width:100%;resize:vertical" placeholder="https://cn.apihz.cn/api/img/apihzimgtx.php?id=88888888&amp;key=88888888&amp;type=1&amp;imgtype={imgtype}">${esc(s.random_avatar_api)}</textarea>
        </div>
        <div class="field">
          <label>随机头像类型<br /><small style="color:var(--anzhiyu-secondtext)">无 QQ / Gravatar 时随机头像的风格；默认 9=古风</small></label>
          <select name="random_avatar_imgtype" style="max-width:220px">
            ${[["0","综合"],["1","男生"],["2","女生"],["3","情侣"],["4","闺蜜"],["5","动漫"],["6","萌宠"],["7","可爱"],["8","欧美"],["9","古风"],["10","沙雕"],["11","仙女"],["12","简单"],["13","QQ"],["14","微信"],["15","文字"],["16","个性"]].map(([v,t])=>`<option value="${v}"${String(s.random_avatar_imgtype)===v?" selected":""}>${v} · ${t}</option>`).join("")}
          </select>
        </div>
        <div class="field" style="border:1px solid var(--anzhiyu-card-border,#e3e8ef);border-radius:10px;padding:.9rem 1rem;background:var(--anzhiyu-card-bg,#fafbfc)">
          <label style="font-weight:600">刷新头像缓存</label>
          <div style="color:var(--anzhiyu-secondtext);font-size:.82rem;margin:.25rem 0 .6rem">扫描历史评论里的邮箱，把缺失的头像补拉到本地（已缓存的默认跳过）。</div>
          <label class="switch-row" style="margin-bottom:.5rem">
            <span class="toggle"><input type="checkbox" data-refresh-avatars-force /><span></span></span>
            <span>强制覆盖已缓存头像（较慢，随机头像会重新抽取）</span>
          </label>
          <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap">
            <button type="button" class="btn" data-refresh-avatars>开始刷新</button>
            <span data-refresh-avatars-msg style="color:var(--anzhiyu-secondtext);font-size:.85rem"></span>
          </div>
        </div>
          </div>
        </details>

        <details class="admin-fold">
          <summary class="admin-fold-summary">QQ 设置</summary>
          <div class="admin-fold-body">
        <div class="field" style="border:1px solid var(--anzhiyu-card-border,#e3e8ef);border-radius:10px;padding:.9rem 1rem;background:var(--anzhiyu-card-bg,#fafbfc)">
          <div style="color:var(--anzhiyu-secondtext);font-size:.82rem;margin:.25rem 0 .6rem">评论者填 QQ 号时，按所选方式获取昵称。凭证仅存服务端，绝不下发前台。</div>
          <div class="field" style="margin-bottom:.6rem">
            <label style="font-size:.82rem;font-weight:600">获取方式</label>
            <select name="qq_nick_mode" data-qq-mode style="max-width:280px">
              <option value="direct"${(s.qq_nick_mode || "fallback") === "direct" ? " selected" : ""}>腾讯直连（使用下方 Cookie 查 Qzone）</option>
              <option value="apihz"${(s.qq_nick_mode || "fallback") === "apihz" ? " selected" : ""}>apihz 接口（使用下方开发者 ID/KEY）</option>
              <option value="fallback"${(s.qq_nick_mode || "fallback") === "fallback" ? " selected" : ""}>逐个尝试（先腾讯，失败再 apihz）</option>
            </select>
          </div>

          <!-- 腾讯直连配置 -->
          <div data-qq-section="direct" style="display:none">
            <div style="font-size:.78rem;color:var(--anzhiyu-secondtext);margin:.4rem 0 .3rem;font-weight:600">QQ Cookie（腾讯直连与 apihz 共用）</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
              <div><label style="font-size:.78rem;color:var(--anzhiyu-secondtext)">系统 QQ（ckqq）</label><input name="qq_ckqq" value="${esc(s.qq_ckqq)}" placeholder="你的 QQ 号" /></div>
              <div><label style="font-size:.78rem;color:var(--anzhiyu-secondtext)">skey</label><input name="qq_skey" value="${esc(s.qq_skey)}" placeholder="cookie 里的 skey" autocomplete="off" data-lpignore="true" data-1p-ignore="true" /></div>
            </div>
            <div style="margin-top:.4rem"><label style="font-size:.78rem;color:var(--anzhiyu-secondtext)">pskey（p_skey）</label><input name="qq_pskey" value="${esc(s.qq_pskey)}" placeholder="cookie 里的 p_skey" style="width:100%" autocomplete="off" data-lpignore="true" data-1p-ignore="true" /></div>
            <div style="margin-top:.4rem"><label style="font-size:.78rem;color:var(--anzhiyu-secondtext)">Cookie 保活间隔（小时）</label><input name="qq_keepalive_interval" type="number" min="1" max="72" value="${esc(s.qq_keepalive_interval)}" placeholder="6" style="width:100%" /></div>
            <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;margin-top:.6rem">
              <a data-qq-bookmarklet class="btn" href="#" style="text-decoration:none">拖拽到书签栏：一键抓取</a>
              <button type="button" class="btn" data-qq-test>测试连接</button>
              <span data-qq-test-msg style="color:var(--anzhiyu-secondtext);font-size:.85rem"></span>
            </div>
            <details style="margin-top:.6rem">
              <summary style="cursor:pointer;font-size:.82rem;color:var(--anzhiyu-secondtext)">没有书签栏？手动粘贴 Cookie 自动解析</summary>
              <textarea data-qq-paste rows="2" placeholder="登录 vip.qq.com 后，F12 把整段 Cookie 粘到这里" style="width:100%;margin-top:.4rem;resize:vertical"></textarea>
              <button type="button" class="btn" data-qq-parse style="margin-top:.35rem">解析并填入</button>
            </details>
          </div>

          <!-- apihz 配置 -->
          <div data-qq-section="apihz" style="display:none">
            <div style="font-size:.78rem;color:var(--anzhiyu-secondtext);margin:.4rem 0 .3rem;font-weight:600">apihz 接口（接口盒子）</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
              <div><label style="font-size:.78rem;color:var(--anzhiyu-secondtext)">开发者 ID</label><input name="apihz_id" value="${esc(s.apihz_id)}" placeholder="88888888" style="width:100%" autocomplete="off" data-lpignore="true" data-1p-ignore="true" /></div>
              <div><label style="font-size:.78rem;color:var(--anzhiyu-secondtext)">开发者 KEY</label><input name="apihz_key" value="${esc(s.apihz_key)}" placeholder="88888888" style="width:100%" autocomplete="off" data-lpignore="true" data-1p-ignore="true" /></div>
            </div>
            <div style="color:var(--anzhiyu-secondtext);font-size:.75rem;margin-top:.3rem">接口：<code>https://cn.apihz.cn/api/other/qq.php</code>，可复用上方 QQ Cookie（ckqq/skey/pskey）</div>
          </div>
        </div>
          </div>
        </details>

        <button class="btn primary" type="submit" style="margin-top:1rem">保存设置</button>
      </form>`;

    // 横幅背景图上传
    const uploadBtn = panel.querySelector("[data-banner-upload]");
    if (uploadBtn) {
      const fileInput = panel.querySelector("[data-banner-file]");
      const urlInput = panel.querySelector('[name="banner_bg_image"]');
      const preview = panel.querySelector("[data-banner-preview]");
      uploadBtn.addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", async () => {
        const file = fileInput.files[0];
        if (!file) return;
        uploadBtn.disabled = true;
        uploadBtn.textContent = "上传中...";
        try {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("kind", "image");
          const res = await fetch("/api/admin/upload", { method: "POST", body: fd, credentials: "same-origin" });
          const json = await res.json();
          if (!res.ok || !json.data?.src) throw new Error(json.message || "上传失败");
          const full = /^https?:\/\//i.test(json.data.src) ? json.data.src : location.origin + json.data.src;
          urlInput.value = full;
          preview.innerHTML = `<img src="${esc(full)}" alt="" style="max-width:100%;max-height:120px;border-radius:8px;object-fit:cover" referrerpolicy="no-referrer" />`;
          toast("上传成功，记得点击保存设置");
        } catch (err) {
          toast(err.message);
        } finally {
          uploadBtn.disabled = false;
          uploadBtn.textContent = "上传";
          fileInput.value = "";
        }
      });
    }

    // 背景图：模式切换显示对应面板 + 频率预设按钮
    const bgMode = panel.querySelector("[data-bg-mode]");
    if (bgMode) {
      const applyBgPanels = () => {
        const m = bgMode.value;
        panel.querySelectorAll("[data-bg-panel]").forEach(p => {
          p.style.display = p.getAttribute("data-bg-panel") === m ? "" : "none";
        });
      };
      bgMode.addEventListener("change", applyBgPanels);
      applyBgPanels();
    }
    panel.querySelectorAll("[data-bg-int]").forEach(b =>
      b.addEventListener("click", () => {
        const inp = panel.querySelector('[name="banner_bg_interval"]');
        if (inp) inp.value = b.getAttribute("data-bg-int");
      })
    );

    // 「换一张」：random 模式清当前桶缓存；static 模式重新解析动态图源
    const bgRefreshBtn = panel.querySelector("[data-bg-refresh]");
    if (bgRefreshBtn) {
      bgRefreshBtn.addEventListener("click", async () => {
        bgRefreshBtn.disabled = true;
        bgRefreshBtn.textContent = "更换中…";
        try {
          const r = await api("/api/bg/refresh", { method: "POST" });
          if (r.settings) state.settings = r.settings;
          _bgResolved = null; // 清缓存，下次重新解析
          // 更新预览和已渲染页面
          applySiteBg(state.settings);
          // 同步刷新预览条
          const pv = panel.querySelector("[data-sitebg-preview]");
          if (pv) {
            const bg = await ensureBgResolved(state.settings);
            if (bg) pv.style.backgroundImage = `url("${bg.url.replace(/["\\]/g, encodeURIComponent)}")`;
          }
          // 同步刷新横幅预览小图（static 模式）
          const bannerPreview = panel.querySelector("[data-banner-preview]");
          if (bannerPreview) {
            const bg = await ensureBgResolved(state.settings);
            if (bg) bannerPreview.innerHTML = `<img src="${esc(bg.url)}" alt="" style="max-width:100%;max-height:120px;border-radius:8px;object-fit:cover" referrerpolicy="no-referrer" />`;
          }
          toast("已更换，刷新生效");
        } catch (err) {
          toast(err.message || "换图失败");
        } finally {
          bgRefreshBtn.disabled = false;
          bgRefreshBtn.textContent = "换一张";
        }
      });
    }

    // 全站背景玻璃滑块：数值标签即时更新 + 实时换算 CSS 变量驱动预览条（保存后才写入数据库）
    panel.querySelectorAll("[data-sitebg-live]").forEach(inp => {
      inp.addEventListener("input", () => {
        const valEl = inp.closest(".sitebg-range-row").querySelector("[data-sitebg-val]");
        if (valEl) valEl.textContent = inp.value + (inp.dataset.sitebgUnit || "");
        state.settings[inp.name] = inp.value;
        applySiteBgVars(state.settings);
      });
    });

    // 玻璃参数区跟随开关：开启全站背景图自动展开，关闭自动折叠（高度过渡动画，未保存同样即时联动）
    const siteBgToggle = panel.querySelector('[name="site_bg_enabled"]');
    const siteBgControls = panel.querySelector("[data-sitebg-controls]");
    if (siteBgToggle && siteBgControls) {
      siteBgToggle.addEventListener("change", () => {
        siteBgControls.classList.toggle("is-collapsed", !siteBgToggle.checked);
      });
    }

    // 预览条铺当前背景图（与前台取图同一来源；random 走 /api/bg，static 直连横幅 URL）
    const siteBgPreview = panel.querySelector("[data-sitebg-preview]");
    if (siteBgPreview) {
      const sNow = state.settings;
      const bg = resolveSiteBgUrl(sNow);
      if (bg) siteBgPreview.style.backgroundImage = `url("${bg.url.replace(/["\\]/g, encodeURIComponent)}")`;
    }

    // 头像类字段上传 + URL 实时预览
    const avatarPreviewHtml = url =>
      `<img src="${esc(url)}" alt="" style="width:48px;height:48px;border-radius:50%;object-fit:cover" referrerpolicy="no-referrer" />`;
    ["brand_avatar", "author_avatar", "post_avatar", "site_icon", "about_avatar"].forEach(field => {
      const btn = panel.querySelector(`[data-avatar-upload="${field}"]`);
      if (!btn) return;
      const fileInp = panel.querySelector(`[data-avatar-file="${field}"]`);
      const urlInp = panel.querySelector(`[name="${field}"]`);
      const preview = panel.querySelector(`[data-avatar-preview="${field}"]`);
      btn.addEventListener("click", () => fileInp.click());
      fileInp.addEventListener("change", async () => {
        const file = fileInp.files[0];
        if (!file) return;
        btn.disabled = true;
        btn.textContent = "上传中...";
        try {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("kind", "image");
          const res = await fetch("/api/admin/upload", { method: "POST", body: fd, credentials: "same-origin" });
          const json = await res.json();
          if (!res.ok || !json.data?.src) throw new Error(json.message || "上传失败");
          const full = /^https?:\/\//i.test(json.data.src) ? json.data.src : location.origin + json.data.src;
          urlInp.value = full;
          preview.innerHTML = avatarPreviewHtml(full);
          toast("上传成功，记得点击保存设置");
        } catch (err) {
          toast(err.message);
        } finally {
          btn.disabled = false;
          btn.textContent = "上传";
          fileInp.value = "";
        }
      });
      urlInp.addEventListener("input", () => {
        preview.innerHTML = /^https?:\/\//i.test(urlInp.value.trim()) ? avatarPreviewHtml(urlInp.value.trim()) : "";
      });
    });

    // 刷新评论头像缓存：分页批处理，每批 ≤100，循环跑到结束，避免单请求超时/超子请求上限
    const refreshBtn = panel.querySelector("[data-refresh-avatars]");
    if (refreshBtn) {
      const msg = panel.querySelector("[data-refresh-avatars-msg]");
      const forceBox = panel.querySelector("[data-refresh-avatars-force]");
      refreshBtn.addEventListener("click", async () => {
        refreshBtn.disabled = true;
        let offset = 0;
        let total = 0, ok = 0, fail = 0;
        const force = forceBox && forceBox.checked ? "1" : "0";
        try {
          for (;;) {
            if (msg) msg.textContent = `刷新中…已处理 ${total}`;
            const r = await api(`/api/admin/avatars/refresh?offset=${offset}&force=${force}`, { method: "POST" });
            total += r.count || 0;
            ok += r.refreshed || 0;
            fail += r.failed || 0;
            if (!r.hasMore) break;
            offset += r.count || 100;
          }
          if (msg) msg.textContent = `完成：共 ${total} 个，成功 ${ok}${fail ? `，失败 ${fail}` : ""}`;
        } catch (e) {
          if (msg) msg.textContent = `中断于 ${total}：${e.message}`;
        } finally {
          refreshBtn.disabled = false;
        }
      });
    }

    // 主题自动切换模式下拉联动：选择"按时间"时显示时间范围配置
    const themeModeSel = panel.querySelector('[name="theme_auto_mode"]');
    if (themeModeSel) {
      const applyThemeMode = () => {
        const timeRange = panel.querySelector('[data-theme-time-range]');
        if (timeRange) timeRange.style.display = themeModeSel.value === "time" ? "" : "none";
      };
      themeModeSel.addEventListener("change", applyThemeMode);
      applyThemeMode();
    }

    // QQ 设置：昵称获取策略切换时展开/收起对应配置区
    const qqMode = panel.querySelector("[data-qq-mode]");
    if (qqMode) {
      const applyQqSections = () => {
        const m = qqMode.value;
        panel.querySelectorAll("[data-qq-section]").forEach(sec => {
          const name = sec.dataset.qqSection;
          // Cookie 区（direct）在所有模式都显示，apihz 区仅在 apihz/fallback 显示
          const show = name === "direct" ? true : (m === "fallback" || m === name);
          sec.style.display = show ? "" : "none";
        });
      };
      qqMode.addEventListener("change", applyQqSections);
      applyQqSections();
    }

    // QQ 资料：书签一键抓取 / 粘贴 Cookie 解析 / 测试连接
    const bmLink = panel.querySelector("[data-qq-bookmarklet]");
    if (bmLink) {
      const bm = "javascript:(function(){try{var c=document.cookie.split('; '),g=function(k){for(var i=0;i<c.length;i++){var p=c[i].indexOf('=');if(c[i].slice(0,p)===k)return decodeURIComponent(c[i].slice(p+1));}return ''};var u=g('p_uin').replace(/^o0*/,'');var t='QQCK#'+new URLSearchParams({ckqq:u,skey:g('skey'),pskey:g('p_skey')}).toString();navigator.clipboard.writeText(t).then(function(){alert('已复制 QQ 登录态（QQ:'+(u||'未取到')+'），回到后台粘贴即可')}).catch(function(){prompt('复制失败，请手动复制：',t)})}catch(e){alert('请先在 vip.qq.com 登录后，再点本书签')}})();";
      bmLink.setAttribute("href", bm);
      bmLink.addEventListener("click", e => e.preventDefault());
    }
    const qqFormVals = () => ({
      qq_ckqq: panel.querySelector('[name="qq_ckqq"]')?.value || "",
      qq_skey: panel.querySelector('[name="qq_skey"]')?.value || "",
      qq_pskey: panel.querySelector('[name="qq_pskey"]')?.value || "",
      qq_keepalive_interval: panel.querySelector('[name="qq_keepalive_interval"]')?.value || "6",
    });
    const parseBtn = panel.querySelector("[data-qq-parse]");
    if (parseBtn) {
      parseBtn.addEventListener("click", () => {
        const text = (panel.querySelector("[data-qq-paste]")?.value || "").trim();
        if (!text) { toast("先粘贴 Cookie"); return; }
        const out = { ckqq: "", skey: "", pskey: "" };
        const m = text.match(/QQCK#([\s\S]*)/);
        if (m) {
          try { const p = new URLSearchParams(m[1]); out.ckqq = p.get("ckqq") || ""; out.skey = p.get("skey") || ""; out.pskey = p.get("pskey") || ""; } catch {}
        } else {
          const g = k => { const mm = text.match(new RegExp("(?:^|[;\\s])" + k + "=([^;\\s]+)")); return mm ? decodeURIComponent(mm[1]) : ""; };
          out.ckqq = g("p_uin").replace(/^o0*/, "");
          out.skey = g("skey");
          out.pskey = g("p_skey");
        }
        if (!out.ckqq && !out.skey && !out.pskey) { toast("没解析到 p_uin/skey/p_skey，确认是 vip.qq.com 的 Cookie"); return; }
        if (out.ckqq) panel.querySelector('[name="qq_ckqq"]').value = out.ckqq;
        if (out.skey) panel.querySelector('[name="qq_skey"]').value = out.skey;
        if (out.pskey) panel.querySelector('[name="qq_pskey"]').value = out.pskey;
        toast(`已填入 ckqq=${out.ckqq || "?"}，记得点「保存设置」`);
      });
    }
    const testBtn = panel.querySelector("[data-qq-test]");
    if (testBtn) {
      const tmsg = panel.querySelector("[data-qq-test-msg]");
      testBtn.addEventListener("click", async () => {
        testBtn.disabled = true;
        if (tmsg) tmsg.style.color = "" , tmsg.textContent = "测试中…";
        try {
          const r = await api("/api/admin/qq/test", { method: "POST", body: qqFormVals() });
          let text = r.ok ? `✓ ${r.msg}` : `✗ ${r.msg}`;
          if (r.debug?.details) text += `\n${r.debug.details}`;
          else if (r.debug) text += `\n[${r.debug.endpoint}] HTTP ${r.debug.status}`;
          if (tmsg) { tmsg.style.color = r.ok ? "#23b26d" : "#f56c6c"; tmsg.textContent = text; tmsg.style.whiteSpace = "pre-wrap"; }
        } catch (e) {
          if (tmsg) { tmsg.style.color = "#f56c6c"; tmsg.textContent = "✗ " + e.message; }
        } finally {
          testBtn.disabled = false;
        }
      });
    }
  }

  /* ---------- 后台 Tab：媒体 ---------- */
  async function renderAdminMedia(panel) {
    panel.innerHTML = `<div class="essay-loading"><span class="spinner"></span><span>加载中...</span></div>`;
    let s;
    try {
      s = await api("/api/admin/settings");
    } catch (e) {
      panel.innerHTML = `<div class="essay-empty">${esc(e.message)}</div>`;
      return;
    }
    panel.innerHTML = `
      <div class="admin-panel-head"><h3>域名与存储</h3></div>
      <form class="settings-form" data-settings-form>
        <div class="field">
          <label>站点域名（可选）<br /><small style="color:var(--anzhiyu-secondtext)">带 https://，如 https://e.jxe.me。用于 SEO/RSS/OG 标签生成绝对 URL；留空则使用当前访问域名。换域名时填新域名即可，无需改代码</small></label>
          <input name="site_domain" maxlength="200" value="${esc(s.site_domain)}" placeholder="https://e.jxe.me（留空=自动）" />
        </div>
        <div class="field">
          <label>R2 媒体域名（可选）<br /><small style="color:var(--anzhiyu-secondtext)">R2 桶绑定的自定义域名，带 https://，如 https://r2.e.jxe.me。填写后图片/视频直连 R2，不经过 Worker（节省 Worker 请求额度）；留空则走 /media/ 代理</small></label>
          <input name="r2_domain" maxlength="200" value="${esc(s.r2_domain)}" placeholder="https://r2.e.jxe.me（留空=走 /media/ 代理）" />
        </div>
        <div class="field">
          <label>上传存储<br /><small style="color:var(--anzhiyu-secondtext)">切换不影响历史文件：R2 旧文件继续通过上方 R2 域名正常访问；选择 B2 后，<b>新上传</b>的图片/视频/头像/评论图都会存入 B2（对象自动加 b2/ 前缀）。B2 桶公开填了域名则直连访问，私有桶则自动走 Worker 代理</small></label>
          <select name="storage_mode" data-storage-mode>
            <option value="r2" ${s.storage_mode !== "b2" ? "selected" : ""}>Cloudflare R2（默认，新上传存 R2）</option>
            <option value="b2" ${s.storage_mode === "b2" ? "selected" : ""}>Backblaze B2（新上传存 B2）</option>
          </select>
        </div>
        <div data-b2-fields style="${s.storage_mode === "b2" ? "" : "display:none"};border:1px dashed var(--anzhiyu-border, #555);border-radius:10px;padding:.75rem 1rem;margin-bottom:.25rem">
          <div class="field">
            <label>B2 S3 端点<br /><small style="color:var(--anzhiyu-secondtext)">Backblaze 控制台显示的 S3 兼容端点，带 https://，如 https://s3.us-west-004.backblazeb2.com</small></label>
            <input name="b2_endpoint" maxlength="200" value="${esc(s.b2_endpoint)}" placeholder="https://s3.us-west-004.backblazeb2.com" />
          </div>
          <div class="field">
            <label>B2 桶名<br /><small style="color:var(--anzhiyu-secondtext)">存储桶名称（Bucket），需已设为公开，否则图片无法通过下方域名访问</small></label>
            <input name="b2_bucket" maxlength="100" value="${esc(s.b2_bucket)}" placeholder="my-moments-bucket" />
          </div>
          <div class="field">
            <label>Application Key ID<br /><small style="color:var(--anzhiyu-secondtext)">B2 应用密钥 ID（keyID），需具备读写权限</small></label>
            <input name="b2_key_id" maxlength="100" value="${esc(s.b2_key_id)}" placeholder="keyID" autocomplete="off" />
          </div>
          <div class="field">
            <label>Application Key<br /><small style="color:var(--anzhiyu-secondtext)">B2 应用密钥（applicationKey），只保存在服务端，公开 API 不下发</small></label>
            <input name="b2_app_key" type="password" maxlength="200" value="${esc(s.b2_app_key)}" placeholder="applicationKey" autocomplete="new-password" />
          </div>
          <div class="field">
            <label>B2 公开访问域名（私有桶留空）<br /><small style="color:var(--anzhiyu-secondtext)">桶设为公开并绑定自定义域名时填写（带 https://，如 https://b2.e.jce.me），文件直连访问、不消耗 Worker 请求；<b>私有桶留空即可</b>，文件自动走 Worker 签名代理访问（无需信用卡，B2 egress 走 Cloudflare 联盟免费）</small></label>
            <input name="b2_domain" maxlength="200" value="${esc(s.b2_domain)}" placeholder="私有桶留空" />
          </div>
          <div style="display:flex;gap:.75rem;align-items:center">
            <button type="button" class="btn" data-b2-test>测试 B2 连接</button>
            <span data-b2-test-msg style="font-size:.8rem;color:var(--anzhiyu-secondtext)"></span>
          </div>
        </div>
        <div class="field">
          <label>视频默认封面（可选）<br /><small style="color:var(--anzhiyu-secondtext)">说说和文章中的视频未单独设置封面时统一使用此图；可填图片 URL 或上传本地图片（建议 16:9 JPG）。留空则无封面视频显示播放器默认底色</small></label>
          <div style="display:flex;gap:.5rem;align-items:center">
            <input name="video_default_poster" maxlength="500" value="${esc(s.video_default_poster)}" placeholder="https://... 或 /media/...（留空不启用）" style="flex:1" />
            <button type="button" class="btn" data-video-poster-upload>上传</button>
            <input type="file" accept="image/*" data-video-poster-file hidden />
          </div>
          <div class="field-hint" data-video-poster-preview style="margin-top:.4rem">${s.video_default_poster ? `<img src="${esc(s.video_default_poster)}" alt="" style="max-width:100%;max-height:120px;border-radius:8px;object-fit:cover" referrerpolicy="no-referrer" />` : ""}</div>
        </div>
        <button class="btn primary" type="submit">保存设置</button>
      </form>

      <div class="admin-panel-head" style="margin-top:1.75rem"><h3>缩略图维护</h3></div>
      <div class="settings-form" style="max-width:680px">
        <div class="field">
          <label><small style="color:var(--anzhiyu-secondtext)">遍历全站图片，为历史图/小图/相册直传图补生成 _w1200 缩略图（缺失的图片会裂图或回退加载原图，拖慢首页）。图片多时耗时较长，建议低峰期执行一次</small></label>
          <div style="display:flex;gap:.75rem;align-items:center">
            <button type="button" class="btn" data-rebuild-thumbs>重建历史缩略图</button>
            <span data-rebuild-thumbs-msg style="font-size:.8rem;color:var(--anzhiyu-secondtext)"></span>
          </div>
        </div>
      </div>`;

    // 视频默认封面上传
    const vpUploadBtn = panel.querySelector("[data-video-poster-upload]");
    if (vpUploadBtn) {
      const vpFileInput = panel.querySelector("[data-video-poster-file]");
      const vpUrlInput = panel.querySelector('[name="video_default_poster"]');
      const vpPreview = panel.querySelector("[data-video-poster-preview]");
      vpUploadBtn.addEventListener("click", () => vpFileInput.click());
      vpFileInput.addEventListener("change", async () => {
        const file = vpFileInput.files[0];
        if (!file) return;
        vpUploadBtn.disabled = true;
        vpUploadBtn.textContent = "上传中...";
        try {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("kind", "image");
          const res = await fetch("/api/admin/upload", { method: "POST", body: fd, credentials: "same-origin" });
          const json = await res.json();
          if (!res.ok || !json.data?.src) throw new Error(json.message || "上传失败");
          const full = /^https?:\/\//i.test(json.data.src) ? json.data.src : location.origin + json.data.src;
          vpUrlInput.value = full;
          vpPreview.innerHTML = `<img src="${esc(full)}" alt="" style="max-width:100%;max-height:120px;border-radius:8px;object-fit:cover" referrerpolicy="no-referrer" />`;
          toast("上传成功，记得点击保存设置");
        } catch (err) {
          toast(err.message);
        } finally {
          vpUploadBtn.disabled = false;
          vpUploadBtn.textContent = "上传";
          vpFileInput.value = "";
        }
      });
    }

    // 存储模式下拉：切换 B2 配置区显隐
    const storageModeEl = panel.querySelector("[data-storage-mode]");
    const b2Fields = panel.querySelector("[data-b2-fields]");
    if (storageModeEl && b2Fields) {
      storageModeEl.addEventListener("change", () => {
        b2Fields.style.display = storageModeEl.value === "b2" ? "" : "none";
      });
    }
    // B2 连接测试：先用当前表单值保存，再调用测试接口（服务端读已存配置）
    const b2TestBtn = panel.querySelector("[data-b2-test]");
    if (b2TestBtn) {
      const tmsg = panel.querySelector("[data-b2-test-msg]");
      b2TestBtn.addEventListener("click", async () => {
        b2TestBtn.disabled = true;
        if (tmsg) { tmsg.style.color = ""; tmsg.textContent = "测试中…（会先保存 B2 配置）"; }
        try {
          // 先保存当前表单（保证服务端拿到最新填写的 B2 配置），再触发测试
          const fd = new FormData(panel.querySelector("[data-settings-form]"));
          const patch = {};
          ["storage_mode", "b2_endpoint", "b2_bucket", "b2_key_id", "b2_app_key", "b2_domain"].forEach(k => {
            if (fd.has(k)) patch[k] = String(fd.get(k) || "").trim();
          });
          await api("/api/admin/settings", { method: "PUT", body: patch });
          const r = await api("/api/admin/storage/test", { method: "POST", body: {} });
          if (tmsg) { tmsg.style.color = r.ok ? "#23b26d" : "#f56c6c"; tmsg.textContent = (r.ok ? "✓ " : "✗ ") + r.msg; }
          if (r.ok) toast("B2 连接正常，配置已保存");
        } catch (e) {
          if (tmsg) { tmsg.style.color = "#f56c6c"; tmsg.textContent = "✗ " + e.message; }
        } finally {
          b2TestBtn.disabled = false;
        }
      });
    }

  }

  /* ---------- 后台 Tab：音乐播放器（播放器设置 + 中央音乐服务配置） ---------- */
  async function renderAdminMusicPlayer(panel) {
    panel.innerHTML = `<div class="essay-loading"><span class="spinner"></span><span>加载中...</span></div>`;
    let s;
    try {
      s = await api("/api/admin/settings");
    } catch (e) {
      panel.innerHTML = `<div class="essay-empty">${esc(e.message)}</div>`;
      return;
    }
    const vol = Math.max(0, Math.min(1, Number(s.music_volume) || 0.7));
    panel.innerHTML = `
      <div class="admin-panel-head"><h3>音乐播放器</h3></div>
      <form class="settings-form" data-music-settings-form style="max-width:680px">
        <div class="field field-row">
          <label for="m_enable">启用底部音乐播放器</label>
          <label class="toggle">
            <input type="checkbox" name="music_enable" id="m_enable" ${s.music_enable ? "checked" : ""} />
            <span></span>
          </label>
        </div>
        <div class="field field-row">
          <label for="m_autoplay">打开网页自动播放<br /><small style="color:var(--anzhiyu-secondtext)">浏览器可能拦截有声自动播放，被拦截时自动回退为手动播放</small></label>
          <label class="toggle">
            <input type="checkbox" name="music_autoplay" id="m_autoplay" ${s.music_autoplay ? "checked" : ""} />
            <span></span>
          </label>
        </div>
        <div class="field field-row">
          <label for="m_preload">预加载第一首歌<br /><small style="color:var(--anzhiyu-secondtext)">页面打开后提前解析音源，点击播放按钮立即出声（推荐开启）</small></label>
          <label class="toggle">
            <input type="checkbox" name="music_preload" id="m_preload" ${s.music_preload ? "checked" : ""} />
            <span></span>
          </label>
        </div>
        <div class="field field-row">
          <label for="m_collapsed">初始折叠成球形<br /><small style="color:var(--anzhiyu-secondtext)">打开网页时播放器收起为悬浮球，点击展开</small></label>
          <label class="toggle">
            <input type="checkbox" name="music_collapsed" id="m_collapsed" ${s.music_collapsed ? "checked" : ""} />
            <span></span>
          </label>
        </div>
        <div class="field">
          <label for="m_volume">初始音量：<output data-vol-out>${Math.round(vol * 100)}%</output></label>
          <input type="range" name="music_volume" id="m_volume" min="0" max="1" step="0.05" value="${vol}" data-vol-range style="width:100%" />
        </div>
        <div class="field">
          <label>自定义歌单 JSON 链接（可选，优先级高于网易云歌单）</label>
          <input name="music_custom_playlist" maxlength="500" value="${esc(s.music_custom_playlist)}" placeholder="https://.../playlist.json" />
          <div class="field-hint">JSON 格式：<code>[{"name":"歌名","artist":"歌手","url":"音频直链","cover":"封面URL"}]</code><br />填入 <code>/api/music/playlist.json</code> 播放全部启用曲目；<code>/api/music/playlist.json?tag=标签名</code> 播放指定标签的歌单。</div>
        </div>
        <details class="admin-fold">
          <summary class="admin-fold-summary">高级：网易云在线歌单（备用）</summary>
          <div class="admin-fold-body">
            <div class="field">
              <label>网易云歌单 ID（纯数字，如 8152976493）</label>
              <input name="music_playlist_id" maxlength="32" value="${esc(s.music_playlist_id)}" placeholder="8152976493" autocomplete="off" />
              <div class="field-hint">仅当上方自定义歌单链接为空或拉取失败时，作为兜底直接在线解析该网易云歌单播放（不经过中央音乐库）。</div>
            </div>
          </div>
        </details>
        <button class="btn primary" type="submit">保存音乐设置</button>
      </form>

      <div class="admin-panel-head" style="margin-top:1.75rem"><h3>中央音乐服务</h3></div>
      <form class="settings-form" data-music-api-form style="max-width:680px">
        <div class="field">
          <label>服务地址（music-api Worker）</label>
          <input name="music_api_url" maxlength="200" value="${esc(s.music_api_url || "")}" placeholder="https://music-api.xxx.workers.dev" />
        </div>
        <div class="field">
          <label>ApiKey（在中央服务后台「授权」页生成）</label>
          <input name="music_api_key" maxlength="64" value="${esc(s.music_api_key || "")}" placeholder="mk_..." autocomplete="off" data-lpignore="true" data-1p-ignore="true" />
          <div class="field-hint">搜歌、试听、入库、曲库管理均由中央服务执行，本站不落地存储；服务地址留空时音乐库功能不可用。</div>
        </div>
        <button class="btn primary" type="submit">保存服务配置</button>
      </form>`;

    // 音量滑块实时显示
    const range = panel.querySelector("[data-vol-range]");
    const out = panel.querySelector("[data-vol-out]");
    if (range && out) {
      range.addEventListener("input", () => {
        out.textContent = Math.round(Number(range.value) * 100) + "%";
      });
    }
  }

  /* ---------- 后台 Tab：音乐曲库 ---------- */
  async function renderAdminMusicLibrary(panel) {
    panel.innerHTML = `
      <div class="admin-panel-head"><h3>音乐曲库</h3></div>
      <p style="color:var(--anzhiyu-secondtext);font-size:.82rem;margin:-.4rem 0 1rem">文章中插入的音乐（<code>[music=tN]</code>）托管在中央音乐服务，停用后前台显示「音乐不可用」，删除会同时移除音频和封面文件。</p>
      <div data-music-library><div class="emp-help"><span class="spinner"></span> 加载中…</div></div>`;

    // 站内音乐库列表
    const libBox = panel.querySelector("[data-music-library]");
    if (libBox) {
      const SRC_LABEL = { netease: "网易云", qq: "QQ", kugou: "酷狗", kuwo: "酷我", qishui: "汽水", upload: "上传", url: "外链" };
      let libList = [];
      let tagFilter = "";

      const tagsOf = t => (Array.isArray(t.tags) && t.tags.length ? t.tags : t.tag ? [t.tag] : []);
      const rowHtml = t => `
          <div class="mlib-item${t.enabled ? "" : " is-off"}">
            <input type="checkbox" class="mlib-check" data-mlib-check="${esc(t.id)}" title="选择" />
            ${t.cover_url ? `<img class="mlib-cover" src="${esc(t.cover_url)}" alt="" loading="lazy" referrerpolicy="no-referrer" />` : `<span class="mlib-cover">${svgIcon("music", 18)}</span>`}
            <div class="mlib-info">
              <div class="mlib-name"><span class="mlib-title">${esc(t.title)}</span>${t.vip ? '<span class="emp-vip">VIP</span>' : ""}<span class="emp-src">${SRC_LABEL[t.source] || esc(t.source)}</span>${tagsOf(t).map(x => `<span class="mlib-tag">${esc(x)}</span>`).join("")}${!t.has_cover || !t.has_lyric ? `<span class="mlib-miss">缺${[!t.has_cover ? "封面" : "", !t.has_lyric ? "歌词" : ""].filter(Boolean).join("/")}</span>` : ""}</div>
              <div class="mlib-artist">${esc(t.artist)}${t.album ? " · " + esc(t.album) : ""} · ${esc(t.id)}</div>
            </div>
            ${!t.has_cover || !t.has_lyric ? `<button type="button" class="btn sm" data-mlib-fill="${esc(t.id)}">补全</button>` : ""}
            <button type="button" class="btn sm ghost" data-mlib-lyric="${esc(t.id)}" title="手动编辑歌词（LRC 格式）">歌词</button>
            <label class="toggle" title="${t.enabled ? "停用" : "启用"}"><input type="checkbox" data-mlib-toggle="${esc(t.id)}" ${t.enabled ? "checked" : ""} /><span></span></label>
            <button type="button" class="btn sm ghost" data-mlib-del="${esc(t.id)}">删除</button>
          </div>`;

      let libPage = 1;
      const PAGE_SIZE = 20;

      const renderRows = () => {
        const rowsBox = libBox.querySelector("[data-mlib-rows]");
        const pagerBox = libBox.querySelector("[data-mlib-pager]");
        if (!rowsBox) return;
        const shown = tagFilter ? libList.filter(t => tagsOf(t).includes(tagFilter)) : libList;
        const totalPages = Math.ceil(shown.length / PAGE_SIZE);
        if (libPage > totalPages) libPage = Math.max(1, totalPages);
        const start = (libPage - 1) * PAGE_SIZE;
        const pageItems = shown.slice(start, start + PAGE_SIZE);
        rowsBox.innerHTML = pageItems.length
          ? pageItems.map(rowHtml).join("")
          : `<div class="emp-help">该标签下暂无曲目。</div>`;
        if (pagerBox) {
          pagerBox.innerHTML = totalPages > 1
            ? `<button class="btn sm ghost" data-mlib-page="prev" ${libPage <= 1 ? "disabled" : ""}>‹ 上一页</button>
               <span class="ops-hint" style="margin:0 .5rem">${libPage} / ${totalPages}</span>
               <button class="btn sm ghost" data-mlib-page="next" ${libPage >= totalPages ? "disabled" : ""}>下一页 ›</button>`
            : "";
        }
      };

      const loadLibrary = async () => {
        try {
          const data = await api("/api/music/library");
          libList = data.list || [];
          if (!libList.length) {
            libBox.innerHTML = `<div class="emp-help">曲库还是空的。在文章/说说编辑器点「插入音乐」即可搜歌入库、上传本地音乐或转存网络音频。</div>`;
            return;
          }
          const tags = [...new Set(libList.flatMap(tagsOf))];
          const missing = libList.filter(t => !t.has_cover || !t.has_lyric).length;
          libBox.innerHTML = `
          <div class="mlib-bar">
            <label class="mlib-all"><input type="checkbox" data-mlib-all /> 全选</label>
            <input type="text" data-mlib-tag-input placeholder="标签名，如：最爱" maxlength="30" />
            <button type="button" class="btn sm" data-mlib-tag-set>加入标签</button>
            <button type="button" class="btn sm ghost" data-mlib-tag-clear>清除全部标签</button>
            <select data-mlib-tag-filter><option value="">全部标签</option>${tags.map(t => `<option value="${esc(t)}"${t === tagFilter ? " selected" : ""}>${esc(t)}</option>`).join("")}</select>
            <button type="button" class="btn sm" data-mlib-fill-all>一键补全${missing ? `（缺 ${missing} 首）` : ""}</button>
          </div>
          <div class="mlib-list" data-mlib-rows></div>
          <div class="mlib-pager" data-mlib-pager style="display:flex;align-items:center;justify-content:center;margin-top:.8rem;gap:.5rem"></div>
          <div class="emp-help" style="margin-top:.6rem">歌单链接：<code>/api/music/playlist.json</code> = 全部启用曲目；<code>/api/music/playlist.json?tag=最爱</code> = 指定标签的歌单，填入上方「自定义歌单 JSON 链接」即可。</div>`;
          renderRows();
        } catch (e) {
          libBox.innerHTML = `<div class="emp-help">${esc(e.message || "加载失败")}</div>`;
        }
      };

      const checkedIds = () => [...libBox.querySelectorAll("[data-mlib-check]:checked")].map(cb => cb.dataset.mlibCheck);
      const fillMsg = d => {
        const okParts = [d.cover === "ok" ? "封面" : "", d.lyric === "ok" ? "歌词" : ""].filter(Boolean);
        const failParts = [d.cover === "fail" ? "封面" : "", d.lyric === "fail" ? "歌词" : ""].filter(Boolean);
        if (!okParts.length && !failParts.length) return "封面和歌词都已存在";
        return [okParts.length ? okParts.join("、") + "已补" : "", failParts.length ? failParts.join("、") + "补全失败" : ""].filter(Boolean).join("，");
      };

      libBox.addEventListener("change", async e => {
        const cb = e.target.closest("[data-mlib-toggle]");
        if (cb) {
          try {
            await api("/api/music/library/toggle", { body: { id: cb.dataset.mlibToggle, enabled: cb.checked } });
            toast(cb.checked ? "已启用" : "已停用");
            cb.closest(".mlib-item").classList.toggle("is-off", !cb.checked);
            const t = libList.find(x => x.id === cb.dataset.mlibToggle);
            if (t) t.enabled = cb.checked;
          } catch (err) {
            toast(err.message || "操作失败");
            cb.checked = !cb.checked;
          }
          return;
        }
        const all = e.target.closest("[data-mlib-all]");
        if (all) {
          libBox.querySelectorAll("[data-mlib-check]").forEach(c => (c.checked = all.checked));
          return;
        }
        const filter = e.target.closest("[data-mlib-tag-filter]");
        if (filter) {
          tagFilter = filter.value;
          renderRows();
        }
      });

      libBox.addEventListener("click", async e => {
        const pageBtn = e.target.closest("[data-mlib-page]");
        if (pageBtn) {
          if (pageBtn.dataset.mlibPage === "prev") libPage--;
          else libPage++;
          renderRows();
          return;
        }
        const del = e.target.closest("[data-mlib-del]");
        if (del) {
          if (!confirm("删除后音频和封面文件会一并移除，确定删除？")) return;
          del.disabled = true;
          try {
            await api("/api/music/library/delete", { body: { id: del.dataset.mlibDel } });
            toast("已删除");
            loadLibrary();
          } catch (err) {
            del.disabled = false;
            toast(err.message || "删除失败");
          }
          return;
        }
        const fill = e.target.closest("[data-mlib-fill]");
        if (fill) {
          fill.disabled = true;
          fill.textContent = "补全中…";
          try {
            const d = await api("/api/music/library/fill", { body: { id: fill.dataset.mlibFill } });
            toast(fillMsg(d || {}));
            loadLibrary();
          } catch (err) {
            fill.disabled = false;
            fill.textContent = "补全";
            toast(err.message || "补全失败");
          }
          return;
        }
        // 手动编辑歌词：行内展开 LRC 文本框
        const lyr = e.target.closest("[data-mlib-lyric]");
        if (lyr) {
          const item = lyr.closest(".mlib-item");
          const opened = item.nextElementSibling;
          if (opened && opened.classList.contains("mlib-lyric-editor")) {
            opened.remove();
            return;
          }
          lyr.disabled = true;
          try {
            const d = await api(`/api/music/track?id=${encodeURIComponent(lyr.dataset.mlibLyric)}`);
            const editor = document.createElement("div");
            editor.className = "mlib-lyric-editor";
            editor.innerHTML = `
              <textarea rows="8" placeholder="粘贴 LRC 歌词原文，如 [00:01.00]第一句…；留空保存即清除歌词">${esc(d.lyric || "")}</textarea>
              <div class="mlib-lyric-actions">
                <button type="button" class="btn sm primary" data-lyric-save>保存</button>
                <button type="button" class="btn sm ghost" data-lyric-cancel>取消</button>
              </div>`;
            item.after(editor);
            editor.querySelector("[data-lyric-cancel]").addEventListener("click", () => editor.remove());
            editor.querySelector("[data-lyric-save]").addEventListener("click", async ev => {
              const btn = ev.currentTarget;
              btn.disabled = true;
              try {
                const lyricVal = editor.querySelector("textarea").value;
                await api("/api/music/library/edit", { body: { id: lyr.dataset.mlibLyric, lyric: lyricVal } });
                toast(lyricVal.trim() ? "歌词已保存" : "歌词已清除");
                loadLibrary();
              } catch (err) {
                btn.disabled = false;
                toast(err.message || "保存失败");
              }
            });
          } catch (err) {
            toast(err.message || "歌词加载失败");
          } finally {
            lyr.disabled = false;
          }
          return;
        }
        const tagSet = e.target.closest("[data-mlib-tag-set]");
        if (tagSet) {
          const ids = checkedIds();
          const tag = libBox.querySelector("[data-mlib-tag-input]").value.trim();
          if (!ids.length) return toast("请先勾选曲目");
          if (!tag) return toast("请输入标签名");
          tagSet.disabled = true;
          try {
            await api("/api/music/library/tag", { body: { ids, tag } });
            toast(`已把 ${ids.length} 首加入「${tag}」`);
            loadLibrary();
          } catch (err) {
            tagSet.disabled = false;
            toast(err.message || "设置失败");
          }
          return;
        }
        const tagClear = e.target.closest("[data-mlib-tag-clear]");
        if (tagClear) {
          const ids = checkedIds();
          if (!ids.length) return toast("请先勾选曲目");
          tagClear.disabled = true;
          try {
            await api("/api/music/library/tag", { body: { ids, tag: "" } });
            toast(`已清除 ${ids.length} 首的全部标签`);
            loadLibrary();
          } catch (err) {
            tagClear.disabled = false;
            toast(err.message || "操作失败");
          }
          return;
        }
        const fillAll = e.target.closest("[data-mlib-fill-all]");
        if (fillAll) {
          const targets = libList.filter(t => !t.has_cover || !t.has_lyric);
          if (!targets.length) return toast("没有缺封面或歌词的曲目");
          if (!confirm(`将逐首补全 ${targets.length} 首曲目的封面/歌词，需要逐个请求上游接口，继续？`)) return;
          fillAll.disabled = true;
          let done = 0;
          for (let i = 0; i < targets.length; i++) {
            fillAll.textContent = `补全中 ${i + 1}/${targets.length}…`;
            try {
              const d = await api("/api/music/library/fill", { body: { id: targets[i].id } });
              if (d && (d.cover === "ok" || d.lyric === "ok")) done++;
            } catch {
              // 单首失败不影响整体
            }
          }
          toast(`补全完成：${done}/${targets.length} 首有更新`);
          loadLibrary();
        }
      });
      loadLibrary();
    }
  }

  /* ---------- 后台 Tab：AI 助手 ---------- */
  async function renderAdminAI(panel) {
    panel.innerHTML = `<div class="essay-loading"><span class="spinner"></span><span>加载中...</span></div>`;
    let s;
    try {
      s = await api("/api/admin/settings");
    } catch (e) {
      panel.innerHTML = `<div class="essay-empty">${esc(e.message)}</div>`;
      return;
    }
    panel.innerHTML = `
      <div class="admin-panel-head"><h3>评论 @AI 机器人</h3></div>
      <form class="settings-form" data-ai-settings-form style="max-width:680px">
        <div class="field field-row">
          <label for="ai_reply_enabled">启用评论 @AI 机器人<br /><small style="color:var(--anzhiyu-secondtext)">访客在说说/文章评论中 @机器人昵称 时，由 Cloudflare Workers AI 自动生成回复（消耗每日免费额度），回复以楼中楼形式出现</small></label>
          <label class="toggle">
            <input type="checkbox" name="ai_reply_enabled" id="ai_reply_enabled" ${s.ai_reply_enabled ? "checked" : ""} />
            <span></span>
          </label>
        </div>
        <div class="field">
          <label>机器人昵称<br /><small style="color:var(--anzhiyu-secondtext)">评论中 @此昵称 触发回复，建议 2-6 个字符（如 小J、阿沐）</small></label>
          <input name="ai_bot_name" maxlength="20" value="${esc(s.ai_bot_name)}" placeholder="小J" />
        </div>
        <div class="field">
          <label>机器人头像<br /><small style="color:var(--anzhiyu-secondtext)">仅图片 URL；留空显示默认机器人图标</small></label>
          <input name="ai_bot_avatar" maxlength="200" value="${esc(s.ai_bot_avatar)}" placeholder="https://...（留空=默认图标）" />
        </div>
        <div class="field">
          <label>文本模型 ID（高级，可选）<br /><small style="color:var(--anzhiyu-secondtext)">默认使用 Cloudflare 托管免费模型 Qwen3（失败自动回退 Llama 3.2）；如确认其他 @cf/* 模型可用可在此覆盖</small></label>
          <input name="ai_text_model" maxlength="100" value="${esc(s.ai_text_model)}" placeholder="@cf/qwen/qwen3-30b-a3b-fp8（留空=默认）" />
        </div>
        <button class="btn primary" type="submit">保存 AI 设置</button>
      </form>`;
  }

  /* ---------- 后台 Tab：搜索收录 ---------- */
  async function renderAdminSeo(panel) {
    setSeo({ title: `搜索收录 · ${state.settings.site_title}`, path: location.pathname, noindex: true });
    const origin = location.origin.replace(/\/$/, "");
    const site = (state.settings.site_domain || origin).replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const enc = encodeURIComponent(site);
    let cfg = {};
    try { cfg = await api("/api/admin/settings"); } catch { /* 未登录则用空对象 */ }
    const defEndpoints = "https://api.indexnow.org/indexnow\nhttps://www.bing.com/indexnow";
    const items = [
      { label: "站点地图 sitemap.xml", url: `${origin}/sitemap.xml`, tip: "提交给搜索引擎，列出所有可收录页面" },
      { label: "爬虫规则 robots.txt", url: `${origin}/robots.txt`, tip: "声明允许/禁止抓取的路径与 sitemap 位置" },
      { label: "RSS 订阅 rss.xml", url: `${origin}/rss.xml`, tip: "文章更新源，也可用于订阅与部分平台抓取" },
    ];
    panel.innerHTML = `
      <div class="admin-panel-head"><h3>搜索收录</h3></div>
      <p style="color:var(--anzhiyu-secondtext);font-size:.82rem;margin:-.4rem 0 1rem">把本站地址提交到各搜索引擎站长平台，加快收录。先复制下方 sitemap 地址，再点对应平台按钮去提交。</p>

      <div style="display:flex;flex-direction:column;gap:.7rem;margin-bottom:1.4rem">
        ${items.map(it => `
          <div style="display:flex;align-items:center;gap:.7rem;background:var(--anzhiyu-card-bg);border:var(--style-border);border-radius:12px;padding:.75rem 1rem">
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:.9rem">${esc(it.label)}</div>
              <div style="font-size:.78rem;color:var(--anzhiyu-secondtext);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(it.url)}</div>
              <div style="font-size:.72rem;color:var(--anzhiyu-secondtext);opacity:.8">${esc(it.tip)}</div>
            </div>
            <button class="btn sm ghost" data-copy="${esc(it.url)}">复制</button>
            <a class="btn sm ghost" href="${esc(it.url)}" target="_blank" rel="noopener">打开</a>
          </div>`).join("")}
      </div>

      <div style="font-weight:700;font-size:.92rem;margin:1.2rem 0 .7rem">站长平台快捷入口</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:.8rem">
        <a class="btn" href="https://ziyuan.baidu.com/linksubmit/index" target="_blank" rel="noopener" style="justify-content:center">百度搜索资源平台</a>
        <a class="btn" href="https://www.bing.com/webmasters?siteUrl=${enc}" target="_blank" rel="noopener" style="justify-content:center">Bing Webmaster</a>
        <a class="btn" href="https://search.google.com/search-console?resource_id=${encodeURIComponent("sc-domain:" + site)}" target="_blank" rel="noopener" style="justify-content:center">Google Search Console</a>
        <a class="btn ghost" href="https://www.bing.com/indexnow" target="_blank" rel="noopener" style="justify-content:center">了解 IndexNow 自动推送</a>
      </div>
      <p style="color:var(--anzhiyu-secondtext);margin-top:1rem;font-size:.78rem">提示：各平台需先验证站点归属（按平台指引添加 TXT 或上传文件），验证后即可提交 sitemap 并查看收录情况。</p>

      <div class="admin-panel-head" style="margin-top:1.8rem"><h3>IndexNow 自动推送</h3></div>
      <p style="color:var(--anzhiyu-secondtext);font-size:.82rem;margin:-.4rem 0 1rem">填写后，发布/更新已发布文章会自动通知搜索引擎重抓。先去 <a href="https://www.bing.com/indexnow" target="_blank" rel="noopener" style="color:var(--anzhiyu-main)">Bing IndexNow</a> 生成一个 key，填到下方保存即可（key 会通过站点的 <code>/indexnow-key.txt</code> 对外暴露，用于归属验证）。</p>
      <form class="settings-form" data-indexnow-form style="max-width:640px;display:flex;flex-direction:column;gap:.75rem">
        <div class="field">
          <label>IndexNow Key</label>
          <input name="indexnow_key" value="${esc(cfg.indexnow_key || "")}" placeholder="粘贴 Bing 生成的 key" maxlength="128" autocomplete="off" data-lpignore="true" data-1p-ignore="true" />
          <small style="color:var(--anzhiyu-secondtext)">保存后可访问 <a href="${origin}/indexnow-key.txt" target="_blank" rel="noopener" style="color:var(--anzhiyu-main)">${origin}/indexnow-key.txt</a> 验证是否返回该 key。</small>
        </div>
        <div class="field">
          <label>推送端点（每行一个，留空恢复默认）</label>
          <textarea name="indexnow_endpoints" rows="4" placeholder="${esc(defEndpoints)}">${esc(cfg.indexnow_endpoints || defEndpoints)}</textarea>
        </div>
        <label class="switch-row">
          <span class="toggle"><input type="checkbox" name="indexnow_auto" ${cfg.indexnow_auto !== false ? "checked" : ""} /><span></span></span>
          发布/更新已发布文章时自动推送 IndexNow
        </label>
        <div style="display:flex;gap:.6rem;align-items:center;flex-wrap:wrap">
          <button class="btn primary" type="submit">保存配置</button>
          <span data-indexnow-msg style="font-size:.82rem;color:var(--anzhiyu-secondtext)"></span>
        </div>
      </form>

      <div style="margin-top:1.4rem;display:flex;gap:.6rem;align-items:center;flex-wrap:wrap">
        <button class="btn" type="button" data-indexnow-push>推送最近 10 篇</button>
        <input type="number" min="1" max="50" value="10" data-indexnow-n style="width:90px" aria-label="推送篇数" />
        <span data-indexnow-push-msg style="font-size:.82rem;color:var(--anzhiyu-secondtext)"></span>
      </div>

      <div class="admin-panel-head" style="margin-top:1.8rem"><h3>百度收录推送</h3></div>
      <p style="color:var(--anzhiyu-secondtext);font-size:.82rem;margin:-.4rem 0 1rem">百度不支持 IndexNow，用其独立的「普通收录」API。需先在 <a href="https://ziyuan.baidu.com/linksubmit/index" target="_blank" rel="noopener" style="color:var(--anzhiyu-main)">百度搜索资源平台</a> 添加站点并拿到「推送接口调用地址」里的 site 与 token。</p>
      <form class="settings-form" data-baidu-form style="max-width:640px;display:flex;flex-direction:column;gap:.75rem">
        <label class="switch-row">
          <span class="toggle"><input type="checkbox" name="baidu_push_enabled" ${cfg.baidu_push_enabled ? "checked" : ""} /><span></span></span>
          启用百度自动推送（发布/更新已发布文章时推送）
        </label>
        <div class="field">
          <label>站点 site（如 jxe.me，不带 http）</label>
          <input name="baidu_push_site" value="${esc(cfg.baidu_push_site || "")}" placeholder="jxe.me" maxlength="100" />
        </div>
        <div class="field">
          <label>推送 token</label>
          <input name="baidu_push_token" value="${esc(cfg.baidu_push_token || "")}" placeholder="百度平台给出的 token" maxlength="64" autocomplete="off" data-lpignore="true" data-1p-ignore="true" />
        </div>
        <div style="display:flex;gap:.6rem;align-items:center;flex-wrap:wrap">
          <button class="btn primary" type="submit">保存配置</button>
          <span data-baidu-msg style="font-size:.82rem;color:var(--anzhiyu-secondtext)"></span>
        </div>
      </form>
      <div style="margin-top:1rem;display:flex;gap:.6rem;align-items:center;flex-wrap:wrap">
        <button class="btn" type="button" data-baidu-push>推送最近 10 篇到百度</button>
        <input type="number" min="1" max="50" value="10" data-baidu-n style="width:90px" aria-label="推送篇数" />
        <span data-baidu-push-msg style="font-size:.82rem;color:var(--anzhiyu-secondtext)"></span>
      </div>

      <details class="indexnow-log" style="margin-top:1.6rem">
        <summary style="cursor:pointer;font-weight:700;font-size:.92rem">最近推送记录（点击展开）</summary>
        <div data-indexnow-log style="margin-top:.8rem;display:flex;flex-direction:column;gap:.4rem"></div>
      </details>`;
    panel.querySelectorAll("[data-copy]").forEach(btn => btn.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(btn.dataset.copy); toast("已复制：" + btn.dataset.copy); }
      catch { toast("复制失败，请手动复制", 1); }
    }));

    // 保存 IndexNow 配置
    const inForm = panel.querySelector("[data-indexnow-form]");
    inForm?.addEventListener("submit", async e => {
      e.preventDefault();
      const msg = panel.querySelector("[data-indexnow-msg]");
      const fd = new FormData(inForm);
      const patch = {
        indexnow_key: String(fd.get("indexnow_key") || "").trim(),
        indexnow_endpoints: String(fd.get("indexnow_endpoints") || "").trim(),
        indexnow_auto: inForm.querySelector("[name=indexnow_auto]").checked,
      };
      try {
        await api("/api/admin/settings", { method: "PUT", body: patch });
        msg.textContent = "已保存 ✓";
        setTimeout(() => { msg.textContent = ""; }, 2000);
      } catch (err) { msg.textContent = err.message || "保存失败"; }
    });

    // 手动推送最近 N 篇
    const loadLog = async () => {
      const box = panel.querySelector("[data-indexnow-log]");
      if (!box) return;
      try {
        const d = await api("/api/admin/indexnow/log");
        const list = d.list || [];
        if (!list.length) { box.innerHTML = `<div style="color:var(--anzhiyu-secondtext);font-size:.8rem;padding:.5rem 0">暂无推送记录</div>`; return; }
        box.innerHTML = list.map(r => `<div class="indexnow-log-row">
          <span class="dot ${r.status === "ok" ? "ok" : "fail"}"></span>
          <span class="in-url">${esc(r.url)}</span>
          <span class="in-ep">${esc(r.endpoint.replace(/^https?:\/\//, "").split("/")[0])}</span>
          <span class="in-time">${esc((r.created_at || "").replace("T", " ").slice(0, 19))}</span>
        </div>`).join("");
      } catch { box.innerHTML = `<div style="color:var(--anzhiyu-secondtext);font-size:.8rem">记录加载失败</div>`; }
    };
    const logDetails = panel.querySelector("details.indexnow-log");
    logDetails?.addEventListener("toggle", () => { if (logDetails.open) loadLog(); });
    panel.querySelector("[data-indexnow-push]")?.addEventListener("click", async () => {
      const n = Number(panel.querySelector("[data-indexnow-n]").value) || 10;
      const msg = panel.querySelector("[data-indexnow-push-msg]");
      msg.textContent = "推送中…";
      try {
        const d = await api("/api/admin/indexnow/push", { method: "POST", body: { n } });
        msg.textContent = `✓ 推送 ${d.pushed} 篇，${d.ok}/${d.total} 端点成功`;
        loadLog();
      } catch (err) { msg.textContent = err.message || "推送失败"; }
    });

    // 保存百度配置
    const bdForm = panel.querySelector("[data-baidu-form]");
    bdForm?.addEventListener("submit", async e => {
      e.preventDefault();
      const msg = panel.querySelector("[data-baidu-msg]");
      const fd = new FormData(bdForm);
      const patch = {
        baidu_push_enabled: bdForm.querySelector("[name=baidu_push_enabled]").checked,
        baidu_push_site: String(fd.get("baidu_push_site") || "").trim(),
        baidu_push_token: String(fd.get("baidu_push_token") || "").trim(),
      };
      try {
        await api("/api/admin/settings", { method: "PUT", body: patch });
        msg.textContent = "已保存 ✓";
        setTimeout(() => { msg.textContent = ""; }, 2000);
      } catch (err) { msg.textContent = err.message || "保存失败"; }
    });
    panel.querySelector("[data-baidu-push]")?.addEventListener("click", async () => {
      const n = Number(panel.querySelector("[data-baidu-n]").value) || 10;
      const msg = panel.querySelector("[data-baidu-push-msg]");
      msg.textContent = "推送中…";
      try {
        const d = await api("/api/admin/baidu/push", { method: "POST", body: { n } });
        msg.textContent = d.ok ? `✓ ${d.message}` : `✗ ${d.message}`;
        loadLog();
      } catch (err) { msg.textContent = err.message || "推送失败"; }
    });
  }

  /* ---------- 后台 Tab：安全 ---------- */
  async function renderAdminSecurity(panel) {
    panel.innerHTML = `<div class="essay-loading"><span class="spinner"></span><span>加载中...</span></div>`;
    let s;
    try {
      s = await api("/api/admin/settings");
    } catch (e) {
      panel.innerHTML = `<div class="essay-empty">${esc(e.message)}</div>`;
      return;
    }

    const shortTime = t => {
      if (!t) return "-";
      const d = new Date(t);
      if (Number.isNaN(d.getTime())) return "-";
      const p = n => String(n).padStart(2, "0");
      return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
    };
    const escA = v => esc(String(v ?? ""));
    const levelLabel = l => (l === "high" ? "高危" : l === "medium" ? "中危" : "低危");
    const secTable = (head, rows, emptyText) => {
      if (!rows.length) return `<div class="essay-empty">${emptyText || "暂无数据"}</div>`;
      return `<div class="sec-table-wrap"><table class="sec-table"><thead><tr>${head
        .map(h => `<th>${h}</th>`)
        .join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
    };

    panel.innerHTML = `
      <div class="admin-panel-head"><h3>消息推送</h3></div>
      <form class="settings-form" data-notify-form style="max-width:700px;margin-bottom:1.6rem">
        <div class="field">
          <label>Webhook 地址（飞书 / 钉钉 / 企业微信机器人，留空=全部不推送）</label>
          <input name="security_webhook_url" maxlength="500" value="${escA(s.security_webhook_url)}" placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/xxx" style="font-family:monospace" />
        </div>
        <div class="notify-toggles">
          <label class="switch-row">
            <span class="toggle"><input type="checkbox" name="notify_security" ${s.notify_security !== false ? "checked" : ""} /><span></span></span>
            <span><b>安全告警</b><small>攻击拦截、自动封禁</small></span>
          </label>
          <label class="switch-row">
            <span class="toggle"><input type="checkbox" name="notify_comment" ${s.notify_comment !== false ? "checked" : ""} /><span></span></span>
            <span><b>新评论</b><small>文章 / 说说有新评论时</small></span>
          </label>
          <label class="switch-row">
            <span class="toggle"><input type="checkbox" name="notify_system" ${s.notify_system !== false ? "checked" : ""} /><span></span></span>
            <span><b>系统事件</b><small>宕机检测、QQ Cookie 失效</small></span>
          </label>
        </div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:.6rem">
          <button class="btn primary" type="submit">保存推送设置</button>
          <button class="btn" type="button" data-test-alert>发送测试</button>
          <span data-notify-msg style="font-size:.85rem;color:var(--anzhiyu-secondtext)"></span>
        </div>
      </form>

      <div class="sec-summary" data-sec-summary>
        ${[0, 1, 2, 3].map(() => `<div class="sec-card"><div class="sec-num">-</div><div class="sec-label">…</div></div>`).join("")}
      </div>

      <div class="admin-panel-head"><h3>安全设置</h3></div>
      <form class="settings-form" data-security-form style="max-width:700px">
        <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-end">
          <div class="field" style="flex:1;min-width:150px">
            <label>封禁阈值（同 IP 10 分钟命中高危次数）</label>
            <input name="ban_threshold" type="number" min="1" max="100" value="${escA(s.ban_threshold || "5")}" />
          </div>
          <div class="field" style="flex:1;min-width:150px">
            <label>封禁时长（小时）</label>
            <input name="ban_duration_hours" type="number" min="1" max="720" value="${escA(s.ban_duration_hours || "24")}" />
          </div>
          <label class="switch-row" style="margin-bottom:.7rem">
            <span class="toggle"><input type="checkbox" name="auto_ban_enabled" ${s.auto_ban_enabled ? "checked" : ""} /><span></span></span>
            启用自动封禁
          </label>
        </div>
        <div class="field" style="margin-top:.4rem;max-width:280px">
          <label>评论防刷（同 IP 每分钟评论上限，默认 5）</label>
          <input name="comment_rate_limit" type="number" min="1" max="100" value="${escA(s.comment_rate_limit || "5")}" />
        </div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:.6rem">
          <button class="btn primary" type="submit">保存安全设置</button>
          <span data-security-msg style="font-size:.85rem;color:var(--anzhiyu-secondtext)"></span>
        </div>
      </form>

      <div class="admin-panel-head"><h3>攻击日志（最近 100 条）</h3></div>
      <div class="sec-toolbar">
        <select data-attack-level>
          <option value="">全部等级</option>
          <option value="high">高危</option>
          <option value="medium">中危</option>
          <option value="low">低危</option>
        </select>
        <input data-attack-ip placeholder="按 IP 筛选" style="max-width:180px;font-family:monospace" />
        <button class="btn" data-attack-filter>筛选</button>
        <button class="btn" data-attack-refresh>刷新</button>
      </div>
      <div data-attack-list class="sec-block">加载中...</div>

      <div class="admin-panel-head"><h3>封禁 IP 管理</h3></div>
      <form data-ban-form class="sec-ban-form">
        <input name="ip" placeholder="IP 地址" required style="font-family:monospace" />
        <input name="reason" placeholder="原因（可选）" />
        <input name="hours" type="number" min="1" max="720" value="24" style="width:80px" title="封禁时长（小时）" />
        <button class="btn primary" type="submit">封禁</button>
        <span data-ban-msg style="font-size:.85rem;color:var(--anzhiyu-secondtext)"></span>
      </form>
      <div data-blocked-list class="sec-block">加载中...</div>

      <div class="admin-panel-head"><h3>规则命中统计（最近 24 小时）</h3></div>
      <div data-rules-list class="sec-block">加载中...</div>

      <div class="admin-panel-head"><h3>错误日志（最近 50 条）</h3></div>
      <div data-errors-list class="sec-block">加载中...</div>

      <div class="admin-panel-head" style="margin-top:1.75rem"><h3>后台入口路径</h3></div>
      <form class="settings-form" data-adminpath-form style="max-width:560px">
        <div class="field">
          <label>后台入口路径<br />
            <small style="color:var(--anzhiyu-secondtext)">修改后旧地址 /admin 立即失效（访客访问显示 404），请牢记新地址，建议收藏。格式：/ 开头 + 3~39 位字母数字或短横线，如 /my-secret</small>
          </label>
          <div style="display:flex;gap:8px">
            <input name="admin_path" maxlength="40" value="${escA(s.admin_path || "/admin")}" pattern="/admin|/[A-Za-z0-9][A-Za-z0-9-]{2,38}" required style="flex:1;font-family:monospace" />
            <button type="button" class="btn" data-gen-path style="white-space:nowrap">随机生成</button>
          </div>
          <div class="field-hint" style="margin-top:.5rem;color:#e6a23c">
            ${svgIcon("triangle-alert", 14)} 修改后浏览器地址会立即跳转到新入口；连续输错 5 次密码将锁定 15 分钟。
          </div>
          <div data-adminpath-msg style="margin-top:.4rem;font-size:.85rem"></div>
        </div>
        <button class="btn primary" type="submit">更新入口路径</button>
      </form>

      <div class="admin-panel-head" style="margin-top:1.75rem"><h3>修改管理密码</h3></div>
      <form class="settings-form" data-password-form style="max-width:420px">
        <div class="field">
          <label>当前密码</label>
          <input type="password" name="old_password" autocomplete="current-password" required />
        </div>
        <div class="field">
          <label>新密码（6-128 位）</label>
          <input type="password" name="new_password" autocomplete="new-password" minlength="6" maxlength="128" required />
        </div>
        <div class="field">
          <label>确认新密码</label>
          <input type="password" name="confirm_password" autocomplete="new-password" minlength="6" maxlength="128" required />
        </div>
        <button class="btn primary" type="submit">修改密码</button>
        <div class="field-hint" style="margin-top:.5rem">修改后立即生效，无需重新部署；其他已登录设备需要用新密码重新解锁。</div>
      </form>`;

    /* ---------- 数据加载 ---------- */
    const loadAttacks = async () => {
      const box = panel.querySelector("[data-attack-list]");
      if (!box) return;
      box.innerHTML = `<div class="essay-loading"><span class="spinner"></span><span>加载中...</span></div>`;
      try {
        const level = panel.querySelector("[data-attack-level]")?.value || "";
        const ip = panel.querySelector("[data-attack-ip]")?.value.trim() || "";
        const qs = new URLSearchParams();
        if (level) qs.set("level", level);
        if (ip) qs.set("ip", ip);
        const data = await api(`/api/admin/security/attacks?${qs.toString()}`);
        box.innerHTML = secTable(
          ["时间", "IP", "等级", "规则", "路径", "UA"],
          data.list.map(a => `<tr>
            <td class="sec-time">${shortTime(a.created_at)}</td>
            <td><code>${escA(a.ip || "-")}</code>${a.country ? `<span class="sec-country">${escA(a.country)}</span>` : ""}</td>
            <td><span class="sec-badge ${escA(a.level)}">${levelLabel(a.level)}</span></td>
            <td><span class="sec-badge rule">${escA(a.rule || "-")}</span></td>
            <td class="sec-path" title="${escA(a.path)}">${escA(a.path || "-")}</td>
            <td class="sec-ua" title="${escA(a.ua)}">${escA((a.ua || "-").slice(0, 40))}</td>
          </tr>`),
          "暂无攻击记录"
        );
      } catch (e) {
        box.innerHTML = `<div class="essay-empty">${esc(e.message)}</div>`;
      }
    };

    const loadAll = async () => {
      try {
        const [summary, blocked, rules, errors] = await Promise.all([
          api("/api/admin/security/summary"),
          api("/api/admin/security/blocked"),
          api("/api/admin/security/rules"),
          api("/api/admin/security/errors"),
        ]);
        const cards = [
          [summary.threats24h, "24h 威胁"],
          [summary.banned24h, "24h 封禁"],
          [summary.activeBans, "封禁中 IP"],
          [summary.totalHits, "累计命中"],
        ];
        panel.querySelector("[data-sec-summary]").innerHTML = cards
          .map(([n, label]) => `<div class="sec-card"><div class="sec-num">${n}</div><div class="sec-label">${label}</div></div>`)
          .join("");

        panel.querySelector("[data-blocked-list]").innerHTML = secTable(
          ["IP", "原因", "封禁时间", "到期时间", "操作"],
          blocked.list.map(b => `<tr>
            <td><code>${escA(b.ip)}</code></td>
            <td>${escA(b.reason || "-")}</td>
            <td class="sec-time">${shortTime(b.blocked_at)}</td>
            <td class="sec-time">${shortTime(b.expires_at)}</td>
            <td><button class="btn danger small" data-unban-btn="${escA(b.ip)}">解封</button></td>
          </tr>`),
          "暂无封禁 IP"
        );

        panel.querySelector("[data-rules-list]").innerHTML = secTable(
          ["规则", "等级", "命中数"],
          rules.list.map(r => `<tr>
            <td><span class="sec-badge rule">${escA(r.rule)}</span></td>
            <td><span class="sec-badge ${escA(r.level)}">${levelLabel(r.level)}</span></td>
            <td>${r.n}</td>
          </tr>`),
          "暂无规则命中"
        );

        panel.querySelector("[data-errors-list]").innerHTML = secTable(
          ["时间", "方法", "路径", "错误信息"],
          errors.list.map(e => `<tr>
            <td class="sec-time">${shortTime(e.created_at)}</td>
            <td>${escA(e.method || "-")}</td>
            <td class="sec-path" title="${escA(e.path)}">${escA(e.path || "-")}</td>
            <td class="sec-msg" title="${escA(e.message)}">${escA((e.message || "").slice(0, 80))}</td>
          </tr>`),
          "暂无错误日志"
        );

        // 解封按钮
        panel.querySelectorAll("[data-unban-btn]").forEach(btn => {
          btn.addEventListener("click", async () => {
            btn.disabled = true;
            try {
              await api("/api/admin/security/unban", { method: "POST", body: { ip: btn.dataset.unbanBtn } });
              toast("已解封");
              await loadAll();
            } catch (e) {
              toast(e.message);
              btn.disabled = false;
            }
          });
        });
      } catch (e) {
        panel.querySelector("[data-attack-list]").innerHTML = `<div class="essay-empty">${esc(e.message)}</div>`;
      }
    };

    await loadAll();
    await loadAttacks();

    /* ---------- 消息推送表单 ---------- */
    const notifyForm = panel.querySelector("[data-notify-form]");
    const notifyMsg = panel.querySelector("[data-notify-msg]");
    const saveNotify = async () => {
      const updated = await api("/api/admin/settings", {
        method: "PUT",
        body: {
          security_webhook_url: notifyForm.security_webhook_url.value.trim(),
          notify_security: notifyForm.notify_security.checked,
          notify_comment: notifyForm.notify_comment.checked,
          notify_system: notifyForm.notify_system.checked,
        },
      });
      state.settings = { ...state.settings, ...updated };
      return updated;
    };
    notifyForm.addEventListener("submit", async e => {
      e.preventDefault();
      const btn = notifyForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        await saveNotify();
        if (notifyMsg) { notifyMsg.style.color = "#23b26d"; notifyMsg.textContent = "✓ 已保存"; }
        toast("推送设置已保存");
      } catch (err) {
        if (notifyMsg) { notifyMsg.style.color = "#f56c6c"; notifyMsg.textContent = "✗ " + err.message; }
      } finally {
        btn.disabled = false;
      }
    });

    const testBtn = panel.querySelector("[data-test-alert]");
    testBtn.addEventListener("click", async () => {
      testBtn.disabled = true;
      if (notifyMsg) { notifyMsg.style.color = ""; notifyMsg.textContent = "保存并推送中…"; }
      try {
        await saveNotify(); // 先保存，保证测试的是当前填写的地址
        await api("/api/admin/security/test-alert", { method: "POST" });
        if (notifyMsg) { notifyMsg.style.color = "#23b26d"; notifyMsg.textContent = "✓ 已推送，请检查机器人"; }
      } catch (e) {
        if (notifyMsg) { notifyMsg.style.color = "#f56c6c"; notifyMsg.textContent = "✗ " + e.message; }
      } finally {
        testBtn.disabled = false;
      }
    });

    /* ---------- 安全设置表单 ---------- */
    const secForm = panel.querySelector("[data-security-form]");
    const secMsg = panel.querySelector("[data-security-msg]");
    secForm.addEventListener("submit", async e => {
      e.preventDefault();
      const btn = secForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        const patch = {
          auto_ban_enabled: secForm.auto_ban_enabled.checked,
          ban_threshold: secForm.ban_threshold.value,
          ban_duration_hours: secForm.ban_duration_hours.value,
          comment_rate_limit: secForm.comment_rate_limit.value,
        };
        const updated = await api("/api/admin/settings", { method: "PUT", body: patch });
        if (typeof updated.auto_ban_enabled === "boolean") {
          secForm.auto_ban_enabled.checked = updated.auto_ban_enabled;
        }
        if (updated.comment_rate_limit) secForm.comment_rate_limit.value = updated.comment_rate_limit;
        if (secMsg) { secMsg.style.color = "#23b26d"; secMsg.textContent = "✓ 已保存"; }
        toast("安全设置已保存");
      } catch (err) {
        if (secMsg) { secMsg.style.color = "#f56c6c"; secMsg.textContent = "✗ " + err.message; }
      } finally {
        btn.disabled = false;
      }
    });

    /* ---------- 攻击日志筛选 ---------- */
    panel.querySelector("[data-attack-filter]").addEventListener("click", loadAttacks);
    panel.querySelector("[data-attack-refresh]").addEventListener("click", () => { loadAttacks(); loadAll(); });

    /* ---------- 手动封禁 ---------- */
    const banForm = panel.querySelector("[data-ban-form]");
    const banMsg = panel.querySelector("[data-ban-msg]");
    banForm.addEventListener("submit", async e => {
      e.preventDefault();
      const btn = banForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      if (banMsg) banMsg.textContent = "";
      try {
        await api("/api/admin/security/ban", {
          method: "POST",
          body: { ip: banForm.ip.value.trim(), reason: banForm.reason.value.trim(), hours: banForm.hours.value },
        });
        banForm.reset();
        banForm.hours.value = "24";
        toast("已封禁");
        await loadAll();
      } catch (err) {
        if (banMsg) { banMsg.style.color = "#f56c6c"; banMsg.textContent = "✗ " + err.message; }
      } finally {
        btn.disabled = false;
      }
    });
  }

  /* ================= 后台 Tab：运维 ================= */
  async function renderAdminOps(panel) {
    panel.innerHTML = `<div class="essay-loading"><span class="spinner"></span><span>加载中...</span></div>`;

    let u, p;
    try {
      [u, p] = await Promise.all([
        api("/api/admin/ops/uptime/summary"),
        api("/api/admin/ops/perf/summary"),
      ]);
    } catch (e) {
      panel.innerHTML = `<div class="essay-empty">运维数据加载失败：${esc(e.message)}</div>`;
      return;
    }

    const u24 = u.day24 || {};
    const wk = u.week || {};
    const pstats = p.stats || {};
    const escA = v => esc(String(v ?? ""));

    const rateColor = r => (r >= 99 ? "#23b26d" : r >= 90 ? "#e6a23c" : "#f56c6c");
    const fmtMs = v => (Number(v) >= 1000 ? (Number(v) / 1000).toFixed(1) + "s" : Number(v) + "ms");

    panel.innerHTML = `
      <div class="ops-grid">
        <div class="ov-chart-card">
          <div class="ov-chart-head">
            <h3>可用性监控</h3>
            <button class="btn ghost sm" data-ops-refresh>${svgIcon("refresh-cw", 14)} 刷新</button>
          </div>
          <div class="ops-interval-row">
            <span class="ops-hint">检测间隔</span>
            <input type="number" min="1" max="720" value="${escA(u.interval || "5")}" style="width:86px" data-uptime-interval />
            <span class="ops-hint">分钟</span>
            <button class="btn ghost sm" data-uptime-save>保存</button>
            <span class="ops-hint" data-uptime-msg style="flex:0">Cron 每分钟触发，按此间隔执行检测</span>
          </div>
          <div class="ov-cards">
            <div class="ov-card"><div class="ov-card-ico" style="color:${rateColor(u24.rate)}">${svgIcon("heart-pulse", 26)}</div>
              <div class="ov-card-num" style="color:${rateColor(u24.rate)}">${u24.rate}%</div>
              <div class="ov-card-label">24h 可用率（${u24.ok}/${u24.total}）</div></div>
            <div class="ov-card"><div class="ov-card-ico">${svgIcon("timer", 26)}</div>
              <div class="ov-card-num">${fmtMs(u24.avgLatency)}</div>
              <div class="ov-card-label">平均响应</div></div>
            <div class="ov-card"><div class="ov-card-ico" style="color:${rateColor(wk.rate)}">${svgIcon("calendar-check", 26)}</div>
              <div class="ov-card-num" style="color:${rateColor(wk.rate)}">${wk.rate}%</div>
              <div class="ov-card-label">7 天可用率</div></div>
            <div class="ov-card"><div class="ov-card-ico">${svgIcon("activity", 26)}</div>
              <div class="ov-card-num">${u24.total}</div>
              <div class="ov-card-label">24h 检测次数</div></div>
          </div>
          ${
            (u.daily || []).length
              ? `<div class="ops-daily">
                  ${(u.daily || []).map(d => `
                    <div class="ops-day" title="${d.day} 可用率 ${d.rate}%（${d.total} 次）">
                      <em style="color:${rateColor(d.rate)}">${d.rate}%</em>
                      <div class="ops-bar"><i style="height:${Math.max(4, Math.min(100, d.rate))}%;background:${rateColor(d.rate)}"></i></div>
                      <span>${d.day.slice(5)}</span>
                    </div>`).join("")}
                </div>`
              : `<div class="essay-empty" style="padding:1rem">暂无检测数据，等待首次 Cron 执行…</div>`
          }
          <div class="ops-table-wrap">
            <table class="ops-table">
              <thead><tr><th>时间</th><th>状态</th><th>耗时</th><th>说明</th></tr></thead>
              <tbody>
                ${(u.recent || []).slice(0, 8).map(r => `
                  <tr>
                    <td class="ops-td-time">${fmtDT(r.created_at)}</td>
                    <td><span class="ops-pill ${r.status >= 200 && r.status < 400 ? "ok" : "bad"}">${r.status || "超时"}</span></td>
                    <td>${fmtMs(r.latency_ms)}</td>
                    <td class="ops-td-err" title="${escA(r.error)}">${escA(r.error || r.url).slice(0, 40) || "正常"}</td>
                  </tr>`).join("") || `<tr><td colspan="4" class="essay-empty">暂无记录</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>

        <div class="ov-chart-card">
          <div class="ov-chart-head">
            <h3>性能监控</h3>
            <span class="ov-chart-sub">≥300ms 必记，其余 10% 采样</span>
          </div>
          <div class="ov-cards">
            <div class="ov-card"><div class="ov-card-ico">${svgIcon("bar-chart-3", 26)}</div>
              <div class="ov-card-num">${pstats.total}</div>
              <div class="ov-card-label">24h 样本数</div></div>
            <div class="ov-card"><div class="ov-card-ico">${svgIcon("zap", 26)}</div>
              <div class="ov-card-num">${fmtMs(pstats.avgMs)}</div>
              <div class="ov-card-label">平均耗时</div></div>
            <div class="ov-card"><div class="ov-card-ico" style="color:${pstats.slowCount ? "#f56c6c" : "#23b26d"}">${svgIcon("alert-triangle", 26)}</div>
              <div class="ov-card-num" style="color:${pstats.slowCount ? "#f56c6c" : "#23b26d"}">${pstats.slowCount}</div>
              <div class="ov-card-label">慢请求（≥500ms）</div></div>
            <div class="ov-card"><div class="ov-card-ico">${svgIcon("timer", 26)}</div>
              <div class="ov-card-num">${fmtMs(pstats.maxMs)}</div>
              <div class="ov-card-label">最大耗时</div></div>
          </div>
          <h4 class="ops-subhead">最慢接口 TOP</h4>
          <div class="ops-table-wrap">
            <table class="ops-table">
              <thead><tr><th>接口</th><th>次数</th><th>平均</th><th>最大</th></tr></thead>
              <tbody>
                ${(p.topPaths || []).slice(0, 8).map(t => `
                  <tr>
                    <td class="ops-td-path" title="${escA(t.path)}">${escA(t.path)}</td>
                    <td>${t.total}</td>
                    <td>${fmtMs(t.avgMs)}</td>
                    <td>${fmtMs(t.maxMs)}</td>
                  </tr>`).join("") || `<tr><td colspan="4" class="essay-empty">暂无数据</td></tr>`}
              </tbody>
            </table>
          </div>
          <h4 class="ops-subhead">最近慢请求</h4>
          <div class="ops-table-wrap">
            <table class="ops-table">
              <thead><tr><th>时间</th><th>方法</th><th>接口</th><th>耗时</th></tr></thead>
              <tbody>
                ${(p.recent || []).filter(r => r.duration_ms >= 300).slice(0, 6).map(r => `
                  <tr>
                    <td class="ops-td-time">${fmtDT(r.created_at)}</td>
                    <td><span class="ops-method">${escA(r.method)}</span></td>
                    <td class="ops-td-path" title="${escA(r.path)}">${escA(r.path)}</td>
                    <td style="color:${r.duration_ms >= 1000 ? "#f56c6c" : "#e6a23c"}">${fmtMs(r.duration_ms)}</td>
                  </tr>`).join("") || `<tr><td colspan="4" class="essay-empty">暂无慢请求</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="ov-chart-card">
        <div class="ov-chart-head">
          <h3>D1 数据备份</h3>
          <span class="ov-chart-sub">导出全库 JSON（每个表最多 ${10000} 行，覆盖常规业务数据）</span>
        </div>
        <div class="ops-backup-row">
          <button class="btn primary" data-backup-export>${svgIcon("download", 16)} 导出全库备份</button>
          <span class="ops-hint">导出内容含全部文章、说说、评论、友链、相册、统计与日志数据，请妥善保存。大表（访问统计/攻击日志）仅保留最近 1 万条。</span>
        </div>
        <h4 class="ops-subhead" style="margin-top:1rem">数据恢复（危险操作）</h4>
        <div class="ops-backup-row">
          <button class="btn" data-backup-pick>${svgIcon("upload", 16)} 选择备份文件</button>
          <input type="file" accept="application/json,.json" data-backup-file hidden />
          <span class="ops-hint" data-restore-summary>选择之前导出的 JSON 备份，勾选要恢复的表，将「清空并覆盖」该表当前数据</span>
        </div>
        <div class="ops-restore-tables" data-restore-tables style="display:none;margin-top:.6rem"></div>
        <div class="ops-backup-row" style="margin-top:.6rem">
          <button class="btn danger" data-restore-run disabled>${svgIcon("rotate-ccw", 16)} 恢复所选表</button>
          <span class="ops-hint" data-restore-msg></span>
        </div>
      </div>

      <div class="ov-chart-card">
        <div class="ov-chart-head">
          <h3>SEO 死链检测</h3>
          <span class="ov-chart-sub">扫描文章 / 说说 / 友链中的外链并检测可访问性</span>
        </div>
        <div class="ops-link-row">
          <button class="btn" data-link-extract>${svgIcon("search", 16)} 提取外链</button>
          <button class="btn primary" data-link-check disabled>${svgIcon("radio", 16)} 开始检测</button>
          <span class="ops-hint" data-link-summary>尚未提取链接</span>
        </div>
        <div class="ops-link-progress" data-link-progress style="display:none">
          <div class="ops-progress-track"><div class="ops-progress-bar" data-link-bar style="width:0"></div></div>
          <span data-link-pct>0%</span>
        </div>
        <div class="ops-table-wrap" style="margin-top:.6rem">
          <table class="ops-table">
            <thead><tr><th>链接</th><th>状态</th><th>耗时</th><th>说明</th></tr></thead>
            <tbody data-link-tbody>
              <tr><td colspan="4" class="essay-empty">点击「提取外链」扫描站内所有外链</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    /* ---------- 可用性/性能刷新 ---------- */
    const refreshBtn = panel.querySelector("[data-ops-refresh]");
    refreshBtn.addEventListener("click", () => renderAdminOps(panel));

    /* ---------- 备份导出 ---------- */
    panel.querySelector("[data-backup-export]").addEventListener("click", () => {
      const w = window.open("/api/admin/ops/backup/export", "_blank");
      if (!w) location.href = "/api/admin/ops/backup/export";
    });

    /* ---------- 可用性检测间隔设置 ---------- */
    const intervalInput = panel.querySelector("[data-uptime-interval]");
    const intervalMsg = panel.querySelector("[data-uptime-msg]");
    panel.querySelector("[data-uptime-save]").addEventListener("click", async () => {
      const val = Math.max(1, Math.min(720, parseInt(intervalInput.value, 10) || 5));
      intervalInput.value = val;
      intervalMsg.textContent = "保存中…";
      try {
        await api("/api/admin/settings", { method: "PUT", body: { uptime_check_interval: String(val) } });
        intervalMsg.textContent = "✓ 已保存（Cron 每分钟触发，按此间隔执行检测）";
        toast("可用性检测间隔已更新");
      } catch (e) {
        intervalMsg.textContent = "✗ " + e.message;
      }
    });

    /* ---------- 数据恢复（按表覆盖） ---------- */
    const pickBtn = panel.querySelector("[data-backup-pick]");
    const fileInput = panel.querySelector("[data-backup-file]");
    const restoreSummary = panel.querySelector("[data-restore-summary]");
    const restoreTablesEl = panel.querySelector("[data-restore-tables]");
    const restoreRun = panel.querySelector("[data-restore-run]");
    const restoreMsg = panel.querySelector("[data-restore-msg]");
    let backupData = null; // { exported_at, tables: { [name]: rows[] } }

    pickBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
      const f = fileInput.files[0];
      if (!f) return;
      try {
        backupData = JSON.parse(await f.text());
        const tables = backupData && typeof backupData.tables === "object" ? backupData.tables : null;
        if (!tables) throw new Error("备份文件格式不正确（缺少 tables）");
        const names = Object.keys(tables).filter(n => Array.isArray(tables[n]));
        if (!names.length) throw new Error("备份文件中没有可恢复的表");
        restoreTablesEl.innerHTML = names
          .map(n => `
            <label class="ops-restore-row">
              <input type="checkbox" value="${escA(n)}" checked />
              <span class="ops-restore-name">${escA(n)}</span>
              <span class="ops-restore-count">${tables[n].length} 行</span>
            </label>`)
          .join("");
        restoreTablesEl.style.display = "grid";
        restoreRun.disabled = false;
        restoreSummary.textContent = `已加载备份（${backupData.exported_at || ""}），共 ${names.length} 个表，勾选后点击恢复`;
        restoreMsg.textContent = "";
      } catch (e) {
        restoreSummary.textContent = "读取失败：" + e.message;
      } finally {
        fileInput.value = "";
      }
    });

    restoreRun.addEventListener("click", async () => {
      if (!backupData) return;
      const rowsEls = Array.from(restoreTablesEl.querySelectorAll("input:checked"));
      if (!rowsEls.length) return restoreMsg.textContent = "请至少勾选一个表";
      const tables = rowsEls.map(el => el.value);
      if (!confirm(`确定恢复 ${tables.join("、")} 吗？\n\n该操作会【清空并覆盖】这些表的当前数据，且不可撤销！请确认备份文件正确后再继续。`)) return;
      restoreRun.disabled = true;
      restoreMsg.style.color = "";
      let okCount = 0, failCount = 0;
      try {
        for (const name of tables) {
          const rows = backupData.tables[name] || [];
          restoreMsg.textContent = `正在恢复 ${name}（${rows.length} 行）…`;
          try {
            const r = await api("/api/admin/ops/backup/restore", { method: "POST", body: { table: name, rows } });
            okCount++;
            restoreMsg.textContent = `${name} 已恢复 ${r.data.inserted} 行`;
          } catch (e) {
            failCount++;
            restoreMsg.textContent = `${name} 恢复失败：${e.message}`;
          }
        }
        restoreMsg.style.color = failCount ? "#f56c6c" : "#23b26d";
        restoreMsg.textContent = failCount
          ? `完成：成功 ${okCount} 个表，失败 ${failCount} 个（请刷新页面检查）`
          : `✓ 全部恢复完成（${okCount} 个表）`;
        toast(failCount ? "部分表恢复失败" : "数据恢复完成");
      } finally {
        restoreRun.disabled = false;
      }
    });

    /* ---------- 死链检测 ---------- */
    const scan = { links: [], results: [], running: false, checked: 0 };
    const tbody = panel.querySelector("[data-link-tbody]");
    const extractBtn = panel.querySelector("[data-link-extract]");
    const checkBtn = panel.querySelector("[data-link-check]");
    const summaryEl = panel.querySelector("[data-link-summary]");
    const progressWrap = panel.querySelector("[data-link-progress]");
    const progressBar = panel.querySelector("[data-link-bar]");
    const progressPct = panel.querySelector("[data-link-pct]");

    const renderScan = () => {
      const rows = scan.results.map(r => `
        <tr>
          <td class="ops-td-path" title="${escA(r.url)}"><a href="${escA(r.url)}" target="_blank" rel="noopener nofollow">${escA(r.url.length > 60 ? r.url.slice(0, 60) + "…" : r.url)}</a></td>
          <td><span class="ops-pill ${r.ok ? "ok" : "bad"}">${r.status || "ERR"}</span></td>
          <td>${fmtMs(r.latency)}</td>
          <td class="ops-td-err" title="${escA(r.error)}">${escA(r.ok ? "正常" : (r.error || "无法访问")).slice(0, 60)}</td>
        </tr>`).join("");
      tbody.innerHTML = rows || `<tr><td colspan="4" class="essay-empty">暂无链接</td></tr>`;
      const done = scan.results.length;
      const dead = scan.results.filter(r => !r.ok).length;
      summaryEl.textContent = scan.links.length
        ? `共 ${scan.links.length} 个链接，已检测 ${done} 个，异常 ${dead} 个`
        : "尚未提取链接";
    };

    extractBtn.addEventListener("click", async () => {
      extractBtn.disabled = true;
      const origText = extractBtn.innerHTML;
      extractBtn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px"></span> 提取中…';
      try {
        const d = await api("/api/admin/ops/seo/extract-links", { method: "POST" });
        scan.links = d.list || [];
        scan.results = [];
        scan.checked = 0;
        checkBtn.disabled = !scan.links.length;
        summaryEl.textContent = `提取到 ${scan.links.length} 个外链（已排除站内域名），点击「开始检测」分批检查`;
        renderScan();
      } catch (e) {
        summaryEl.textContent = "提取失败：" + e.message;
      } finally {
        extractBtn.disabled = false;
        extractBtn.innerHTML = origText;
      }
    });

    checkBtn.addEventListener("click", async () => {
      if (scan.running) return;
      scan.running = true;
      checkBtn.disabled = true;
      extractBtn.disabled = true;
      progressWrap.style.display = "flex";
      const total = scan.links.length;
      const batchSize = 20;
      try {
        for (let i = 0; i < total; i += batchSize) {
          const batch = scan.links.slice(i, i + batchSize);
          const d = await api("/api/admin/ops/seo/check-links", { method: "POST", body: { links: batch } });
          scan.results = scan.results.concat(d.list || []);
          scan.checked = scan.results.length;
          const pct = Math.round((scan.results.length / total) * 100);
          progressBar.style.width = pct + "%";
          progressPct.textContent = pct + "%";
          renderScan();
        }
        toast("死链检测完成");
      } catch (e) {
        summaryEl.textContent = "检测中断：" + e.message;
      } finally {
        scan.running = false;
        checkBtn.disabled = !scan.links.length;
        extractBtn.disabled = false;
        progressWrap.style.display = "none";
      }
    });

    renderScan();
  }

  const MUSIC_CACHE_KEY = "moments-playlist-cache";
  const MUSIC_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 天

  const musicEl = document.getElementById("musicPlayer");
  const audio = document.getElementById("musicAudio");
  const musicCapsule = document.getElementById("musicCapsule");
  const musicCover = document.getElementById("musicCover");
  const musicTitle = document.getElementById("musicTitle");
  const musicArtist = document.getElementById("musicArtist");
  const musicPlayBtn = document.getElementById("musicPlayBtn");
  const musicProgressBar = document.getElementById("musicProgressBar");
  const musicProgress = document.getElementById("musicProgress");
  const musicVolume = document.getElementById("musicVolume");
  const musicPlaylist = document.getElementById("musicPlaylist");
  const musicPlaylistList = document.getElementById("musicPlaylistList");
  const musicLyric = document.getElementById("musicLyric");
  const musicCoverOverlay = document.getElementById("musicCoverOverlay");

  // 歌词状态
  const lyricState = { lines: [], currentIndex: -1, songId: "" };

  audio.volume = state.music.volume;

  function showMusicPlayer(show) {
    musicEl.hidden = !show;
    document.body.classList.toggle("music-visible", show);
  }

  function setMusicPlayIcon(kind) {
    musicPlayBtn.querySelector(".icon-play").style.display = kind === "play" ? "" : "none";
    musicPlayBtn.querySelector(".icon-pause").style.display = kind === "pause" ? "" : "none";
    musicPlayBtn.querySelector(".icon-loading").style.display = kind === "loading" ? "" : "none";
  }

  function renderMusicPlaylist() {
    if (!state.music.playlist.length) {
      musicPlaylistList.innerHTML = `<div class="music-playlist-item" style="justify-content:center;color:var(--anzhiyu-secondtext)">${t("music.playlist_empty")}</div>`;
      return;
    }
    musicPlaylistList.innerHTML = state.music.playlist
      .map(
        (s, i) => `
      <div class="music-playlist-item ${i === state.music.currentIndex ? "active" : ""} ${i === state.music.currentIndex && state.music.isPlaying ? "playing" : ""}" data-music-idx="${i}">
        <span class="idx">${i === state.music.currentIndex ? "▶" : i + 1}</span>
        <div class="info">
          <div class="name">${esc(s.name)}</div>
          <div class="artist">${esc(s.artist)}</div>
        </div>
        <span class="playing-ind"><span></span><span></span><span></span></span>
      </div>`
      )
      .join("");
  }

  function toggleMusicPlaylist() {
    const hidden = musicPlaylist.hidden;
    musicPlaylist.hidden = !hidden;
    if (hidden) renderMusicPlaylist();
  }

  /** 从缓存或后端获取歌单 */
  async function fetchMusicPlaylist() {
    const playlistId = state.settings.music_playlist_id;
    const customUrl = state.settings.music_custom_playlist;
    const cacheKey = `${MUSIC_CACHE_KEY}:${playlistId}:${customUrl}`;

    // 读缓存（自定义歌单可能随曲库变动频繁更新，只缓存 3 分钟；网易云歌单缓存 7 天）
    const cacheTtl = customUrl && customUrl.trim() ? 3 * 60 * 1000 : MUSIC_CACHE_TTL;
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
      if (cached && Date.now() - cached.ts < cacheTtl && Array.isArray(cached.songs) && cached.songs.length) {
        return cached.songs;
      }
    } catch {
      /* ignore */
    }

    // 自定义 JSON 歌单
    if (customUrl && customUrl.trim()) {
      try {
        const res = await fetch(customUrl);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const songs = data.map((it, i) => ({
              id: String(it.id || `custom-${i}`),
              name: it.name || it.title || t("music.song_n", { n: i + 1 }),
              artist: it.artist || t("music.unknown_artist"),
              url: it.url || "",
              pic: it.cover || it.pic || "",
              lrc: it.lrc || "",
            }));
            localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), songs }));
            return songs;
          }
        }
      } catch {
        // 降级到网易云
      }
    }

    // 网易云歌单
    try {
      const data = await api(`/api/music/163/playlist?id=${encodeURIComponent(playlistId)}`);
      const songs = (data.songs || []).map(s => ({
        id: String(s.id),
        name: s.name || t("music.unknown_song"),
        artist: s.artist || t("music.unknown_artist"),
        pic: s.pic ? ensureHttps(s.pic) : "",
        url: "",
        lrc: "",
      }));
      if (songs.length) {
        localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), songs }));
      }
      return songs;
    } catch (e) {
      console.error("[music] 歌单获取失败", e);
      return [];
    }
  }

  function ensureHttps(url) {
    if (!url) return url;
    if (url.startsWith("http://")) return url.replace("http://", "https://");
    return url;
  }

  /** 把网易云封面 URL 转成 Worker 代理地址，绕过防盗链 */
  function proxyCover(url) {
    if (!url) return url;
    if (/\.music\.126\.net\//.test(url)) {
      return `/api/music/163/cover?url=${encodeURIComponent(url)}`;
    }
    return ensureHttps(url);
  }

  /** 设置封面：空 pic 清空 src，加载失败时由 error 事件兜底显示占位图
   *  目标 URL 与当前相同则跳过赋值，避免重复请求/中止进行中的加载 */
  function setCover(pic) {
    musicCover.removeAttribute("data-fallback");
    if (pic) {
      const next = proxyCover(pic);
      if (musicCover.getAttribute("src") === next) return;
      musicCover.src = next;
    } else {
      musicCover.removeAttribute("src");
    }
  }

  /** 加载并播放指定索引的歌曲
   *  - 修复封面：空 pic 不设 src，避免请求当前页 URL
   *  - 修复卡住：连续 3 首无音源停止自动跳转
   *  - 加载歌词：网易云 ID 走 /api/music/163/lyric 代理
   */
  let consecutiveFailCount = 0;
  async function loadAndPlay(index) {
    if (index < 0 || index >= state.music.playlist.length) return;
    const song = state.music.playlist[index];
    // 同一首歌的音源已由预加载缓冲好：直接播放，
    // 不重复解析、不重赋 audio.src（避免进行中的 stream 请求被中止 net::ERR_ABORTED）
    if (
      song &&
      String(audio.dataset.songId || "") === String(song.id) &&
      audio.src &&
      audio.readyState >= 2
    ) {
      state.music.currentIndex = index;
      musicTitle.textContent = song.name;
      musicArtist.textContent = song.artist;
      setCover(song.pic);
      try {
        await audio.play();
        markPlaying();
      } catch (_) {
        state.music.isPlaying = false;
        setMusicPlayIcon("play");
        updateCoverOverlay();
        renderMusicPlaylist();
      }
      return;
    }
    preloadToken++; // 作废进行中的预加载，防止迟到的预加载覆盖新音源
    state.music.currentIndex = index;

    musicTitle.textContent = song.name;
    musicArtist.textContent = song.artist;
    setCover(song.pic);
    setMusicPlayIcon("loading");
    state.music.isLoading = true;
    renderMusicPlaylist();
    loadLyric(song); // 异步加载歌词，不阻塞播放

    try {
      // 解析播放地址（网易云 ID）
      let audioUrl = song.url || "";
      if (!audioUrl && /^\d+$/.test(song.id)) {
        try {
          const res = await api(`/api/music/163?id=${song.id}`);
          audioUrl = res.url || "";
          // 仅在歌单未带封面时采用解析结果的封面：
          // 同一张图网易云可能返回 p1/p2 不同 CDN 域名，无条件覆盖会导致
          // 进行中的 cover 请求被中止（net::ERR_ABORTED）
          if (res.cover && !song.pic) {
            song.pic = ensureHttps(res.cover);
            setCover(song.pic);
          }
        } catch {
          // 解析失败，可能 VIP 歌曲
        }
      }

      if (!audioUrl) {
        consecutiveFailCount++;
        if (consecutiveFailCount >= 3) {
          consecutiveFailCount = 0;
          state.music.isLoading = false;
          setMusicPlayIcon("play");
          toast(t("music.no_source_stop"));
          return;
        }
        toast(t("music.no_source_next", { name: song.name }));
        nextSong();
        return;
      }
      consecutiveFailCount = 0; // 拿到音源，重置计数

      audio.src = audioUrl;
      audio.dataset.songId = String(song.id);
      audio.play().then(() => {
        state.music.isPlaying = true;
        state.music.isLoading = false;
        musicCapsule.classList.add("playing");
        setMusicPlayIcon("pause");
        updateCoverOverlay();
        renderMusicPlaylist();
      }).catch(err => {
        console.warn("[music] 自动播放被阻止", err);
        state.music.isPlaying = false;
        state.music.isLoading = false;
        setMusicPlayIcon("play");
        updateCoverOverlay();
        renderMusicPlaylist();
      });
    } catch (e) {
      console.error("[music] 加载歌曲失败", e);
      state.music.isLoading = false;
      setMusicPlayIcon("play");
      toast(t("music.load_failed"));
    }
  }

  /** LRC 解析：返回 [{time: 秒, text: 歌词}] 按时间升序 */
  function parseLrc(lrcStr) {
    if (!lrcStr) return [];
    const lines = lrcStr.split(/\r?\n/);
    const out = [];
    const tagRe = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
    for (const raw of lines) {
      const text = raw.replace(tagRe, "").trim();
      if (!text) continue;
      tagRe.lastIndex = 0;
      let m;
      while ((m = tagRe.exec(raw)) !== null) {
        const mm = Number(m[1]);
        const ss = Number(m[2]);
        const ff = m[3] ? Number(m[3]) : 0;
        const ms = m[3] && m[3].length === 3 ? ff : ff * 10; // 三位是毫秒，两位是百分秒
        const time = mm * 60 + ss + ms / 1000;
        out.push({ time, text });
      }
    }
    out.sort((a, b) => a.time - b.time);
    return out;
  }

  /** 加载歌词：网易云 ID 走后端代理；自定义歌单直接用 song.lrc */
  async function loadLyric(song) {
    lyricState.lines = [];
    lyricState.currentIndex = -1;
    lyricState.songId = String(song.id);
    let lrcStr = song.lrc || "";
    if (!lrcStr && /^\d+$/.test(song.id)) {
      try {
        const res = await api(`/api/music/163/lyric?id=${encodeURIComponent(song.id)}`);
        lrcStr = res.lyric || "";
        if (lrcStr) song.lrc = lrcStr; // 缓存到 song 对象，避免重复请求
      } catch {
        // 歌词获取失败不影响播放
      }
    }
    lyricState.lines = parseLrc(lrcStr);
    renderLyric();
  }

  /** 渲染歌词面板 */
  function renderLyric() {
    if (!musicLyric) return;
    if (!lyricState.lines.length) {
      musicLyric.innerHTML = `<div class="music-lyric-empty">${t("music.no_lyric")}</div>`;
      return;
    }
    musicLyric.innerHTML = lyricState.lines
      .map((l, i) => `<div class="music-lyric-line" data-lyric-idx="${i}">${esc(l.text)}</div>`)
      .join("");
  }

  /** 时间更新时高亮当前歌词并滚动 */
  function updateLyricIndex() {
    if (!lyricState.lines.length || !musicLyric) return;
    const t = audio.currentTime;
    let idx = -1;
    for (let i = 0; i < lyricState.lines.length; i++) {
      if (lyricState.lines[i].time <= t) idx = i;
      else break;
    }
    if (idx === lyricState.currentIndex) return;
    lyricState.currentIndex = idx;
    musicLyric.querySelectorAll(".music-lyric-line").forEach(el => {
      el.classList.toggle("active", Number(el.dataset.lyricIdx) === idx);
    });
    const active = musicLyric.querySelector(".music-lyric-line.active");
    if (active) {
      // 滚动到中心
      const top = active.offsetTop - musicLyric.clientHeight / 2 + active.clientHeight / 2;
      musicLyric.scrollTo({ top, behavior: "smooth" });
    }
  }

  /** 切换歌词面板显示 */
  function toggleMusicLyric() {
    if (!musicLyric) return;
    musicLyric.hidden = !musicLyric.hidden;
  }

  function togglePlay() {
    if (!state.music.playlist.length) return;
    if (state.music.currentIndex < 0) {
      loadAndPlay(0);
      return;
    }
    // 刷新后 audio.src 未加载：需先 loadAndPlay 获取音源
    if (!audio.src || audio.dataset.songId !== String(state.music.playlist[state.music.currentIndex].id)) {
      loadAndPlay(state.music.currentIndex);
      return;
    }
    if (audio.paused) {
      audio.play().then(() => {
        state.music.isPlaying = true;
        musicCapsule.classList.add("playing");
        setMusicPlayIcon("pause");
        updateCoverOverlay();
        renderMusicPlaylist();
      }).catch(() => {});
    } else {
      audio.pause();
      state.music.isPlaying = false;
      musicCapsule.classList.remove("playing");
      setMusicPlayIcon("play");
      updateCoverOverlay();
      renderMusicPlaylist();
    }
  }

  // 播放模式名实时取词（避免语言切换后仍显示旧语言）
  const playModeLabel = m => (m === "random" ? t("music.mode_random") : m === "one" ? t("music.mode_one") : t("music.mode_list"));

  /** 选下一曲索引：随机模式排除当前曲，列表/单曲循环（手动切歌）走相邻曲 */
  function pickNextIndex(dir) {
    const len = state.music.playlist.length;
    if (len <= 1) return state.music.currentIndex;
    if (state.music.playMode === "random") {
      let idx = state.music.currentIndex;
      while (idx === state.music.currentIndex) idx = Math.floor(Math.random() * len);
      return idx;
    }
    return (state.music.currentIndex + dir + len) % len;
  }

  function nextSong() {
    if (!state.music.playlist.length) return;
    loadAndPlay(pickNextIndex(1));
  }

  function prevSong() {
    if (!state.music.playlist.length) return;
    loadAndPlay(pickNextIndex(-1));
  }

  /** 播放模式按钮：应用模式对应的图标/高亮/提示 */
  function applyPlayModeBtn() {
    const btn = musicCapsule.querySelector("[data-music-mode]");
    if (!btn) return;
    btn.classList.toggle("mode-list", state.music.playMode === "list");
    btn.classList.toggle("mode-random", state.music.playMode === "random");
    btn.classList.toggle("mode-one", state.music.playMode === "one");
    // 非列表循环模式常亮提示
    btn.classList.toggle("on", state.music.playMode !== "list");
    btn.title = t("music.mode_title", { mode: playModeLabel(state.music.playMode) });
  }

  /** 循环切换播放模式：列表循环 → 随机播放 → 单曲循环（localStorage 持久化） */
  function cyclePlayMode() {
    const order = ["list", "random", "one"];
    const next = order[(order.indexOf(state.music.playMode) + 1) % order.length];
    state.music.playMode = next;
    localStorage.setItem("moments_playmode", next);
    applyPlayModeBtn();
    toast(t("music.mode_toast", { mode: playModeLabel(next) }));
  }

  function setMusicVolume(v) {
    v = Math.max(0, Math.min(1, Number(v) || 0));
    state.music.volume = v;
    audio.volume = v;
    audio.muted = v === 0;
    state.music.muted = v === 0;
    musicVolume.value = v;
    updateVolumeIcon();
  }

  function toggleMute() {
    // 静音来自自动播放兜底时：用户点喇叭必然是要声音，直接接管，不能走"非静音→再静音"的反转分支
    if (state.music.autoplayMuted) {
      takeAutoplayMute();
      return;
    }
    state.music.autoplayMuted = false; // 手动操作静音按钮即接管，取消自动恢复
    if (audio.muted || state.music.volume === 0) {
      setMusicVolume(state.music.volume > 0 ? state.music.volume : 0.7);
    } else {
      audio.muted = true;
      state.music.muted = true;
    }
    updateVolumeIcon();
  }

  function updateVolumeIcon() {
    if (!musicCapsule) return; // 音乐播放器未渲染（音乐功能关闭）
    // 音量键在 aux 控制段，与播放键不同父容器，需在整个胶囊范围内查找
    const on = musicCapsule.querySelector(".icon-vol-on");
    const off = musicCapsule.querySelector(".icon-vol-off");
    if (!on || !off) return;
    const muted = audio.muted || state.music.volume === 0;
    on.style.display = muted ? "none" : "";
    off.style.display = muted ? "" : "none";
  }

  // 音频事件
  // 进度改画在封面圆环上（conic-gradient 的 --mp 角度），圆环和隐藏进度条共用这一份比例；
  // 拖动期间由 _seeking 让位，否则回填会把把手打回去。
  const paintProgress = p => {
    musicCapsule.style.setProperty("--mp", p.toFixed(5));
    if (musicProgressBar) musicProgressBar.style.width = (p * 100).toFixed(3) + "%";
  };
  audio.addEventListener("timeupdate", () => {
    if (audio.duration && !audio._seeking) paintProgress(audio.currentTime / audio.duration);
    updateLyricIndex();
  });
  audio.addEventListener("ended", () => {
    // 单曲循环：原地重播，不走切歌
    if (state.music.playMode === "one") {
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }
    nextSong();
  });
  audio.addEventListener("error", () => {
    state.music.isLoading = false;
    setMusicPlayIcon("play");
    musicCapsule.classList.remove("playing");
    state.music.isPlaying = false;
    updateCoverOverlay();
    // 音源加载失败（如 VIP 歌曲流代理返回 502），自动跳下一首
    consecutiveFailCount++;
    if (consecutiveFailCount >= 3) {
      consecutiveFailCount = 0;
      toast(t("music.no_source_stop"));
      return;
    }
    const cur = state.music.playlist[state.music.currentIndex];
    toast(t("music.no_source_next", { name: cur?.name || t("music.song_fallback") }));
    setTimeout(() => nextSong(), 800);
  });

  // 封面加载失败：显示默认音乐图标占位
  musicCover.addEventListener("error", () => {
    if (!musicCover.dataset.fallback) {
      musicCover.dataset.fallback = "1";
      // 用 SVG data URI 作为占位封面
      musicCover.src = "data:image/svg+xml;utf8," + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#e3e8f7"/><circle cx="50" cy="50" r="28" fill="#163bf2" opacity=".15"/><path d="M62 34L40 42v26a12 12 0 11-4-9V38l26-8v18a12 12 0 11-4 9V34z" fill="#163bf2" opacity=".6"/></svg>'
      );
    }
  });

  // 进度条：点击跳转 + 按住拖动
  bindSeek(musicProgress, musicProgressBar, () => audio, paintProgress);

  // 音量滑块
  musicVolume.addEventListener("input", e => {
    state.music.autoplayMuted = false; // 手动调音量即接管
    setMusicVolume(e.target.value);
  });

  // 折叠/展开胶囊
  function setCapsuleCollapsed(collapsed) {
    musicCapsule.classList.toggle("collapsed", collapsed);
    updateCoverOverlay();
  }

  // 更新折叠态中央的播放/暂停图标
  function updateCoverOverlay() {
    if (!musicCoverOverlay) return;
    const playing = state.music.isPlaying;
    musicCoverOverlay.innerHTML = playing
      ? `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>`
      : `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
  }

  // 控制按钮委托
  musicCapsule.addEventListener("click", e => {
    // 折叠态：点击整个球 → 展开（不暂停音乐）；属于用户主动操作，接管静音自动播放
    if (musicCapsule.classList.contains("collapsed")) {
      takeAutoplayMute();
      setCapsuleCollapsed(false);
      return;
    }
    const btn = e.target.closest("[data-music-prev]");
    if (btn) { takeAutoplayMute(); prevSong(); return; }
    if (e.target.closest("[data-music-mode]")) { cyclePlayMode(); return; }
    if (e.target.closest("[data-music-play]")) { takeAutoplayMute(); togglePlay(); return; }
    if (e.target.closest("[data-music-next]")) { takeAutoplayMute(); nextSong(); return; }
    if (e.target.closest("[data-music-list]")) { toggleMusicPlaylist(); return; }
    if (e.target.closest("[data-music-lyric]")) { toggleMusicLyric(); return; }
    if (e.target.closest("[data-music-mute]")) { toggleMute(); return; }
    if (e.target.closest("[data-music-close]")) {
      // 点击 X → 折叠成球形（音乐继续播放）
      setCapsuleCollapsed(true);
      if (musicLyric) musicLyric.hidden = true;
      if (musicPlaylist) musicPlaylist.hidden = true;
      return;
    }
  });

  // 播放列表关闭
  musicPlaylist.querySelector("[data-music-close-list]").addEventListener("click", () => {
    musicPlaylist.hidden = true;
  });
  // 播放列表选歌
  musicPlaylistList.addEventListener("click", e => {
    const item = e.target.closest(".music-playlist-item");
    if (!item || item.dataset.musicIdx === undefined) return;
    takeAutoplayMute();
    loadAndPlay(Number(item.dataset.musicIdx));
  });

  /** 初始化音乐播放器（设置启用时调用）
   *  加载歌单后，把第一首歌的标题/歌手/封面显示到胶囊上，但不自动播放
   */
  async function initMusicPlayer() {
    if (!state.settings.music_enable) {
      showMusicPlayer(false);
      return;
    }
    showMusicPlayer(true);
    // 应用后台音乐设置：初始音量 / 初始折叠 / 播放模式按钮态
    const vol = Math.max(0, Math.min(1, Number(state.settings.music_volume) || 0.7));
    setMusicVolume(vol);
    if (state.settings.music_collapsed) setCapsuleCollapsed(true);
    applyPlayModeBtn();
    if (!state.music.playlist.length) {
      const songs = await fetchMusicPlaylist();
      state.music.playlist = songs;
    }
    renderMusicPlaylist();
    // 刷新后默认显示第一首歌的信息（标题/歌手/封面），避免封面空白
    if (state.music.playlist.length && state.music.currentIndex < 0) {
      const first = state.music.playlist[0];
      musicTitle.textContent = first.name || t("music.not_playing");
      musicArtist.textContent = first.artist || t("music.click_play");
      setCover(first.pic);
      state.music.currentIndex = 0;
      renderMusicPlaylist();
    }
    // 预加载第一首：提前解析音源并缓冲，点击播放立即出声
    if (state.settings.music_preload !== false) {
      preloadFirstSong().then(() => {
        // 自动播放：预加载完成后尝试播放（被浏览器拦截则保持手动）
        if (state.settings.music_autoplay && !state.music.isPlaying && audio.paused) tryAutoplay();
      });
    } else if (state.settings.music_autoplay) {
      tryAutoplay();
    }
  }

  /** 预加载当前歌曲音源（不播放）：解析直链 → 填入 audio 缓冲。
   *  成功后 togglePlay 检测到 audio.src 与当前歌曲匹配，直接 play()，秒开。
   */
  let preloadToken = 0;
  async function preloadFirstSong() {
    if (!state.music.playlist.length) return;
    const idx = state.music.currentIndex >= 0 ? state.music.currentIndex : 0;
    const song = state.music.playlist[idx];
    if (!song) return;
    const token = ++preloadToken;
    try {
      let audioUrl = song.url || "";
      if (!audioUrl && /^\d+$/.test(song.id)) {
        const res = await api(`/api/music/163?id=${song.id}`);
        if (token !== preloadToken) return; // 期间用户已切歌/换曲，放弃
        audioUrl = res.url || "";
        if (res.cover && !song.pic) {
          song.pic = ensureHttps(res.cover);
          setCover(song.pic);
        }
      }
      if (!audioUrl) return;
      if (token !== preloadToken) return;
      // 已有同名音源（如自动播放已接手）则跳过
      if (audio.src && audio.dataset.songId === String(song.id)) return;
      audio.preload = "auto";
      audio.src = audioUrl;
      audio.dataset.songId = String(song.id);
      audio.load();
      loadLyric(song); // 歌词一并预取
    } catch {
      /* 预加载失败静默：点击播放时走正常 loadAndPlay 流程 */
    }
  }

  /** 标记播放中 UI 状态（tryAutoplay 复用） */
  function markPlaying() {
    state.music.isPlaying = true;
    musicCapsule.classList.add("playing");
    setMusicPlayIcon("pause");
    updateCoverOverlay();
    renderMusicPlaylist();
  }

  /** 用户主动操作（点击播放/切歌/喇叭/选歌）时，接管浏览器策略导致的静音自动播放 */
  function takeAutoplayMute() {
    if (!state.music.autoplayMuted) return;
    state.music.autoplayMuted = false;
    audio.muted = false;
    state.music.muted = false;
    updateVolumeIcon();
  }

  /** 自动播放（后台开启时）：预加载完成后直接播放。
   *  有声自动播放被浏览器策略拦截时（Safari/Firefox/无交互史的 Chrome 常见），
   *  回退为"静音自动播放"（各浏览器均允许），首次用户交互后自动恢复声音。 */
  async function tryAutoplay() {
    if (!audio.src) return;
    try {
      await audio.play();
      markPlaying();
    } catch (err) {
      // 只有浏览器策略拦截才允许静音兜底；AbortError/音源错误等不应把用户静音
      const blocked = err && (err.name === "NotAllowedError" || err.name === "SecurityError");
      if (!blocked) return; // 保持暂停，等待用户手动点击
      // 恢复监听在静音播放发起前同步注册：用户若在 play() resolve 前就点击，手势不能丢
      const restore = e => {
        // 播放器自身控件上的手势交给对应 click 处理器（takeAutoplayMute/toggleMute），
        // 否则 pointerdown 先解除静音、随后 click 又把静音切回去，状态反转
        if (e.target && e.target.closest && e.target.closest("#musicPlayer")) return;
        window.removeEventListener("pointerdown", restore);
        window.removeEventListener("keydown", restore);
        window.removeEventListener("touchstart", restore);
        if (!state.music.autoplayMuted) return;
        state.music.autoplayMuted = false;
        audio.muted = false;
        state.music.muted = false;
        updateVolumeIcon();
      };
      window.addEventListener("pointerdown", restore);
      window.addEventListener("keydown", restore);
      window.addEventListener("touchstart", restore);
      try {
        audio.muted = true;
        state.music.autoplayMuted = true;
        await audio.play();
        markPlaying();
        updateVolumeIcon();
        toast(t("music.muted_autoplay_tip"));
      } catch (_) {
        window.removeEventListener("pointerdown", restore);
        window.removeEventListener("keydown", restore);
        window.removeEventListener("touchstart", restore);
        state.music.autoplayMuted = false;
        audio.muted = false; // 兜底播放也失败时不能把静音状态残留给后续手动播放
        updateVolumeIcon();
        /* 完全无法自动播放：保持暂停，等待用户手动点击 */
      }
    }
  }

  /* ================= 正文音乐卡片（[music=id] 渲染） ================= */

  /**
   * 给进度轨接上"点击定位 + 按住拖动"。胶囊播放器和正文卡片共用一套。
   * track 是加高的透明命中区，fill 是表示已播比例的子元素；
   * getAudio() 返回 null 表示当前不可跳（比如这张卡没在播）。
   * onPaint(p) 可选：拖动/跳完时把比例同步给别的进度载体（胶囊的封面圆环）。
   * 拖动期间把 a._seeking 立起来，timeupdate 据此让位，避免回填写把把手打回去。
   */
  function bindSeek(track, fill, getAudio, onPaint) {
    if (!track || track._seekBound) return;
    track._seekBound = true;
    const pctAt = ev => {
      const r = track.getBoundingClientRect();
      return r.width ? Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)) : 0;
    };
    track.addEventListener("pointerdown", ev => {
      const a = getAudio();
      if (!a || !a.duration) return;
      ev.preventDefault();
      a._seeking = true;
      track.classList.add("dragging");
      try { track.setPointerCapture(ev.pointerId); } catch { /* 不支持也要能点跳 */ }
      const show = p => {
        if (fill) fill.style.width = (p * 100).toFixed(2) + "%";
        if (onPaint) onPaint(p);
      };
      const move = e2 => show(pctAt(e2));
      const done = e2 => {
        track.removeEventListener("pointermove", move);
        track.removeEventListener("pointerup", done);
        track.removeEventListener("pointercancel", done);
        track.classList.remove("dragging");
        a._seeking = false;
        a.currentTime = pctAt(e2) * a.duration;
        show(pctAt(e2));
      };
      show(pctAt(ev));
      track.addEventListener("pointermove", move);
      track.addEventListener("pointerup", done);
      track.addEventListener("pointercancel", done);
    });
  }

  const musicMetaCache = new Map();
  let musicCardAudio = null;

  function stopAllMusicCards() {
    document.querySelectorAll(".music-block-card.playing").forEach(c => {
      c.classList.remove("playing");
      // 歌词行占位但透明，保持卡片高度不抖动
      const nowLyric = c.querySelector("[data-mcc-now-lyric]");
      if (nowLyric) nowLyric.classList.add("is-empty");
    });
  }

  function pauseBottomMusic() {
    if (audio && !audio.paused) {
      audio.pause();
      state.music.isPlaying = false;
      musicCapsule.classList.remove("playing");
      setMusicPlayIcon("play");
      updateCoverOverlay();
      renderMusicPlaylist();
    }
  }

  const cardLyricCache = new Map(); // songId -> [{time, text}]
  const cardLyricState = { lines: [], currentIndex: -1, songId: "" };
  const cardLyricDismissed = new Set(); // 用户主动关闭过的 songId，不再自动弹出

  function toggleMusicCard(card, id, meta) {
    if (!musicCardAudio) musicCardAudio = new Audio();
    const a = musicCardAudio;
    const nowLyric = card.querySelector("[data-mcc-now-lyric]");
    if (card.classList.contains("playing")) {
      a.pause();
      card.classList.remove("playing");
      // 暂停时歌词行占位但透明，保持卡片高度不抖动
      if (nowLyric) nowLyric.classList.add("is-empty");
      return;
    }
    pauseBottomMusic();
    stopAllMusicCards();
    if (a.dataset.songId !== id) {
      a.src = meta.url || "";
      a.dataset.songId = id;
      // 切歌时重置歌词状态（歌词稍后在播放成功后自动加载）
      cardLyricState.lines = [];
      cardLyricState.currentIndex = -1;
      cardLyricState.songId = id;
    }
    a.volume = state.music.volume;
    a.play()
      .then(() => {
        card.classList.add("playing");
        // 播放时显示内联歌词行（位于歌手名下方，不隐藏歌手名）
        if (nowLyric) {
          nowLyric.textContent = "♪";
          nowLyric.classList.remove("is-empty");
        }
        // 后台加载歌词（不强制弹出完整面板）
        autoLoadCardLyric(card, id, meta);
        if (!a._cardBound) {
          a._cardBound = true;
          a.addEventListener("timeupdate", () => {
            const bar = document.querySelector(".music-block-card.playing .mcc-bar i");
            if (bar && a.duration && !a._seeking) bar.style.width = (a.currentTime / a.duration) * 100 + "%";
            updateCardLyric(a.currentTime);
          });
          a.addEventListener("ended", () => {
            stopAllMusicCards();
          });
        }
      })
      .catch(() => toast(t("music.play_failed")));
  }

  /** 播放时后台加载歌词到内存，内联显示当前行（不自动弹出完整面板）
   *  站内曲目（t 前缀）直接用元数据自带歌词；网易云 ID 走后端代理 */
  async function autoLoadCardLyric(card, id, meta) {
    const panel = card.querySelector("[data-mcc-lyric-panel]");
    if (!panel) return;
    // 仅加载到内存，不自动弹出完整面板（用户可用歌词按钮手动展开）
    if (cardLyricCache.has(id)) {
      cardLyricState.lines = cardLyricCache.get(id);
      cardLyricState.songId = id;
      return;
    }
    let lrc = "";
    if (/^t\d+$/.test(id)) {
      lrc = (meta && meta.lyric) || "";
    } else {
      try {
        const res = await api(`/api/music/163/lyric?id=${encodeURIComponent(id)}`);
        lrc = res.lyric || "";
      } catch {
        /* 歌词获取失败不影响播放 */
      }
    }
    cardLyricState.lines = parseLrc(lrc);
    cardLyricState.songId = id;
    if (lrc) cardLyricCache.set(id, cardLyricState.lines);
  }

  /** 解析 LRC（复用底部播放器的 parseLrc） */
  function parseCardLrc(lrcStr) {
    if (!lrcStr) return [];
    return parseLrc(lrcStr);
  }

  /** 手动切换说说内音乐卡片的歌词面板 */
  async function toggleCardLyric(card, id, meta, btn) {
    const panel = card.querySelector("[data-mcc-lyric-panel]");
    if (!panel) return;
    const isOpen = panel.classList.contains("show");
    if (isOpen) {
      // 用户主动关闭：标记为 dismissed，不再自动弹出
      cardLyricDismissed.add(id);
      panel.classList.remove("show");
      if (btn) btn.classList.remove("active");
      return;
    }
    // 打开：清除 dismissed 标记（用户重新打开表示想看歌词）
    cardLyricDismissed.delete(id);
    panel.classList.add("show");
    if (btn) btn.classList.add("active");

    // 若歌词已缓存直接渲染
    if (cardLyricCache.has(id)) {
      cardLyricState.lines = cardLyricCache.get(id);
      cardLyricState.songId = id;
      renderCardLyric(panel);
      return;
    }
    panel.innerHTML = `<div class="mcc-lyric-empty">${t("music.lyric_loading")}</div>`;
    try {
      let lrc = "";
      if (/^t\d+$/.test(id)) {
        lrc = (meta && meta.lyric) || "";
      } else {
        const res = await api(`/api/music/163/lyric?id=${encodeURIComponent(id)}`);
        lrc = res.lyric || "";
      }
      cardLyricState.lines = parseCardLrc(lrc);
      cardLyricState.songId = id;
      if (lrc) cardLyricCache.set(id, cardLyricState.lines);
      renderCardLyric(panel);
    } catch {
      panel.innerHTML = `<div class="mcc-lyric-empty">${t("music.lyric_failed")}</div>`;
    }
  }

  function renderCardLyric(panel) {
    if (!cardLyricState.lines.length) {
      panel.innerHTML = `<div class="mcc-lyric-empty">${t("music.no_lyric")}</div>`;
      return;
    }
    panel.innerHTML = cardLyricState.lines
      .map((l, i) => `<div class="mcc-lyric-line" data-idx="${i}">${esc(l.text)}</div>`)
      .join("");
  }

  function updateCardLyric(currentTime) {
    if (!cardLyricState.lines.length) return;
    let idx = -1;
    for (let i = 0; i < cardLyricState.lines.length; i++) {
      if (cardLyricState.lines[i].time <= currentTime) idx = i;
      else break;
    }
    if (idx === cardLyricState.currentIndex) return;
    cardLyricState.currentIndex = idx;

    // 内联显示当前歌词行（替换歌手名位置）
    const card = document.querySelector(".music-block-card.playing");
    const nowLyric = card?.querySelector("[data-mcc-now-lyric]");
    if (nowLyric) {
      const text = idx >= 0 ? cardLyricState.lines[idx].text : "";
      nowLyric.textContent = text;
      nowLyric.hidden = false;
    }

    // 若完整歌词面板已展开，同步高亮并滚动
    const panel = document.querySelector(".mcc-lyric.show");
    if (!panel) return;
    panel.querySelectorAll(".mcc-lyric-line").forEach(el => {
      el.classList.toggle("active", Number(el.dataset.idx) === idx);
    });
    const active = panel.querySelector(".mcc-lyric-line.active");
    if (active) {
      const top = active.offsetTop - panel.clientHeight / 2 + active.clientHeight / 2;
      panel.scrollTo({ top, behavior: "smooth" });
    }
  }

  /** 扫描容器内未水合的音乐占位卡，拉取元信息并挂播放器 */
  async function hydrateMusicCards(root) {
    const cards = [...root.querySelectorAll(".music-block-card[data-song-id]:not([data-hydrated])")];
    if (!cards.length) return;
    cards.forEach(c => (c.dataset.hydrated = "1"));
    await Promise.all(
      cards.map(async card => {
        const id = card.dataset.songId;
        let meta = musicMetaCache.get(id);
        if (!meta) {
          try {
            // t 前缀 = 站内曲库曲目；纯数字 = 旧网易云 ID
            meta = await api(
              /^t\d+$/.test(id) ? `/api/music/track?id=${encodeURIComponent(id)}` : `/api/music/163?id=${id}`
            );
            musicMetaCache.set(id, meta);
          } catch {
            meta = null;
          }
        }
        if (!meta || meta.available === false) {
          card.innerHTML = `<div class="mcc-err">${svgIcon("music", 16)} ${t("music.unavailable")}</div>`;
          return;
        }
        if (!meta.title && !meta.url) {
          card.innerHTML = `<div class="mcc-err">${svgIcon("music", 16)} ${t("music.load_failed")}</div>`;
          return;
        }
        card.innerHTML = `
          <button type="button" class="mcc-cover-wrap" aria-label="${t("music.play_pause")}" title="${t("music.play_pause")}">
            ${meta.cover ? `<img class="mcc-cover" src="${proxyCover(meta.cover)}" alt="" referrerpolicy="no-referrer" />` : `<span class="mcc-cover mcc-cover--ph">${svgIcon("music", 20)}</span>`}
            <span class="mcc-cover-ring"></span>
            <span class="mcc-cover-hint">
              <svg class="h-play" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              <svg class="h-pause" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>
            </span>
          </button>
          <div class="mcc-info">
            <div class="mcc-name">${esc(meta.title)}</div>
            <div class="mcc-artist" data-mcc-artist>${esc(meta.artist)}</div>
            <div class="mcc-now-lyric is-empty" data-mcc-now-lyric></div>
          </div>
          <button type="button" class="mcc-lyric-btn" data-mcc-lyric aria-label="${t("music.lyric")}" title="${t("music.lyric")}">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zm14-10v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/></svg>
          </button>
          <div class="mcc-bar" aria-hidden="true"><i></i></div>
          <div class="mcc-lyric" data-mcc-lyric-panel><div class="mcc-lyric-empty">${t("music.no_lyric")}</div></div>`;
        // 封面即播放键：常驻的播放角标是可点提示，转起来的黑胶本身就是播放状态
        card.querySelector(".mcc-cover-wrap").addEventListener("click", () => toggleMusicCard(card, id, meta));
        // 歌词按钮（展开完整歌词面板，可选）
        const lyricBtn = card.querySelector("[data-mcc-lyric]");
        lyricBtn.addEventListener("click", () => toggleCardLyric(card, id, meta, lyricBtn));
        // 进度轨：只有正在播这张卡的音频才可拖，别的卡片点了不发声也别乱跳
        bindSeek(card.querySelector(".mcc-bar"), card.querySelector(".mcc-bar i"),
          () => (card.classList.contains("playing") ? musicCardAudio : null));
      })
    );
  }

  // 底部播放器与正文卡片互斥
  audio.addEventListener("play", () => {
    if (musicCardAudio && !musicCardAudio.paused) {
      musicCardAudio.pause();
      stopAllMusicCards();
    }
  });

  /* ================= Markdown 编辑器工具栏（说说/文章通用） ================= */

  /** Jxe 同款 lucide 线性图标（24 viewBox，stroke 2） */
  const MD_ICONS = {
    heading: '<path d="M6 12h12"/><path d="M6 20V4"/><path d="M18 20V4"/>',
    bold: '<path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/>',
    italic: '<line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/>',
    strike: '<path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" x2="20" y1="12" y2="12"/>',
    quote:
      '<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>',
    code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    codeBlock: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="m10 10-2 2 2 2"/><path d="m14 14 2-2-2-2"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    list: '<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>',
    listOrdered:
      '<line x1="10" x2="21" y1="6" y2="6"/><line x1="10" x2="21" y1="12" y2="12"/><line x1="10" x2="21" y1="18" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>',
    listChecks: '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>',
    table: '<rect width="18" height="18" x="3" y="3" rx="2"/><line x1="3" x2="21" y1="9" y2="9"/><line x1="3" x2="21" y1="15" y2="15"/><line x1="12" x2="12" y1="3" y2="21"/>',
    minus: '<path d="M5 12h14"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    video: '<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
    pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    crosshair: '<circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
    rocket:
      '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
    highlight:
      '<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
    expand:
      '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    compress:
      '<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>',
    caret: '<path d="m6 9 6 6 6-6"/>',
    alignCenter:
      '<line x1="21" x2="3" y1="6" y2="6"/><line x1="17" x2="7" y1="12" y2="12"/><line x1="19" x2="5" y1="18" y2="18"/>',
    linkImage:
      '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  };
  function mdIcon(name) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${MD_ICONS[name] || ""}</svg>`;
  }

  /** textarea 程序化修改后补发 input（音乐坞等监听方依赖） */
  function mdFireInput(ta) {
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }

  /** 光标处包裹选区 */
  function mdWrapSelection(ta, before, after, placeholder) {
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = ta.value.slice(start, end) || placeholder || "";
    ta.setRangeText(before + sel + after, start, end, "select");
    ta.selectionStart = start + before.length;
    ta.selectionEnd = start + before.length + sel.length;
    ta.focus();
    mdFireInput(ta);
  }

  /** 当前行首插入前缀 */
  function mdLinePrefix(ta, prefix) {
    const start = ta.selectionStart;
    const lineStart = ta.value.lastIndexOf("\n", start - 1) + 1;
    ta.setRangeText(prefix, lineStart, lineStart, "end");
    ta.selectionStart = ta.selectionEnd = start + prefix.length;
    ta.focus();
    mdFireInput(ta);
  }

  /** 独占一行插入块 */
  function mdInsertBlock(ta, text) {
    const start = ta.selectionStart;
    const atLineStart = start === 0 || ta.value[start - 1] === "\n";
    ta.setRangeText((atLineStart ? "" : "\n") + text + "\n", start, ta.selectionEnd, "end");
    ta.focus();
    mdFireInput(ta);
  }

  /** 居中块：包裹选区所在整行（可再次点击取消）；无选区时插入模板。文章/说说共用 */
  function mdWrapCenter(ta) {
    const val = ta.value;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === end || !val.slice(start, end).trim()) {
      mdInsertBlock(ta, ":::center\n居中内容\n:::");
      return;
    }
    const blockStart = val.lastIndexOf("\n", start - 1) + 1;
    const nl = val.indexOf("\n", end);
    const blockEnd = nl === -1 ? val.length : nl;
    const block = val.slice(blockStart, blockEnd);
    if (/^:::center[ \t]*\n/.test(block) && /\n:::[ \t]*$/.test(block)) {
      const inner = block.replace(/^:::center[ \t]*\n/, "").replace(/\n:::[ \t]*$/, "");
      ta.setRangeText(inner, blockStart, blockEnd, "select");
    } else {
      ta.setRangeText(`:::center\n${block}\n:::`, blockStart, blockEnd, "select");
    }
    ta.focus();
    mdFireInput(ta);
  }

  /** 顺序上传多个文件并按类型插入 Markdown（图片 ![]()、视频 @[video]()） */
  async function mdUploadFiles(ta, files, kind, onMsg) {
    let ok = 0;
    for (const file of files) {
      try {
        onMsg?.(kind === "image" ? `生成缩略图 ${file.name} …` : `上传中 ${file.name} 0%`);
        const data = await uploadMedia(file, kind, p => onMsg?.(`上传中 ${file.name} ${Math.round(p * 100)}%`));
        if (kind === "video") mdInsertBlock(ta, `@[video](${data.key})`);
        else mdInsertBlock(ta, `![](${data.key})`);
        ok++;
      } catch (err) {
        toast(err.message || "上传失败");
      }
    }
    if (ok) toast(kind === "video" ? `视频已插入（${ok}）` : `图片已插入（${ok}）`);
  }

  /** 正文图片上传（支持多选） */
  function mdPickImages(ta) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/gif,image/webp";
    input.multiple = true;
    input.onchange = () => {
      const files = [...input.files].filter(f => f.type.startsWith("image/"));
      if (files.length) mdUploadFiles(ta, files, "image", msg => toast(msg));
    };
    input.click();
  }

  /** 替换当前行的块级前缀（用于标题级别切换/切回正文） */
  function mdSetLinePrefix(ta, prefix) {
    const start = ta.selectionStart;
    const lineStart = ta.value.lastIndexOf("\n", start - 1) + 1;
    const nl = ta.value.indexOf("\n", start);
    const lineEnd = nl === -1 ? ta.value.length : nl;
    const line = ta.value.slice(lineStart, lineEnd);
    const stripped = prefix === "" ? line.replace(/^#{1,6}\s+/, "") : line.replace(/^#{1,6}\s+/, "");
    const next = prefix + stripped;
    ta.setRangeText(next, lineStart, lineEnd, "start");
    ta.selectionStart = ta.selectionEnd = lineStart + next.length;
    ta.focus();
    mdFireInput(ta);
  }

  /** 工具栏下拉菜单：items=[{icon,label,fn}]，返回触发按钮（菜单挂到 body 防被工具栏 overflow 裁剪） */
  let mdMenuDocBound = false;
  function mdDropdown(toolbar, icon, title, items) {
    if (!mdMenuDocBound) {
      mdMenuDocBound = true;
      const closeAll = () => document.querySelectorAll(".md-menu").forEach(m => (m.hidden = true));
      document.addEventListener("click", e => {
        if (!e.target.closest?.(".md-dropdown-btn") && !e.target.closest?.(".md-menu")) closeAll();
      });
      window.addEventListener("scroll", closeAll, true);
      window.addEventListener("resize", closeAll);
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "md-btn md-dropdown-btn";
    btn.title = title;
    btn.setAttribute("aria-label", title);
    btn.innerHTML = mdIcon(icon) + mdIcon("caret");
    const menu = document.createElement("span");
    menu.className = "md-menu";
    menu.hidden = true;
    items.forEach(it => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "md-menu-item";
      b.innerHTML = (it.icon ? mdIcon(it.icon) : "") + `<span>${it.label}</span>`;
      b.addEventListener("click", () => {
        menu.hidden = true;
        it.fn();
      });
      menu.appendChild(b);
    });
    document.body.appendChild(menu);
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const willOpen = menu.hidden;
      document.querySelectorAll(".md-menu").forEach(m => (m.hidden = true));
      if (willOpen) {
        menu.hidden = false;
        const r = btn.getBoundingClientRect();
        menu.style.top = `${r.bottom + 6}px`;
        menu.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - 184))}px`;
      }
    });
    return btn;
  }

  /** 网络图片插入面板（复用 .editor-music-panel 样式） */
  function toggleImageUrlPanel(container, ta) {
    const exist = container.querySelector("[data-imgurl-panel]");
    if (exist) {
      exist.remove();
      return;
    }
    const panel = document.createElement("div");
    panel.className = "editor-music-panel";
    panel.dataset.imgurlPanel = "";
    panel.innerHTML = `
      <div class="emp-row">
        <input type="url" placeholder="粘贴图片直链 https://…（jpg/png/webp/gif），回车插入" />
        <button type="button" class="btn primary" data-iup-ok>插入</button>
        <button type="button" class="btn" data-iup-close aria-label="关闭">×</button>
      </div>
      <div class="emp-help">支持一次粘贴多个链接，用空格或换行分隔，将批量插入。</div>`;
    container.appendChild(panel);
    const input = panel.querySelector("input");
    input.focus();
    const ok = () => {
      const urls = input.value.match(/https?:\/\/[^\s]+/g) || [];
      if (!urls.length) return toast("请输入图片链接");
      urls.forEach(u => mdInsertBlock(ta, `![](${u})`));
      panel.remove();
      toast(`已插入 ${urls.length} 张图片`);
    };
    panel.querySelector("[data-iup-ok]").addEventListener("click", ok);
    panel.querySelector("[data-iup-close]").addEventListener("click", () => panel.remove());
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        ok();
      }
    });
  }

  /** 视频插入面板：上传 MP4（≤100MB）或在线 m3u8/mp4 地址 */
  function toggleVideoInsertPanel(container, ta, initialTab) {
    const exist = container.querySelector("[data-video-panel]");
    if (exist) {
      exist.remove();
      return;
    }
    const panel = document.createElement("div");
    panel.className = "editor-music-panel";
    panel.dataset.videoPanel = "";
    panel.innerHTML = `
      <div class="seg evp-seg">
        <button type="button" data-vtab="mp4-upload" class="on">上传 MP4</button>
        <button type="button" data-vtab="url">在线地址</button>
      </div>
      <div data-vpanel="mp4-upload">
        <button type="button" class="btn block" data-evp-pick>上传 MP4</button>
        <input type="file" accept="video/mp4" data-evp-file hidden />
        <div class="upload-progress" data-evp-progress></div>
        <div class="emp-help">MP4 建议 ≤100MB；支持 Ctrl+V 粘贴视频上传。更大的视频请先传到对象存储/网盘，再用「在线地址」插入 <code>.m3u8</code> 或 <code>.mp4</code> 直链。</div>
      </div>
      <div data-vpanel="url" hidden>
        <div class="emp-row">
          <input type="url" placeholder="粘贴 B站 / YouTube 分享链接，或 .m3u8 / .mp4 直链" />
          <button type="button" class="btn primary" data-evp-ok>插入</button>
        </div>
        <div class="emp-row">
          <input type="url" data-evp-poster placeholder="封面图地址（选填，仅直链视频需要）" />
          <button type="button" class="btn" data-evp-poster-upload>上传</button>
          <input type="file" accept="image/*" data-evp-poster-file hidden />
        </div>
        <div class="emp-help">支持粘贴 B站 / YouTube 分享链接（自动取封面、点击播放）；也支持 .m3u8 或 .mp4 直链。封面可点「上传」或 Ctrl+V 粘贴图片自动回填。</div>
      </div>`;
    container.appendChild(panel);
    const progress = panel.querySelector("[data-evp-progress]");
    // 选项卡
    const switchTab = name => {
      panel.querySelectorAll("[data-vtab]").forEach(b => b.classList.toggle("on", b.dataset.vtab === name));
      panel.querySelectorAll("[data-vpanel]").forEach(p => (p.hidden = p.dataset.vpanel !== name));
    };
    panel.querySelectorAll("[data-vtab]").forEach(tb => tb.addEventListener("click", () => switchTab(tb.dataset.vtab)));
    if (initialTab === "url") {
      switchTab("url");
      panel.querySelector('input[type="url"]').focus();
    }
    // 本地上传（文件选择 / 粘贴共用）
    const evpFile = panel.querySelector("[data-evp-file]");
    async function uploadArticleVideo(file) {
      if (!file) return;
      if (!/video\/mp4|mp4/i.test(file.type) && !/\.mp4$/i.test(file.name)) {
        return toast("仅支持 MP4 文件");
      }
      try {
        // HEVC 检测：iPhone 默认录制为 hvc1，Firefox/部分 Chrome 不能解码 → 有声音没画面
        // 转码为 H.264 后所有浏览器可播；H.264 视频直传无影响
        let videoToUpload = file;
        if (await detectHevcMp4(file)) {
          progress.textContent = "检测到 HEVC 视频，正在转码为 H.264…";
          videoToUpload = await transcodeHevcToAvc(file, p => {
            // 100% 后 ffmpeg 还要做音频封装（原 faststart 已移除），期间可能持续数秒~数十秒
            if (panel.isConnected) progress.textContent = p >= 0.995 ? "正在封装视频，请稍候…" : `转码 HEVC → H.264 ${Math.round(p * 100)}%（首次加载转码器约 30MB）`;
          });
        }
        const data = await uploadMedia(videoToUpload, "video", p => {
          if (panel.isConnected) progress.textContent = `上传视频 ${Math.round(videoToUpload.size / 1048576)}MB，${Math.round(p * 100)}%`;
        });
        mdInsertBlock(ta, `@[video](${data.key})`);
        panel.remove();
        toast("视频已插入");
        // 视频上传完成后异步截取并上传封面，追加到刚插入的块（不阻塞，失败静默；用户也可自定义）
        // 注意：从转码后的文件截取封面（HEVC 原文件在 canvas 上可能无法渲染）
        (async () => {
          try {
            const posterBlob = await extractVideoPoster(videoToUpload);
            if (!posterBlob) return;
            const posterData = await uploadFile(new File([posterBlob], "poster.jpg", { type: "image/jpeg" }), "image");
            // 编辑器已关闭/销毁：不再回写
            if (!ta.isConnected) return;
            const target = `@[video](${data.key})`;
            const withPoster = `@[video](${data.key} "${posterData.key}")`;
            if (ta.value.indexOf(target) >= 0) {
              ta.value = ta.value.split(target).join(withPoster);
              ta.dispatchEvent(new Event("input"));
            }
          } catch {}
        })();
      } catch (err) {
        if (panel.isConnected) progress.textContent = err.message || "上传失败";
      }
    }
    panel.querySelector("[data-evp-pick]").addEventListener("click", () => evpFile.click());
    evpFile.addEventListener("change", () => {
      const f = evpFile.files[0];
      evpFile.value = ""; // 允许再次选择同一个文件
      uploadArticleVideo(f);
    });
    // 封面：上传按钮 / 粘贴图片 → 回填封面地址
    const posterFile = panel.querySelector("[data-evp-poster-file]");
    const uploadEvpPoster = async file => {
      const old = posterInput.value;
      posterInput.value = "上传中…";
      try {
        const d = await uploadMedia(file, "image", () => {});
        if (posterInput.isConnected) { posterInput.value = d.src; posterInput.dispatchEvent(new Event("input")); }
        toast("封面已上传");
      } catch (err) {
        if (posterInput.isConnected) posterInput.value = old;
        toast(err.message);
      }
    };
    panel.querySelector("[data-evp-poster-upload]").addEventListener("click", () => posterFile.click());
    posterFile.addEventListener("change", () => {
      const f = posterFile.files[0];
      posterFile.value = "";
      if (f) uploadEvpPoster(f);
    });
    // 面板内粘贴分流：封面框聚焦→回填封面；上传 MP4 标签可见→粘贴视频上传
    panel.addEventListener("paste", e => {
      const cd = e.clipboardData;
      if (!cd) return;
      const items = [...cd.items];
      const imgFile = items.find(it => it.kind === "file" && it.type.startsWith("image/"))?.getAsFile();
      const videoFile = items.find(it => it.kind === "file" && (it.type.startsWith("video/") || /\.mp4$/i.test(it.getAsFile?.()?.name || "")))?.getAsFile();
      if (document.activeElement === posterInput && imgFile) {
        e.preventDefault();
        uploadEvpPoster(imgFile);
        return;
      }
      const mp4p = panel.querySelector('[data-vpanel="mp4-upload"]');
      if (mp4p && !mp4p.hidden && videoFile) {
        e.preventDefault();
        uploadArticleVideo(videoFile);
      }
    });
    // 在线地址
    const urlInput = panel.querySelector('input[type="url"]');
    const posterInput = panel.querySelector("[data-evp-poster]");
    const okUrl = () => {
      const u = urlInput.value.trim();
      // B站 / YouTube：从任意文本（含标题、分享参数）里提取 provider+vid，重建规范链接，
      // 丢弃无关文字和 query，避免带空格的脏串导致 @[video] 解析失败
      const emb = parseEmbedUrl(u);
      if (emb) {
        const clean = emb.provider === "youtube"
          ? `https://youtu.be/${emb.vid}`
          : `https://www.bilibili.com/video/${emb.vid}`;
        mdInsertBlock(ta, `@[video](${clean})`);
        panel.remove();
        toast(`${emb.provider === "youtube" ? "YouTube" : "B站"}视频已插入`);
        return;
      }
      // 去掉 query/hash 后按路径扩展名判断，兼容带签名参数（?Expires=&Signature=）的直链
      let pathOk = false;
      try {
        const path = new URL(u).pathname.toLowerCase();
        pathOk = /\.(m3u8|mp4)$/.test(path);
      } catch {}
      if (!pathOk) {
        return toast("请输入 B站/YouTube 分享链接，或 .m3u8 / .mp4 结尾的视频直链");
      }
      const p = posterInput.value.trim();
      // 封面接受 http(s) 外链或站内相对路径（/media/...）
      if (p && !/^https?:\/\/\S+$/i.test(p) && !/^\/\S+$/.test(p)) {
        return toast("封面地址需为 http(s) 链接或 / 开头的站内路径");
      }
      mdInsertBlock(ta, p ? `@[video](${u} "${p}")` : `@[video](${u})`);
      panel.remove();
      toast("视频已插入");
    };
    panel.querySelector("[data-evp-ok]").addEventListener("click", okUrl);
    urlInput.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        okUrl();
      }
    });
    posterInput.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        okUrl();
      }
    });
  }

  /* ================= 全局悬浮试听条（说说/文章编辑器共用） =================
     独立挂在 body 下：关闭音乐面板、甚至关闭编辑器都不影响播放；
     只有点条上的关闭键才停止。所有行内播放键通过 data-pd-key 与它同步。 */
  let previewDockEl = null;
  function getPreviewDock() {
    if (previewDockEl) return previewDockEl;
    const ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    const ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>';
    const ICON_LOADING = '<svg class="pd-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M21 12a9 9 0 1 0-9 9"/></svg>';
    const ICON_NOTE = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>';
    const ICON_HIDE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
    const ICON_CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';

    const dock = document.createElement("div");
    dock.className = "preview-dock";
    dock.hidden = true;
    dock.innerHTML = `
      <button type="button" class="pd-fab" aria-label="展开试听条" hidden>
        <img class="pd-fab-cover" alt="" referrerpolicy="no-referrer" hidden />
        <span class="pd-fab-note">${ICON_NOTE}</span>
        <span class="pd-fab-ripple"></span>
      </button>
      <div class="pd-bar">
        <div class="pd-cover-wrap">
          <img class="pd-cover" alt="" referrerpolicy="no-referrer" hidden />
          <span class="pd-cover-ph">${ICON_NOTE}</span>
        </div>
        <div class="pd-meta">
          <div class="pd-title-row"><span class="pd-title">未播放</span><span class="pd-vip" hidden>VIP</span></div>
          <div class="pd-artist"></div>
        </div>
        <button type="button" class="pd-btn pd-toggle" aria-label="播放/暂停">${ICON_PLAY}</button>
        <div class="pd-progress">
          <span class="pd-time pd-cur">0:00</span>
          <input type="range" class="pd-seek" min="0" max="1000" step="1" value="0" aria-label="播放进度" />
          <span class="pd-time pd-dur">0:00</span>
        </div>
        <button type="button" class="pd-btn pd-hide" aria-label="隐藏播放器">${ICON_HIDE}</button>
        <button type="button" class="pd-btn pd-close" aria-label="关闭并停止">${ICON_CLOSE}</button>
      </div>
      <audio class="pd-audio" preload="metadata"></audio>`;
    document.body.appendChild(dock);

    const audio = dock.querySelector(".pd-audio");
    const fab = dock.querySelector(".pd-fab");
    const cover = dock.querySelector(".pd-cover");
    const coverPh = dock.querySelector(".pd-cover-ph");
    const fabCover = dock.querySelector(".pd-fab-cover");
    const titleEl = dock.querySelector(".pd-title");
    const vipEl = dock.querySelector(".pd-vip");
    const artistEl = dock.querySelector(".pd-artist");
    const toggleBtn = dock.querySelector(".pd-toggle");
    const seek = dock.querySelector(".pd-seek");
    const curEl = dock.querySelector(".pd-cur");
    const durEl = dock.querySelector(".pd-dur");
    audio.volume = 0.8;

    const fmt = s => {
      if (!isFinite(s) || s < 0) s = 0;
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return `${m}:${sec < 10 ? "0" : ""}${sec}`;
    };

    /** 同步所有行内播放键（面板可能已被移除/重建，全局按 data-pd-key 查）+ 悬浮条自身 */
    const sync = () => {
      const cur = dock._cur;
      const playing = !!cur && !audio.paused && !audio.ended;
      const loading = dock.classList.contains("is-loading");
      document.querySelectorAll("[data-pd-key]").forEach(btn => {
        const isCur = cur && btn.dataset.pdKey === cur.key;
        btn.innerHTML = isCur && loading ? ICON_LOADING : isCur && playing ? ICON_PAUSE : ICON_PLAY;
        const row = btn.closest(".emp-item");
        if (row) row.classList.toggle("playing", !!(isCur && (playing || loading)));
      });
      toggleBtn.innerHTML = loading ? ICON_LOADING : playing ? ICON_PAUSE : ICON_PLAY;
      dock.classList.toggle("playing", playing);
      fab.classList.toggle("playing", playing);
    };
    dock._sync = sync;

    const setCover = (url, img, ph) => {
      if (url) {
        img.src = url;
        img.hidden = false;
        if (ph) ph.style.display = "none";
      } else {
        img.removeAttribute("src");
        img.hidden = true;
        if (ph) ph.style.display = "";
      }
    };

    /** desc: { key, title, artist, cover?, url?, load?() => Promise<url> } */
    dock.play = desc => {
      // 同一首：播放/暂停切换
      if (dock._cur && dock._cur.key === desc.key) {
        if (audio.paused) {
          if (audio.ended) audio.currentTime = 0;
          audio.play().catch(() => toast(t("music.play_fail_retry")));
        } else {
          audio.pause();
        }
        return;
      }
      dock._cur = desc;
      dock.hidden = false;
      dock.classList.remove("is-hidden");
      fab.hidden = true;
      vipEl.hidden = true;
      titleEl.textContent = desc.title || t("music.unknown_song");
      artistEl.textContent = desc.artist || "";
      setCover(desc.cover || "", cover, coverPh);
      setCover(desc.cover || "", fabCover, null);
      curEl.textContent = "0:00";
      durEl.textContent = "0:00";
      seek.value = 0;
      dock.classList.add("is-loading");
      // 需要现场解析音源时，artist 行临时显示解析状态，结束后恢复
      const needResolve = !desc.url && !desc._url;
      if (needResolve) artistEl.textContent = t("music.resolving");
      sync();
      (async () => {
        try {
          if (needResolve) {
            try {
              const r = await desc.load();
              if (typeof r === "string") desc._url = r;
              else { desc._url = r.url; if (r.vip) vipEl.hidden = false; }
            } catch (err) {
              if (dock._cur === desc) {
                artistEl.textContent = t("music.resolve_no_source");
                toast(t("music.resolve_no_source"));
              }
              return;
            }
            if (dock._cur !== desc) return; // 已切到别的歌
            artistEl.textContent = desc.artist || "";
            toast(t("music.resolve_success"));
          }
          if (dock._cur !== desc) return;
          audio.src = desc.url || desc._url;
          await audio.play();
        } catch {
          if (dock._cur === desc) toast(t("music.play_fail_retry"));
        } finally {
          dock.classList.remove("is-loading");
          sync();
        }
      })();
    };

    dock.close = () => {
      dock._cur = null;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      seek.value = 0;
      dock.classList.remove("is-loading", "is-hidden", "playing");
      fab.hidden = true;
      dock.hidden = true;
      sync();
    };

    audio.addEventListener("playing", sync);
    audio.addEventListener("pause", sync);
    audio.addEventListener("ended", sync);
    audio.addEventListener("loadedmetadata", () => {
      durEl.textContent = fmt(audio.duration);
    });
    let seeking = false;
    const updateSeekFill = () => {
      const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
      seek.style.setProperty("--pd-pct", pct.toFixed(2) + "%");
    };
    audio.addEventListener("timeupdate", () => {
      if (!seeking && audio.duration) seek.value = Math.round((audio.currentTime / audio.duration) * 1000);
      curEl.textContent = fmt(audio.currentTime);
      updateSeekFill();
    });
    seek.addEventListener("input", () => {
      seeking = true;
      if (audio.duration) {
        audio.currentTime = (Number(seek.value) / 1000) * audio.duration;
        curEl.textContent = fmt(audio.currentTime);
      }
      updateSeekFill();
    });
    seek.addEventListener("change", () => {
      seeking = false;
    });

    toggleBtn.addEventListener("click", () => {
      if (!dock._cur) return;
      if (audio.paused) {
        if (audio.ended) audio.currentTime = 0;
        audio.play().catch(() => toast(t("music.play_fail_retry")));
      } else {
        audio.pause();
      }
    });
    dock.querySelector(".pd-hide").addEventListener("click", () => {
      dock.classList.add("is-hidden");
      fab.hidden = false;
    });
    fab.addEventListener("click", () => {
      dock.classList.remove("is-hidden");
      fab.hidden = true;
    });
    dock.querySelector(".pd-close").addEventListener("click", () => dock.close());

    previewDockEl = dock;
    return dock;
  }

  /** 供编辑器面板调用：传入曲目描述，交给全局悬浮试听条 */
  function previewDockPlay(desc) {
    getPreviewDock().play(desc);
  }

  /** 音乐插入面板（4 Tab：搜歌入库 / 我的曲库 / 本地上传 / 网络地址，入库成功自动插入 [music=tN]） */
  function toggleMusicInsertPanel(container, ta) {
    const exist = container.querySelector("[data-music-panel]");
    if (exist) {
      exist.remove();
      return;
    }
    // 播放/暂停/加载图标由全局悬浮试听条的 sync() 按 data-pd-key 统一维护
    const PLAY_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    const panel = document.createElement("div");
    panel.className = "editor-music-panel";
    panel.dataset.musicPanel = "";
    panel.innerHTML = `
      <div class="emp-tabs">
        <button type="button" class="on" data-emp-tab="search">搜歌入库</button>
        <button type="button" data-emp-tab="lib">我的曲库</button>
        <button type="button" data-emp-tab="upload">本地上传</button>
        <button type="button" data-emp-tab="url">网络地址</button>
        <span class="emp-flex"></span>
        <button type="button" class="emp-close" data-emp-close aria-label="关闭">×</button>
      </div>
      <div class="emp-body" data-emp-pane="search">
        <div class="emp-row">
          <input type="text" placeholder="搜索歌曲 / 歌手（网易云 + QQ 聚合）" />
          <button type="button" class="btn primary" data-emp-search>搜索</button>
        </div>
        <div class="emp-results" data-emp-results>
          <div class="emp-help">输入关键词搜索，先试听，满意再「入库」（自动下载全曲音频/封面/歌词到站内）。</div>
        </div>
      </div>
      <div class="emp-body" data-emp-pane="lib" hidden>
        <div class="emp-row"><input type="text" data-emp-lib-filter placeholder="筛选：歌名 / 歌手 / 标签" /></div>
        <div class="emp-results" data-emp-lib><div class="emp-help">加载中…</div></div>
      </div>
      <div class="emp-body" data-emp-pane="upload" hidden>
        <div class="emp-row"><input type="file" accept=".mp3,.m4a,.flac,.wav,.ogg,audio/*" data-emp-file /></div>
        <div class="emp-row">
          <input type="text" data-emp-title placeholder="歌曲名（默认取文件名）" />
          <input type="text" data-emp-artist placeholder="歌手" />
        </div>
        <div class="emp-row"><input type="file" accept="image/*" data-emp-coverfile /></div>
        <div class="emp-row"><button type="button" class="btn primary" data-emp-upload>上传并插入</button></div>
        <div class="emp-help">支持 mp3 / m4a / flac / wav / ogg，≤60MB，第三行可选封面图片。汽水音乐可先下载到本地再上传。</div>
      </div>
      <div class="emp-body" data-emp-pane="url" hidden>
        <div class="emp-row"><input type="url" data-emp-url placeholder="音频直链 https://…" /></div>
        <div class="emp-row">
          <input type="text" data-emp-urltitle placeholder="歌曲名" />
          <input type="text" data-emp-urlartist placeholder="歌手" />
        </div>
        <div class="emp-row"><input type="url" data-emp-urlcover placeholder="封面图直链（可选）" /></div>
        <div class="emp-row"><button type="button" class="btn primary" data-emp-saveurl>转存并插入</button></div>
        <div class="emp-help">服务端转存到站内存储；支持任何可直接访问的音频地址。</div>
      </div>`;
    container.appendChild(panel);

    const resultsBox = panel.querySelector("[data-emp-results]");
    const searchInput = panel.querySelector('[data-emp-pane="search"] input');
    const libBox = panel.querySelector("[data-emp-lib]");

    /* ---- Tab 切换（曲库懒加载） ---- */
    let libLoaded = false;
    panel.querySelector(".emp-tabs").addEventListener("click", e => {
      const tab = e.target.closest("[data-emp-tab]");
      if (tab) {
        panel.querySelectorAll("[data-emp-tab]").forEach(b => b.classList.toggle("on", b === tab));
        panel.querySelectorAll("[data-emp-pane]").forEach(p => (p.hidden = p.dataset.empPane !== tab.dataset.empTab));
        if (tab.dataset.empTab === "lib" && !libLoaded) {
          libLoaded = true;
          renderLib();
        }
        return;
      }
      if (e.target.closest("[data-emp-close]")) {
        // 不暂停试听：悬浮条独立存在，方便边听边写
        panel.remove();
      }
    });

    const insertAndClose = id => {
      mdInsertBlock(ta, `[music=${id}]`);
      panel.remove();
    };

    /* ---- 我的曲库：一键插入（支持按歌名/歌手/标签筛选） ---- */
    const libFilter = panel.querySelector("[data-emp-lib-filter]");
    let libCache = [];
    const renderLibRows = () => {
      const q = (libFilter.value || "").trim().toLowerCase();
      const tagsOf = t => (Array.isArray(t.tags) && t.tags.length ? t.tags : t.tag ? [t.tag] : []);
      const shown = q
        ? libCache.filter(t => `${t.title} ${t.artist} ${t.album || ""} ${tagsOf(t).join(" ")}`.toLowerCase().includes(q))
        : libCache;
      if (!shown.length) {
        libBox.innerHTML = `<div class="emp-help">${q ? "没有匹配的曲目。" : "曲库还是空的，去「搜歌入库」添加吧。"}</div>`;
        return;
      }
      libBox.innerHTML = shown
        .map(
          t => `
        <div class="emp-item">
          ${t.cover_url ? `<img class="emp-cover" src="${esc(t.cover_url)}" alt="" loading="lazy" referrerpolicy="no-referrer" />` : `<span class="emp-cover emp-cover--ph">${svgIcon("music", 18)}</span>`}
          <div class="emp-info">
            <div class="emp-name"><span class="emp-title">${esc(t.title)}</span>${tagsOf(t).map(x => `<span class="emp-src">${esc(x)}</span>`).join("")}${t.enabled ? "" : '<span class="emp-src">已停用</span>'}</div>
            <div class="emp-artist">${esc(t.artist)}${t.album ? " · " + esc(t.album) : ""} · ${esc(t.id)}</div>
          </div>
          <button type="button" class="emp-play" data-emp-libplay="${esc(t.id)}" data-pd-key="l:${esc(t.id)}" title="试听"${t.audio_url ? "" : " disabled"}>${PLAY_SVG}</button>
          <button type="button" class="btn" data-emp-use="${esc(t.id)}">插入</button>
        </div>`
        )
        .join("");
    };
    const renderLib = async () => {
      libBox.innerHTML = `<div class="emp-help"><span class="spinner"></span> 加载中…</div>`;
      try {
        const data = await api("/api/music/library");
        libCache = data.list || [];
        renderLibRows();
      } catch (e) {
        libBox.innerHTML = `<div class="emp-help">${esc(e.message || "曲库加载失败")}</div>`;
      }
    };
    libFilter.addEventListener("input", renderLibRows);
    libBox.addEventListener("click", e => {
      const lp = e.target.closest("[data-emp-libplay]");
      if (lp) {
        const t = libCache.find(x => String(x.id) === lp.dataset.empLibplay);
        if (!t) return;
        if (!t.audio_url) return toast("该曲目暂无可播放音源");
        previewDockPlay({
          key: `l:${t.id}`,
          title: t.title,
          artist: t.artist,
          cover: t.cover_url || "",
          url: t.audio_url,
        });
        return;
      }
      const use = e.target.closest("[data-emp-use]");
      if (!use) return;
      insertAndClose(use.dataset.empUse);
      toast("已插入音乐块");
    });

    /* ---- 搜歌入库：搜索 + 试听（走全局悬浮试听条） + 入库 ---- */
    /** 把 resolve 返回的外站音频 URL 包装成 Worker 代理地址，绕过防盗链 */
    const wrapStreamUrl = (url) =>
      url && !url.startsWith(location.origin) && !url.startsWith("/media/")
        ? `/api/music/stream?url=${encodeURIComponent(url)}`
        : url;
    const togglePreview = i => {
      const hit = (resultsBox._hits || [])[i];
      if (!hit) return;
      previewDockPlay({
        key: `s:${hit.source}:${hit.songId}`,
        title: hit.title,
        artist: hit.artist,
        cover: hit.cover ? proxyCover(hit.cover) : "",
        load: async () => {
          const d = await api(
            `/api/music/preview?source=${hit.source}&id=${encodeURIComponent(hit.songId)}&title=${encodeURIComponent(hit.title || "")}&artist=${encodeURIComponent(hit.artist || "")}`
          );
          return { url: wrapStreamUrl(d.url), vip: d.vip === true };
        },
      });
    };

    let searchBusy = false;
    const doSearch = async () => {
      const kw = searchInput.value.trim();
      if (!kw || searchBusy) return;
      searchBusy = true;
      resultsBox.innerHTML = `<div class="emp-help"><span class="spinner"></span> 搜索中…</div>`;
      try {
        const data = await api(`/api/music/search?kw=${encodeURIComponent(kw)}`);
        const SRC_LB = { netease: "网易云", qq: "QQ", kugou: "酷狗", kuwo: "酷我", qishui: "汽水" };
        const hits = ["netease", "qq", "kugou", "kuwo", "qishui"]
          .flatMap(k => (data[k] || []).map(h => ({ ...h, sourceLabel: SRC_LB[k] || k })));
        if (!hits.length) {
          resultsBox.innerHTML = `<div class="emp-help">没有找到相关歌曲，换个关键词试试。</div>`;
          return;
        }
        resultsBox.innerHTML = hits
          .map(
            (h, i) => `
        <div class="emp-item" data-emp-row="${i}">
          ${h.cover ? `<img class="emp-cover" src="${esc(proxyCover(h.cover))}" alt="" loading="lazy" referrerpolicy="no-referrer" />` : `<span class="emp-cover emp-cover--ph">${svgIcon("music", 18)}</span>`}
          <div class="emp-info">
            <div class="emp-name">${esc(h.title)}${h.vip ? '<span class="emp-vip">VIP</span>' : ""}<span class="emp-src">${h.sourceLabel}</span></div>
            <div class="emp-artist">${esc(h.artist)}${h.album ? " · " + esc(h.album) : ""}</div>
          </div>
          <button type="button" class="emp-play" data-emp-preview="${i}" data-pd-key="s:${h.source}:${h.songId}" title="试听">${PLAY_SVG}</button>
          <button type="button" class="btn" data-emp-import="${i}">入库</button>
        </div>`
          )
          .join("");
        resultsBox._hits = hits;
      } catch (e) {
        resultsBox.innerHTML = `<div class="emp-help">${esc(e.message || "搜索失败")}</div>`;
      } finally {
        searchBusy = false;
      }
    };
    panel.querySelector("[data-emp-search]").addEventListener("click", doSearch);
    searchInput.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        doSearch();
      }
    });
    /* ---- 入库进度弹窗：真实五步进度（轮询中央服务任务状态） ---- */
    const openImportProgress = hit => {
      const stageNames = ["解析音源", "下载音频", "获取封面与歌词", "上传到存储", "写入曲库"];
      const mask = document.createElement("div");
      mask.className = "imp-mask";
      mask.innerHTML = `
        <div class="imp-card" role="dialog" aria-label="入库进度">
          <div class="imp-head">
            ${hit.cover ? `<img class="imp-cover" src="${esc(proxyCover(hit.cover))}" alt="" referrerpolicy="no-referrer" />` : `<span class="imp-cover imp-cover--ph">${svgIcon("music", 20)}</span>`}
            <div class="imp-info">
              <div class="imp-title">${esc(hit.title || "未知歌曲")}${hit.vip ? '<span class="emp-vip">VIP</span>' : ""}</div>
              <div class="imp-sub">${esc(hit.artist || "未知歌手")} · ${esc(hit.sourceLabel || "")}</div>
            </div>
          </div>
          <ul class="imp-stages">
            ${stageNames.map(n => `<li class="imp-stage"><span class="imp-dot"></span><span class="imp-sname">${n}</span></li>`).join("")}
          </ul>
          <div class="imp-result"></div>
        </div>`;
      document.body.appendChild(mask);
      const rows = [...mask.querySelectorAll(".imp-stage")];
      const resultEl = mask.querySelector(".imp-result");
      const close = () => mask.remove();
      /** cur=当前进行中的步骤下标；terminal: undefined=进行中 / "ok" / "error" */
      const render = (cur, terminal) => rows.forEach((r, i) => {
        r.classList.toggle("is-done", terminal === "ok" || (!terminal && i < cur));
        r.classList.toggle("is-active", !terminal && i === cur);
        r.classList.toggle("is-failed", terminal === "error" && i === cur);
      });
      const showResult = (html, cls) => {
        resultEl.innerHTML = html;
        resultEl.classList.remove("is-ok", "is-failed");
        if (cls) resultEl.classList.add(cls);
      };
      render(0);
      return {
        stage: i => render(i),
        succeed: duplicate => {
          render(0, "ok");
          showResult(`<span class="imp-ok">${duplicate ? "该歌曲已在曲库中" : "入库成功"}</span>`, "is-ok");
        },
        fail: (msg, stageIdx) => {
          render(stageIdx ?? 0, "error");
          showResult(
            `<span class="imp-fail">入库失败：${esc(msg || "未知错误")}</span><button type="button" class="btn imp-close">关 闭</button>`,
            "is-failed"
          );
          resultEl.querySelector(".imp-close").onclick = close;
        },
        netHint: txt => showResult(`<span class="imp-net">${esc(txt)}</span>`),
        close,
      };
    };

    resultsBox.addEventListener("click", async e => {
      const play = e.target.closest("[data-emp-preview]");
      if (play) {
        togglePreview(Number(play.dataset.empPreview));
        return;
      }
      const btn = e.target.closest("[data-emp-import]");
      if (!btn || btn.disabled) return;
      const hit = (resultsBox._hits || [])[Number(btn.dataset.empImport)];
      if (!hit) return;
      btn.disabled = true;
      btn.textContent = "入库中…";
      const prog = openImportProgress(hit);
      let pollTimer = null, netFails = 0;
      const cleanup = () => { if (pollTimer) clearTimeout(pollTimer); };
      /** 轮询中央服务任务进度；running 时按 stage 推进，终态收敛 */
      const poll = id => {
        pollTimer = setTimeout(async () => {
          let job;
          try {
            job = await api(`/api/music/import/progress/${id}`);
            netFails = 0;
          } catch {
            // 轮询失败 = 浏览器网络问题，任务在中央服务后台不受影响，自动重连
            netFails++;
            if (netFails >= 20) {
              btn.disabled = false;
              btn.textContent = "入库";
              prog.fail("网络中断，无法获取进度（任务可能仍在后台执行，重试会自动判重）");
              return;
            }
            prog.netHint(`网络波动，第 ${netFails} 次重连中…`);
            poll(id);
            return;
          }
          if (job.status === "running") {
            prog.stage(job.stage || 0);
            poll(id);
          } else if (job.status === "done" || job.status === "duplicate") {
            const dup = job.status === "duplicate";
            prog.succeed(dup);
            toast(dup ? "已在音乐库，已插入" : "入库成功，已插入");
            setTimeout(() => { prog.close(); insertAndClose(`t${job.result_id}`); }, dup ? 700 : 1100);
          } else {
            btn.disabled = false;
            btn.textContent = "入库";
            prog.fail(job.error || "入库失败", job.stage || 0);
          }
        }, 700);
      };
      try {
        const d = await api("/api/music/import/async", {
          body: { source: hit.source, songId: hit.songId, title: hit.title, artist: hit.artist, album: hit.album, cover: hit.cover, vip: hit.vip },
        });
        poll(d.job_id);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = "入库";
        cleanup();
        prog.fail(err.message || "提交任务失败");
      }
    });

    /* ---- 本地上传 ---- */
    const uploadBtn = panel.querySelector("[data-emp-upload]");
    uploadBtn.addEventListener("click", async () => {
      const fileInput = panel.querySelector("[data-emp-file]");
      const file = fileInput && fileInput.files && fileInput.files[0];
      if (!file) return toast("请选择音频文件");
      if (file.size > 60 * 1024 * 1024) return toast("文件超过 60MB 限制");
      uploadBtn.disabled = true;
      uploadBtn.textContent = "上传中…";
      try {
        const form = new FormData();
        form.append("file", file);
        const title = panel.querySelector("[data-emp-title]").value.trim();
        const artist = panel.querySelector("[data-emp-artist]").value.trim();
        if (title) form.append("title", title);
        if (artist) form.append("artist", artist);
        const coverFile = panel.querySelector("[data-emp-coverfile]").files[0];
        if (coverFile) form.append("cover", coverFile);
        const data = await api("/api/music/upload", { form });
        insertAndClose(data.id);
        toast("上传成功，已插入");
      } catch (e) {
        toast(e.message || "上传失败");
      } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = "上传并插入";
      }
    });

    /* ---- 网络地址转存 ---- */
    const saveUrlBtn = panel.querySelector("[data-emp-saveurl]");
    const saveUrl = async () => {
      const url = panel.querySelector("[data-emp-url]").value.trim();
      if (!url) return toast("请输入音频地址");
      saveUrlBtn.disabled = true;
      saveUrlBtn.textContent = "转存中…";
      try {
        const data = await api("/api/music/url", {
          body: {
            url,
            title: panel.querySelector("[data-emp-urltitle]").value.trim(),
            artist: panel.querySelector("[data-emp-urlartist]").value.trim(),
            cover: panel.querySelector("[data-emp-urlcover]").value.trim(),
          },
        });
        insertAndClose(data.id);
        toast("转存成功，已插入");
      } catch (e) {
        toast(e.message || "转存失败");
      } finally {
        saveUrlBtn.disabled = false;
        saveUrlBtn.textContent = "转存并插入";
      }
    };
    saveUrlBtn.addEventListener("click", saveUrl);
    panel.querySelector("[data-emp-url]").addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        saveUrl();
      }
    });

    searchInput.focus();
  }

  /**
   * 编辑器内嵌「音乐坞」：实时解析 textarea 中的 [music=ID]，
   * 在编辑区内直接渲染可播放的音乐卡片（带移除按钮），说说/文章编辑器共用。
   * @param {HTMLTextAreaElement} ta
   * @param {Element} [afterEl] 坞插入位置（默认紧随 textarea）
   */
  function editorMusicDock(ta, afterEl) {
    const dock = document.createElement("div");
    dock.className = "editor-music-dock";
    dock.hidden = true;
    (afterEl || ta).after(dock);
    let lastKey = null;
    function sync() {
      const ids = [...ta.value.matchAll(/\[music=(t?\d+)\]/gi)].map(m => m[1]);
      const key = ids.join(",");
      if (key === lastKey) return;
      lastKey = key;
      if (!ids.length) {
        dock.hidden = true;
        dock.innerHTML = "";
        return;
      }
      dock.hidden = false;
      dock.innerHTML = ids
        .map(
          id => `
        <div class="editor-music-row">
          <div class="music-block-card" data-song-id="${id}"><div class="mcc-skeleton">${svgIcon("music", 16)} 加载中…</div></div>
          <button type="button" class="emd-remove" data-emd-rm="${id}" title="移除该音乐" aria-label="移除该音乐">×</button>
        </div>`
        )
        .join("");
      hydrateMusicCards(dock);
    }
    ta.addEventListener("input", sync);
    dock.addEventListener("click", e => {
      const rm = e.target.closest("[data-emd-rm]");
      if (!rm) return;
      ta.value = ta.value.replace(new RegExp(`\\[music=${rm.dataset.emdRm}\\][^\\n]*\\n?`, "i"), "");
      ta.dispatchEvent(new Event("input"));
      ta.focus();
    });
    sync();
    return dock;
  }

  /**
   * 文章编辑器（独立）：Jxe 风格 Markdown 工具栏 + 编辑/预览切换 + 内嵌音乐坞
   * 返回 { textarea }
   */
  function attachPostEditorTools(modal, textareaName) {
    const ta = modal.querySelector(`textarea[name="${textareaName}"]`);
    if (!ta) return null;
    const field = ta.closest(".field");
    field.classList.add("md-field");

    const toolbar = document.createElement("div");
    toolbar.className = "md-toolbar";

    const preview = document.createElement("div");
    preview.className = "md-preview datacont";
    preview.hidden = true;
    ta.before(toolbar);
    editorMusicDock(ta); // 先插坞再插预览，保持 .md-toolbar + textarea + .md-preview 相邻关系
    ta.after(preview);

    const seg = document.createElement("div");
    seg.className = "md-modes";
    seg.innerHTML = `<button type="button" class="on" data-mode="edit">${mdIcon("pencil")}<span>编辑</span></button><button type="button" data-mode="preview">${mdIcon("eye")}<span>预览</span></button>`;

    function setMode(mode) {
      seg.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.mode === mode));
      field.classList.toggle("previewing", mode === "preview");
      if (mode === "preview") {
        preview.innerHTML = renderContentHtml(ta.value) || `<div class="essay-empty" style="padding:1rem">暂无内容</div>`;
        hydrateMusicCards(preview);
        hydrateVideos(preview);
        ta.hidden = true;
        preview.hidden = false;
      } else {
        disposeVideos(preview); // 退回编辑模式时停止预览区 HLS 拉流
        preview.hidden = true;
        ta.hidden = false;
      }
    }
    seg.addEventListener("click", e => {
      const btn = e.target.closest("button[data-mode]");
      if (btn) setMode(btn.dataset.mode);
    });

    /* ---------- 工具栏：下拉菜单 + 分组按钮 ---------- */
    const addSep = () => {
      const s = document.createElement("span");
      s.className = "md-sep";
      toolbar.appendChild(s);
    };
    const addBtn = (icon, title, fn, cls) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "md-btn" + (cls ? " " + cls : "");
      b.innerHTML = mdIcon(icon);
      b.title = title;
      b.setAttribute("aria-label", title);
      b.addEventListener("click", fn);
      toolbar.appendChild(b);
      return b;
    };

    // 段落 / 标题级别
    toolbar.appendChild(
      mdDropdown(toolbar, "heading", "段落标题", [
        { label: "正文", fn: () => mdSetLinePrefix(ta, "") },
        { label: "一级标题 H1", fn: () => mdSetLinePrefix(ta, "# ") },
        { label: "二级标题 H2", fn: () => mdSetLinePrefix(ta, "## ") },
        { label: "三级标题 H3", fn: () => mdSetLinePrefix(ta, "### ") },
      ])
    );
    addSep();
    addBtn("bold", "加粗（Ctrl+B）", () => mdWrapSelection(ta, "**", "**", "加粗文字"));
    addBtn("italic", "斜体（Ctrl+I）", () => mdWrapSelection(ta, "*", "*", "斜体文字"));
    addBtn("strike", "删除线（Ctrl+Shift+X）", () => mdWrapSelection(ta, "~~", "~~", "删除文字"));
    addBtn("highlight", "高亮（Ctrl+Shift+H）", () => mdWrapSelection(ta, "==", "==", "高亮文字"));
    addSep();
    addBtn("quote", "引用", () => mdLinePrefix(ta, "> "));
    addBtn("alignCenter", "居中段落（选中行后点击，再点取消）", () => mdWrapCenter(ta));
    addBtn("code", "行内代码（Ctrl+E）", () => mdWrapSelection(ta, "`", "`", "code"));
    addBtn("codeBlock", "代码块", () => mdWrapSelection(ta, "```\n", "\n```", "code"));
    addSep();
    addBtn("link", "链接（Ctrl+K）", () => mdWrapSelection(ta, "[", "](https://)", "链接文字"));
    if (state.admin) {
      // 图片：本地上传（多选）或网络直链
      toolbar.appendChild(
        mdDropdown(toolbar, "image", "插入图片", [
          { icon: "upload", label: "上传图片（可多选）", fn: () => mdPickImages(ta) },
          { icon: "linkImage", label: "网络图片链接", fn: () => toggleImageUrlPanel(field, ta) },
        ])
      );
      // 视频：本地上传 MP4 或在线 m3u8/mp4
      toolbar.appendChild(
        mdDropdown(toolbar, "video", "插入视频", [
          { icon: "upload", label: "上传 MP4（≤100MB）", fn: () => toggleVideoInsertPanel(field, ta, "mp4-upload") },
          { icon: "video", label: "M3U8 / MP4 在线地址", fn: () => toggleVideoInsertPanel(field, ta, "url") },
        ])
      );
    }
    addBtn("music", "插入音乐（搜索入库 / 本地上传 / 网络地址）", () => toggleMusicInsertPanel(field, ta), "music");
    addSep();
    addBtn("list", "无序列表", () => mdLinePrefix(ta, "- "));
    addBtn("listOrdered", "有序列表", () => mdLinePrefix(ta, "1. "));
    addBtn("listChecks", "任务列表", () => mdLinePrefix(ta, "- [ ] "));
    addSep();
    addBtn("table", "插入表格", () =>
      mdInsertBlock(ta, "| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |")
    );
    addBtn("minus", "分割线", () => mdInsertBlock(ta, "---"));

    /* ---------- 右侧：字数统计 / 全屏 / 编辑预览 ---------- */
    const status = document.createElement("span");
    status.className = "md-status";
    const updateStatus = () => {
      const v = ta.value;
      const cjk = (v.match(/[一-龥]/g) || []).length;
      const words = (v.trim().match(/[A-Za-z0-9]+/g) || []).length;
      const imgs = (v.match(/!\[[^\]]*\]\(/g) || []).length;
      const vids = (v.match(/@\[video\]\(/g) || []).length;
      const musics = (v.match(/\[music=t?\d+\]/g) || []).length;
      const media = [imgs && `图 ${imgs}`, vids && `视频 ${vids}`, musics && `音乐 ${musics}`].filter(Boolean).join(" · ");
      status.textContent = `字数 ${cjk + words}${media ? "　" + media : ""}`;
    };
    ta.addEventListener("input", updateStatus);
    updateStatus();
    toolbar.appendChild(status);

    const fsBtn = addBtn("expand", "全屏编辑", () => toggleFullscreen());
    function toggleFullscreen() {
      const on = field.classList.toggle("md-fullscreen");
      fsBtn.innerHTML = mdIcon(on ? "compress" : "expand");
      fsBtn.title = on ? "退出全屏（Esc）" : "全屏编辑";
      fsBtn.classList.toggle("active", on);
      if (on) ta.focus();
    }

    toolbar.appendChild(seg);
    // 阻止工具栏按钮触发表单提交
    toolbar.querySelectorAll("button").forEach(b => (b.type = "button"));

    /* ---------- 编辑区增强（仅文章编辑器） ---------- */
    // 快捷键：Ctrl/Cmd+B/I/K/E、Ctrl+Shift+X/H；Tab 缩进
    ta.addEventListener("keydown", e => {
      if (e.isComposing) return;
      // 全屏下 Esc 先退出全屏（阻止冒泡到全局关闭弹窗）
      if (e.key === "Escape" && field.classList.contains("md-fullscreen")) {
        e.preventDefault();
        e.stopPropagation();
        toggleFullscreen();
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        ta.setRangeText("  ", ta.selectionStart, ta.selectionEnd, "end");
        mdFireInput(ta);
        return;
      }
      // Enter：列表/任务/引用自动续行；空项回车取消前缀
      if (e.key === "Enter" && !e.shiftKey && ta.selectionStart === ta.selectionEnd) {
        const pos = ta.selectionStart;
        const lineStart = ta.value.lastIndexOf("\n", pos - 1) + 1;
        const curLine = ta.value.slice(lineStart, pos);
        const task = curLine.match(/^(\s*)([-*+])\s+\[[ xX]\]\s/);
        const bullet = curLine.match(/^(\s*)([-*+])\s+/);
        const ordered = curLine.match(/^(\s*)(\d+)\.\s+/);
        const quote = curLine.match(/^(\s*>\s+)/);
        if (task || bullet || ordered || quote) {
          e.preventDefault();
          const emptyTask = /^\s*[-*+]\s+\[[ xX]\]\s*$/.test(curLine);
          const emptyBullet = /^\s*[-*+]\s*$/.test(curLine);
          const emptyOrdered = /^\s*\d+\.\s*$/.test(curLine);
          const emptyQuote = /^\s*>\s*$/.test(curLine);
          if (emptyTask || emptyBullet || emptyOrdered || emptyQuote) {
            ta.setRangeText("", lineStart, pos, "end");
          } else if (task) {
            ta.setRangeText(`\n${task[1]}${task[2]} [ ] `, pos, pos, "end");
          } else if (ordered) {
            ta.setRangeText(`\n${ordered[1]}${Number(ordered[2]) + 1}. `, pos, pos, "end");
          } else if (bullet) {
            ta.setRangeText(`\n${bullet[1]}${bullet[2]} `, pos, pos, "end");
          } else {
            ta.setRangeText(`\n${quote[1]}`, pos, pos, "end");
          }
          mdFireInput(ta);
          return;
        }
      }
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "b") {
        e.preventDefault();
        mdWrapSelection(ta, "**", "**", "加粗文字");
      } else if (k === "i") {
        e.preventDefault();
        mdWrapSelection(ta, "*", "*", "斜体文字");
      } else if (k === "k") {
        e.preventDefault();
        mdWrapSelection(ta, "[", "](https://)", "链接文字");
      } else if (k === "e") {
        e.preventDefault();
        mdWrapSelection(ta, "`", "`", "code");
      } else if (e.shiftKey && k === "x") {
        e.preventDefault();
        mdWrapSelection(ta, "~~", "~~", "删除文字");
      } else if (e.shiftKey && k === "h") {
        e.preventDefault();
        mdWrapSelection(ta, "==", "==", "高亮文字");
      }
    });

    // 粘贴图片：剪贴板里的截图直接上传插入
    ta.addEventListener("paste", e => {
      const files = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith("image/"));
      if (!files.length) return;
      e.preventDefault();
      mdUploadFiles(ta, files, "image", msg => toast(msg));
    });

    // 拖拽文件到编辑区：图片上传，MP4 作为视频上传
    ["dragenter", "dragover"].forEach(evt =>
      ta.addEventListener(evt, e => {
        if (e.dataTransfer && [...e.dataTransfer.files].length) {
          e.preventDefault();
          ta.classList.add("md-dragover");
        }
      })
    );
    ta.addEventListener("dragleave", () => ta.classList.remove("md-dragover"));
    ta.addEventListener("drop", e => {
      ta.classList.remove("md-dragover");
      const files = [...(e.dataTransfer?.files || [])];
      if (!files.length) return;
      e.preventDefault();
      const images = files.filter(f => f.type.startsWith("image/"));
      const videos = files.filter(f => /video\/mp4|\.mp4$/i.test(f.type) || /\.mp4$/i.test(f.name));
      if (images.length) mdUploadFiles(ta, images, "image", msg => toast(msg));
      if (videos.length) mdUploadFiles(ta, videos, "video", msg => toast(msg));
    });

    return { textarea: ta, setMode };
  }

  /* ================= 主题 ================= */

  // 主题自动切换：off=关闭 / system=跟随系统 / time=按时间切换
  let themeMediaCleanup = null;
  let themeTimeCleanup = null;
  function setupThemeAutoFollow() {
    if (themeMediaCleanup) themeMediaCleanup();
    if (themeTimeCleanup) themeTimeCleanup();
    themeMediaCleanup = null;
    themeTimeCleanup = null;
    const mode = state.settings?.theme_auto_mode || "off";
    if (mode === "off") return;

    const applyTheme = (next, source) => {
      const cur = document.documentElement.dataset.theme;
      if (next === cur) return;
      document.documentElement.dataset.theme = next;
      localStorage.setItem("moments_theme", next);
      renderThemeBtn();
      if (source === "system") toast(next === "dark" ? "已跟随系统切换到深色模式" : "已跟随系统切换到浅色模式");
      else toast(next === "dark" ? "已进入夜晚模式" : "已进入白天模式");
    };

    if (mode === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyTheme(mq.matches ? "dark" : "light", "system");
      mq.addEventListener("change", handler);
      themeMediaCleanup = () => mq.removeEventListener("change", handler);
      // 立即执行一次，确保当前状态正确
      handler();
    } else if (mode === "time") {
      const checkTime = () => {
        const start = parseInt(state.settings?.theme_dark_start || "18", 10);
        const end = parseInt(state.settings?.theme_dark_end || "6", 10);
        const now = new Date().getHours();
        // 跨天逻辑：start > end 时（如 18-6），深色时段为 start-23 和 0-end
        const isDark = start > end ? (now >= start || now < end) : (now >= start && now < end);
        applyTheme(isDark ? "dark" : "light", "time");
      };
      // 每分钟检查一次
      const timer = setInterval(checkTime, 60000);
      themeTimeCleanup = () => clearInterval(timer);
      // 立即执行一次
      checkTime();
    }
  }

  function renderThemeBtn() {
    const cur = document.documentElement.dataset.theme;
    themeToggle.innerHTML = svgIcon(cur === "dark" ? "sun" : "moon", 18);
    themeToggle.title = cur === "dark" ? t("common.theme_light") : t("common.theme_dark");
  }
  themeToggle.addEventListener("click", () => {
    const cur = document.documentElement.dataset.theme;
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("moments_theme", next);
    renderThemeBtn();
  });
  renderThemeBtn();

  /* ================= 站内搜索弹层 ================= */

  const searchBtn = document.getElementById("searchBtn");
  const searchOverlay = document.getElementById("searchOverlay");
  const searchInput = document.getElementById("searchInput");
  const searchClear = document.getElementById("searchClear");
  const searchResults = document.getElementById("searchResults");
  let searchTimer = null;
  let searchItems = []; // {href, external} 与结果 DOM 顺序对齐
  let searchActive = -1;

  function openSearch(prefill) {
    if (prefill != null) searchInput.value = prefill;
    searchOverlay.hidden = false;
    requestAnimationFrame(() => { searchInput.focus(); searchInput.select(); });
    if (searchInput.value.trim()) runSearch(); else renderSearchEmpty();
  }
  function closeSearch() {
    if (searchOverlay.hidden) return;
    searchOverlay.hidden = true;
    searchActive = -1;
  }
  function highlight(q, text) {
    const safe = esc(text || "");
    if (!q) return safe;
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    return safe.replace(re, m => `<mark>${m}</mark>`);
  }
  function renderSearchEmpty() {
    searchItems = []; searchActive = -1;
    searchResults.innerHTML = `<div class="search-empty">${t("search.input_hint")}</div>`;
  }
  function renderSearchLoading() {
    searchResults.innerHTML = `<div class="search-empty">${t("search.loading")}</div>`;
  }
  function renderSearchResults(data) {
    const q = data.query || "";
    const feedHref = "/?q=" + encodeURIComponent(q);
    const groups = [
      { key: "posts", label: t("search.tab_posts"), icon: "file-text", more: !!data.posts_more, moreHref: "/posts",
        list: (data.posts || []).map(p => ({ title: p.title, sub: p.excerpt, href: "/post/" + encodeURIComponent(p.slug) })) },
      { key: "moments", label: t("search.tab_moments"), icon: "message-circle", more: !!data.moments_more, moreHref: feedHref,
        list: (data.moments || []).map(m => ({ title: m.content || t("search.no_text"), sub: m.location ? "📍 " + m.location : m.created_at?.slice(0, 10) || "", href: feedHref })) },
      { key: "friends", label: t("search.tab_friends"), icon: "link", more: !!data.friends_more, moreHref: "/links",
        list: (data.friends || []).map(f => ({ title: f.name, sub: f.description || f.url, href: f.url || "/links", external: !!f.url })) },
    ].filter(g => g.list.length || g.more);
    if (!groups.length) {
      searchItems = []; searchActive = -1;
      searchResults.innerHTML = `<div class="search-empty">${t("search.no_result", { q: esc(q) })}</div>`;
      return;
    }
    searchItems = [];
    let html = "";
    for (const g of groups) {
      if (!g.list.length) continue;
      html += `<div class="search-group"><div class="search-group-title">${svgIcon(g.icon, 14)} ${esc(g.label)} · ${g.list.length}${g.more ? "+" : ""}</div>`;
      for (const it of g.list) {
        const idx = searchItems.length;
        searchItems.push({ href: it.href, external: it.external });
        html += `<a class="search-item" data-search-idx="${idx}" href="${esc(it.href)}"${it.external ? ' target="_blank" rel="noopener"' : ""}>
          <div class="search-item-main"><div class="search-item-title">${highlight(q, it.title)}</div>${it.sub ? `<div class="search-item-sub">${highlight(q, it.sub)}</div>` : ""}</div>
          ${it.external ? '<span class="search-item-ext">↗</span>' : ""}
        </a>`;
      }
      if (g.more) {
        html += `<a class="search-more" href="${esc(g.moreHref)}" data-search-more>${t("search.more", { name: esc(g.label) })}</a>`;
      }
      html += `</div>`;
    }
    html += `<div class="search-total">${t("search.total", { n: data.total })}</div>`;
    searchResults.innerHTML = html;
    searchActive = -1;
  }
  async function runSearch() {
    const q = searchInput.value.trim();
    searchClear.hidden = !q;
    if (!q) { renderSearchEmpty(); return; }
    if (searchTimer) clearTimeout(searchTimer);
    renderSearchLoading();
    searchTimer = setTimeout(async () => {
      try {
        const data = await api("/api/search?q=" + encodeURIComponent(q));
        if (searchOverlay.hidden || searchInput.value.trim() !== q) return; // 已关闭或又改了词
        renderSearchResults(data);
      } catch (e) {
        if (!searchOverlay.hidden) searchResults.innerHTML = `<div class="search-empty">${esc(e.message || t("search.failed"))}</div>`;
      }
    }, 220);
  }
  function setSearchActive(delta) {
    const n = searchItems.length;
    if (!n) return;
    searchActive = (searchActive + delta + n) % n;
    const els = searchResults.querySelectorAll(".search-item");
    els.forEach((el, i) => el.classList.toggle("is-active", i === searchActive));
    els[searchActive]?.scrollIntoView({ block: "nearest" });
  }

  searchBtn?.addEventListener("click", () => openSearch());
  searchOverlay.addEventListener("click", e => {
    if (e.target.closest("[data-search-close]")) closeSearch();
    const more = e.target.closest("[data-search-more]");
    if (more) { e.preventDefault(); const href = more.getAttribute("href"); closeSearch(); if (href) navigate(href); return; }
    const item = e.target.closest(".search-item");
    if (item) {
      e.preventDefault();
      const idx = Number(item.dataset.searchIdx);
      const it = searchItems[idx];
      closeSearch();
      if (it.external) window.open(it.href, "_blank", "noopener");
      else navigate(it.href);
    }
  });
  searchInput.addEventListener("input", runSearch);
  searchClear.addEventListener("click", () => { searchInput.value = ""; searchInput.focus(); runSearch(); });
  searchInput.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSearchActive(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSearchActive(-1); }
    else if (e.key === "Enter") {
      if (searchActive >= 0) {
        e.preventDefault();
        const it = searchItems[searchActive];
        if (it) { closeSearch(); if (it.external) window.open(it.href, "_blank", "noopener"); else navigate(it.href); }
      }
    } else if (e.key === "Escape") { e.preventDefault(); closeSearch(); }
  });
  // 快捷键：Ctrl/Cmd+K 或 斜杠 唤起；Esc 关闭
  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openSearch(); return; }
    if (e.key === "Escape") { if (!searchOverlay.hidden) { e.preventDefault(); closeSearch(); } return; }
    if (e.key === "/" && !searchOverlay.hidden && !/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName || "")) {
      e.preventDefault(); openSearch();
    }
  });

  /* ================= 移动端汉堡菜单 ================= */

  const topbarEl = document.querySelector(".topbar");
  const menuToggle = document.getElementById("menuToggle");
  const mobileMenu = document.getElementById("mobileMenu");

  function closeMobileMenu() {
    if (!topbarEl.classList.contains("menu-open")) return;
    topbarEl.classList.remove("menu-open");
    menuToggle?.setAttribute("aria-expanded", "false");
    menuToggle?.setAttribute("aria-label", t("common.open_menu"));
  }
  function openMobileMenu() {
    topbarEl.classList.add("menu-open");
    menuToggle?.setAttribute("aria-expanded", "true");
    menuToggle?.setAttribute("aria-label", t("common.close_menu"));
  }

  menuToggle.addEventListener("click", e => {
    e.stopPropagation();
    topbarEl.classList.contains("menu-open") ? closeMobileMenu() : openMobileMenu();
  });
  // 点导航链接（SPA 切换）后收起
  mobileMenu.addEventListener("click", e => {
    if (e.target.closest("a[href]")) closeMobileMenu();
  });
  // 点菜单外区域收起
  document.addEventListener("click", e => {
    if (topbarEl.classList.contains("menu-open") && !e.target.closest(".topbar")) closeMobileMenu();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeMobileMenu();
  });
  // 拉宽到桌面断点时收起，避免状态残留
  window.addEventListener("resize", () => {
    if (window.innerWidth > 768) closeMobileMenu();
  });
  // SPA 前进/后退时收起
  window.addEventListener("popstate", closeMobileMenu);

  /* ================= 全局事件委托 ================= */

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && modalRoot.innerHTML) closeModal();
  });

  document.addEventListener("click", async e => {
    const btn = e.target.closest("[data-nav]");
    if (!btn || !btn.closest(".admin-area")) return; // 桌面顶栏与移动菜单共用同一委托
    closeMobileMenu();
    const nav = btn.dataset.nav;
    if (nav === "login") openLogin();
    else if (nav === "new-moment") openMomentComposer();
    else if (nav === "new-post") openPostEditor(null);
    else if (nav === "logout") {
      try {
        await api("/api/admin/logout", { method: "POST" });
      } catch (_) {}
      state.admin = false;
      renderAdminArea();
      if (location.pathname === state.adminPath || location.pathname === "/admin") {
        navigate("/", { replace: true });
      } else {
        route();
      }
      toast("已退出");
    }
  });

  app.addEventListener("click", async e => {
    /* ---------- 后台入口：随机生成秘密路径 ---------- */
    const genPathBtn = e.target.closest("[data-gen-path]");
    if (genPathBtn) {
      const rnd = Array.from({ length: 8 }, () =>
        "abcdefghijkmnpqrstuvwxyz23456789"[Math.floor(Math.random() * 32)]
      ).join("");
      const input = genPathBtn.closest("[data-adminpath-form]")?.querySelector('input[name="admin_path"]');
      if (input) {
        input.value = "/" + rnd;
        const msg = input.closest("[data-adminpath-form]")?.querySelector("[data-adminpath-msg]");
        if (msg) {
          msg.textContent = "已生成随机路径，确认无误后点击「更新入口路径」";
          msg.style.color = "var(--anzhiyu-secondtext)";
        }
      }
      return;
    }
    /* ---------- 后台页 ---------- */
    const tabBtn = e.target.closest("[data-admin-tab]");
    if (tabBtn) {
      state.adminTab = tabBtn.dataset.adminTab;
      renderAdmin();
      return;
    }
    const adminAct = e.target.closest("[data-admin-act]");
    if (adminAct) {
      const act = adminAct.dataset.adminAct;
      if (act === "unlock") {
        openLogin();
        return;
      }
      if (act === "new-moment") {
        openMomentComposer();
        return;
      }
      if (act === "new-post") {
        openPostEditor(null);
        return;
      }
      if (act === "del-moment") {
        const id = Number(adminAct.dataset.id);
        if (!confirm("确定删除这条说说？图片和视频会一起删除")) return;
        try {
          await api(`/api/moments/${id}`, { method: "DELETE" });
          toast("已删除");
          renderAdminMoments(document.getElementById("adminPanel"));
        } catch (err) {
          toast(err.message);
        }
        return;
      }
      if (act === "view-moment") {
        const id = Number(adminAct.dataset.id);
        try {
          const m = await api(`/api/moments/${id}?voter_id=${encodeURIComponent(state.voterId)}`);
          openMomentView(m);
        } catch (err) {
          toast(err.message);
        }
        return;
      }
      if (act === "edit-moment") {
        const id = Number(adminAct.dataset.id);
        try {
          const m = await api(`/api/moments/${id}?voter_id=${encodeURIComponent(state.voterId)}`);
          openMomentComposer(m);
        } catch (err) {
          toast(err.message);
        }
        return;
      }
      if (act === "pin-post") {
        const id = Number(adminAct.dataset.id);
        const nextPinned = adminAct.dataset.pinned === "1" ? 0 : 1;
        adminAct.disabled = true;
        try {
          const res = await api(`/api/posts/${id}/pin`, { method: "POST", body: { pinned: nextPinned } });
          toast(res.message || (nextPinned ? "已置顶" : "已取消置顶"));
          renderAdminPosts(document.getElementById("adminPanel"));
        } catch (err) {
          adminAct.disabled = false;
          toast(err.message);
        }
        return;
      }
      if (act === "publish-post") {
        const id = Number(adminAct.dataset.id);
        adminAct.disabled = true;
        try {
          const res = await api(`/api/posts/${id}/publish`, { method: "POST", body: { status: "published" } });
          toast(res.message || "已发布");
          renderAdminPosts(document.getElementById("adminPanel"));
        } catch (err) {
          adminAct.disabled = false;
          toast(err.message);
        }
        return;
      }
      if (act === "del-post") {
        const id = Number(adminAct.dataset.id);
        if (!confirm("确定删除这篇文章？")) return;
        try {
          await api(`/api/posts/${id}`, { method: "DELETE" });
          toast("已删除");
          renderAdminPosts(document.getElementById("adminPanel"));
        } catch (err) {
          toast(err.message);
        }
        return;
      }
      if (act === "edit-post") {
        try {
          const p = await api("/api/posts/" + encodeURIComponent(adminAct.dataset.slug) + "?preview=1");
          openPostEditor(p);
        } catch (err) {
          toast(err.message);
        }
        return;
      }
      if (act === "del-comment") {
        const cid = Number(adminAct.dataset.cid);
        if (!confirm("确定删除这条评论？")) return;
        try {
          await api(`/api/admin/comments/${cid}`, { method: "DELETE" });
          toast("已删除");
          renderAdminComments(document.getElementById("adminPanel"));
        } catch (err) {
          toast(err.message);
        }
        return;
      }
      if (act === "reply-comment") {
        // 后台直接回复：展开该行回复框，收起其他已展开的
        const cid = adminAct.dataset.cid;
        const panel = document.getElementById("adminPanel");
        panel?.querySelectorAll("[data-reply-box]").forEach(b => { if (b.dataset.replyBox !== cid) b.hidden = true; });
        const box = panel?.querySelector(`[data-reply-box="${cid}"]`);
        if (box) {
          box.hidden = !box.hidden;
          if (!box.hidden) box.querySelector("textarea")?.focus();
        }
        return;
      }
      if (act === "cancel-reply") {
        document.getElementById("adminPanel")?.querySelector(`[data-reply-box="${adminAct.dataset.cid}"]`)?.setAttribute("hidden", "");
        return;
      }
      if (act === "send-reply") {
        const cid = Number(adminAct.dataset.cid);
        const box = document.getElementById("adminPanel")?.querySelector(`[data-reply-box="${adminAct.dataset.cid}"]`);
        const ta = box?.querySelector("textarea");
        const content = (ta?.value || "").trim();
        if (!content) { toast("请输入回复内容"); return; }
        adminAct.disabled = true;
        try {
          await api(`/api/admin/comments/${cid}/reply`, { method: "POST", body: { content } });
          toast("回复成功，已通知对方");
          renderAdminComments(document.getElementById("adminPanel"));
        } catch (err) {
          toast(err.message);
          adminAct.disabled = false;
        }
        return;
      }
      if (act === "edit-comment") {
        const cid = Number(adminAct.dataset.cid);
        const content = adminAct.dataset.content || "";
        let images = [];
        try { images = JSON.parse(adminAct.dataset.images || "[]"); } catch { images = []; }
        if (!Array.isArray(images)) images = [];
        openCommentEditor(cid, content, images);
        return;
      }
      return;
    }

    // banner 发布按钮 / 解锁 / 自定义链接（后台设置横幅按钮 URL 时）
    const fab = e.target.closest('[data-act="publish-fab"]');
    if (fab) {
      if (state.admin) openMomentComposer();
      else openLogin();
      return;
    }
    const bannerLink = e.target.closest('[data-act="banner-link"]');
    if (bannerLink) {
      const url = bannerLink.dataset.url || "";
      if (/^https?:\/\//i.test(url)) {
        if ((state.settings.banner_button_target || "_blank") === "_self") location.href = url;
        else window.open(url, "_blank", "noopener");
      } else if (url.startsWith("/")) navigate(url);
      return;
    }
    const unlockBtn = e.target.closest('[data-act="unlock"]');
    if (unlockBtn) {
      openLogin();
      return;
    }

    const act = e.target.closest("[data-act]");
    if (!act) return;
    const type = act.dataset.act;

    // 评论弹窗的关闭
    if (type === "clear-target") {
      state.commentTarget = null;
      closeModal();
      return;
    }
    if (type === "new-post") {
      openPostEditor(null);
      return;
    }

    // 即刻卡片操作
    const card = e.target.closest(".bber-item");
    if (!card) return;
    const id = Number(card.dataset.id);

    if (type === "like") {
      const likeEl = card.querySelector(".bber-like");
      const liked = likeEl.classList.contains("is-liked");
      const countEl = likeEl.querySelector(".bber-like-count");
      const current = countEl ? Number(countEl.textContent) || 0 : 0;

      const paintLike = (isLiked, count) => {
        likeEl.classList.toggle("is-liked", isLiked);
        const sv = likeEl.querySelector("svg");
        if (sv) sv.outerHTML = svgIcon(isLiked ? "heartFill" : "heartLine", 18);
        let c = likeEl.querySelector(".bber-like-count");
        if (count > 0) {
          if (!c) {
            likeEl.insertAdjacentHTML("beforeend", `<span class="bber-like-count"></span>`);
            c = likeEl.querySelector(".bber-like-count");
          }
          c.textContent = String(count);
        } else if (c) c.remove();
      };

      // 乐观更新
      paintLike(!liked, !liked ? current + 1 : Math.max(0, current - 1));
      try {
        const data = await api(`/api/moments/${id}/like`, { method: "POST", body: { voter_id: state.voterId } });
        paintLike(data.liked, data.like_count);
        const m = state.feed.find(x => x.id === id);
        if (m) {
          m.liked = data.liked;
          m.like_count = data.like_count;
        }
      } catch (err) {
        // 回滚
        paintLike(liked, current);
        toast(err.message);
      }
      return;
    }

    if (type === "reply") {
      const m = state.feed.find(x => x.id === id);
      if (m) {
        openCommentModal({
          ctype: "moment",
          cid: m.id,
          quote: plainText(m.content, 80) || t("feed.moment_hash", { id: m.id }),
          comment_count: m.comment_count,
          comments: m.comments,
        });
      }
      return;
    }

    if (type === "del") {
      if (!confirm("确定删除这条动态？图片和视频会一起删除")) return;
      try {
        await api(`/api/moments/${id}`, { method: "DELETE" });
        state.feed = state.feed.filter(x => x.id !== id);
        const li = app.querySelector(`.bber-item[data-id="${id}"]`);
        if (li) {
          disposeVideos(li);
          li.remove();
          feedEls = Array.from(document.getElementById("waterfall").children);
          syncFeedRO(); // 删除后重新观察现存卡片
          layout();
        }
        if (state.commentTarget && state.commentTarget.cid === id && state.commentTarget.ctype !== "post") {
          state.commentTarget = null;
        }
        toast("已删除");
      } catch (err) {
        toast(err.message);
      }
    }
  });

  app.addEventListener("submit", async e => {
    /* ---------- 后台：站点设置 ---------- */
    const settingsForm = e.target.closest("[data-settings-form]");
    if (settingsForm) {
      e.preventDefault();
      const fd = new FormData(settingsForm);
      const patch = {};
      ["site_title", "nav_feeds_name", "essay_tips", "essay_title", "essay_subtitle", "essay_button_text", "banner_button_url", "banner_button_target", "banner_bg_image", "banner_bg_mode", "banner_bg_source", "banner_bg_interval", "site_bg_mask", "site_bg_card", "site_bg_footer", "site_bg_blur", "brand_avatar", "author_name", "author_avatar", "post_avatar", "nav_links", "footer_text", "footer_run_since", "theme_auto_mode", "theme_dark_start", "theme_dark_end", "feed_page_size", "video_default_poster", "site_domain", "r2_domain", "storage_mode", "b2_endpoint", "b2_bucket", "b2_key_id", "b2_app_key", "b2_domain", "site_icon", "random_avatar_api", "random_avatar_imgtype", "qq_nick_mode", "apihz_id", "apihz_key", "qq_ckqq", "qq_skey", "qq_pskey", "qq_keepalive_interval", "about_greeting", "about_greeting_sub", "about_avatar", "about_signature", "about_bio", "about_stats", "about_timeline", "about_bigstats", "about_contacts", "about_qr_text", "about_qr_amounts", "links_categories", "comment_emoji_owo_url", "reward_qrcode", "reward_text", "friends_quota_blog", "friends_quota_community", "friends_quota_tech"].forEach(k => {
        // 外观/媒体拆分 Tab 后，只提交当前表单实际包含的字段，
        // 否则表单里不存在的字段会以空串提交，后端视为"恢复默认"，导致跨 Tab 互相清空
        if (!fd.has(k)) return;
        patch[k] = String(fd.get(k) || "").trim();
      });
      // about_enabled 复选框：勾选=启用（表单含该字段时才提交，避免跨 Tab 覆盖）
      const aboutEnabledEl = settingsForm.querySelector('[name="about_enabled"]');
      if (aboutEnabledEl) patch.about_enabled = aboutEnabledEl.checked;
      // 顶栏入口独立开关：关于/友链/相册
      const linksEnabledEl = settingsForm.querySelector('[name="links_enabled"]');
      if (linksEnabledEl) patch.links_enabled = linksEnabledEl.checked;
      const photosEnabledEl = settingsForm.querySelector('[name="photos_enabled"]');
      if (photosEnabledEl) patch.photos_enabled = photosEnabledEl.checked;
      // 打赏开关
      const rewardEnabledEl = settingsForm.querySelector('[name="reward_enabled"]');
      if (rewardEnabledEl) patch.reward_enabled = rewardEnabledEl.checked;
      // 全站背景图开关
      const siteBgEl2 = settingsForm.querySelector('[name="site_bg_enabled"]');
      if (siteBgEl2) patch.site_bg_enabled = siteBgEl2.checked;
      // 友圈功能开关
      const friendsEnabledEl = settingsForm.querySelector('[name="friends_enabled"]');
      if (friendsEnabledEl) patch.friends_enabled = friendsEnabledEl.checked;
      // 友圈定时抓取开关
      const friendsFetchEl = settingsForm.querySelector('[name="friends_fetch_enabled"]');
      if (friendsFetchEl) patch.friends_fetch_enabled = friendsFetchEl.checked;
      // 主题自动切换模式（下拉选择，非布尔）
      // 主题时间范围显隐
      const themeModeEl = settingsForm.querySelector('[name="theme_auto_mode"]');
      if (themeModeEl) {
        const timeRange = settingsForm.querySelector('[data-theme-time-range]');
        if (timeRange) timeRange.style.display = themeModeEl.value === "time" ? "" : "none";
      }
      const btn = settingsForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        const s = await api("/api/admin/settings", { method: "PUT", body: patch });
        state.settings = s;
        applySettings();
        setupThemeAutoFollow();
        toast("设置已保存");
      } catch (err) {
        toast(err.message);
      } finally {
        btn.disabled = false;
      }
      return;
    }

    /* ---------- 后台：后台入口路径（安全） ---------- */
    const pathForm = e.target.closest("[data-adminpath-form]");
    if (pathForm) {
      e.preventDefault();
      const msg = pathForm.querySelector("[data-adminpath-msg]");
      msg.textContent = "";
      const newPath = pathForm.admin_path.value.trim().toLowerCase();
      if (!/^(\/admin|\/[a-z0-9][a-z0-9-]{2,38})$/i.test(newPath)) {
        msg.textContent = "格式非法：需为 /admin 或 / 开头加 3~39 位字母数字/短横线";
        msg.style.color = "#f56c6c";
        return;
      }
      if (newPath === (state.adminPath || "").toLowerCase()) {
        msg.textContent = "与当前入口相同，无需修改";
        msg.style.color = "var(--anzhiyu-secondtext)";
        return;
      }
      if (!confirm(`后台入口将变更为：\n${location.origin}${newPath}\n\n旧地址立即失效，请确认已牢记新地址！`)) return;
      const btn = pathForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        const s = await api("/api/admin/settings", { method: "PUT", body: { admin_path: newPath } });
        if (s.admin_path) setAdminPath(s.admin_path);
        toast("入口已更新：" + (s.admin_path || newPath));
        // 立即跳到新入口（旧路径此刻已 404）
        if (location.pathname !== (s.admin_path || newPath)) {
          navigate(s.admin_path || newPath, { replace: true });
        }
      } catch (err) {
        msg.textContent = err.message;
        msg.style.color = "#f56c6c";
      } finally {
        btn.disabled = false;
      }
      return;
    }

    /* ---------- 后台：多语言设置 ---------- */
    const i18nForm = e.target.closest("[data-i18n-form]");
    if (i18nForm) {
      e.preventDefault();
      const langs = [...i18nForm.querySelectorAll('[name="i18n_langs"]:checked')].map(el => el.value);
      const def = i18nForm.querySelector('[name="i18n_default"]').value;
      // 默认语言必须在开放列表中（服务端也会兜底，前端提前保证）
      if (langs.indexOf(def) < 0) langs.unshift(def);
      const patch = {
        i18n_enabled: i18nForm.querySelector('[name="i18n_enabled"]').checked,
        i18n_default: def,
        i18n_langs: langs.join(","),
        i18n_auto_detect: i18nForm.querySelector('[name="i18n_auto_detect"]').checked,
        i18n_content_translate: i18nForm.querySelector('[name="i18n_content_translate"]').checked,
        baidu_translate_appid: i18nForm.querySelector('[name="baidu_translate_appid"]').value.trim(),
        baidu_translate_key: i18nForm.querySelector('[name="baidu_translate_key"]').value.trim(),
      };
      const btn = i18nForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        const s = await api("/api/admin/settings", { method: "PUT", body: patch });
        state.settings = s;
        applySettings();
        if (window.I18N) {
          window.I18N.configure(s);
          window.I18N.applyStatic(document);
          renderLangSwitcher();
        }
        toast("设置已保存");
      } catch (err) {
        toast(err.message);
      } finally {
        btn.disabled = false;
      }
      return;
    }

    /* ---------- 后台：音乐播放器设置 ---------- */
    const musicForm = e.target.closest("[data-music-settings-form]");
    if (musicForm) {
      e.preventDefault();
      const fd = new FormData(musicForm);
      const patch = {
        music_enable: musicForm.querySelector('[name="music_enable"]').checked,
        music_autoplay: musicForm.querySelector('[name="music_autoplay"]').checked,
        music_preload: musicForm.querySelector('[name="music_preload"]').checked,
        music_collapsed: musicForm.querySelector('[name="music_collapsed"]').checked,
        music_volume: String(fd.get("music_volume") || "0.7"),
        music_playlist_id: String(fd.get("music_playlist_id") || "").trim(),
        music_custom_playlist: String(fd.get("music_custom_playlist") || "").trim(),
      };
      const btn = musicForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        const s = await api("/api/admin/settings", { method: "PUT", body: patch });
        state.settings = s;
        applySettings();
        initMusicPlayer();
        toast("音乐设置已保存");
      } catch (err) {
        toast(err.message);
      } finally {
        btn.disabled = false;
      }
      return;
    }

    /* ---------- 后台：中央音乐服务配置 ---------- */
    const musicApiForm = e.target.closest("[data-music-api-form]");
    if (musicApiForm) {
      e.preventDefault();
      const fd = new FormData(musicApiForm);
      const patch = {
        music_api_url: String(fd.get("music_api_url") || "").trim(),
        music_api_key: String(fd.get("music_api_key") || "").trim(),
      };
      const btn = musicApiForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        const s = await api("/api/admin/settings", { method: "PUT", body: patch });
        state.settings = s;
        toast("音乐服务配置已保存");
      } catch (err) {
        toast(err.message);
      } finally {
        btn.disabled = false;
      }
      return;
    }

    /* ---------- 后台：AI 评论机器人设置 ---------- */
    const aiForm = e.target.closest("[data-ai-settings-form]");
    if (aiForm) {
      e.preventDefault();
      const fd = new FormData(aiForm);
      const patch = {
        ai_reply_enabled: aiForm.querySelector('[name="ai_reply_enabled"]').checked,
        ai_bot_name: String(fd.get("ai_bot_name") || "").trim(),
        ai_bot_avatar: String(fd.get("ai_bot_avatar") || "").trim(),
        ai_text_model: String(fd.get("ai_text_model") || "").trim(),
      };
      if (!patch.ai_bot_name) return toast("请填写机器人昵称");
      const btn = aiForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        const s = await api("/api/admin/settings", { method: "PUT", body: patch });
        state.settings = s;
        applySettings();
        toast("AI 设置已保存");
      } catch (err) {
        toast(err.message);
      } finally {
        btn.disabled = false;
      }
      return;
    }

    /* ---------- 后台：QQ 昵称 API（已合并到站点 → 外观 → QQ 设置，此表单不再存在） ---------- */

    /* ---------- 后台：修改管理密码 ---------- */
    const passwordForm = e.target.closest("[data-password-form]");
    if (passwordForm) {
      e.preventDefault();
      const oldPwd = passwordForm.old_password.value;
      const newPwd = passwordForm.new_password.value;
      const confirmPwd = passwordForm.confirm_password.value;
      if (newPwd.length < 6) return toast("新密码至少 6 位");
      if (newPwd !== confirmPwd) return toast("两次输入的新密码不一致");
      const pwdBtn = passwordForm.querySelector('button[type="submit"]');
      pwdBtn.disabled = true;
      try {
        await api("/api/admin/password", {
          method: "POST",
          body: { old_password: oldPwd, new_password: newPwd },
        });
        passwordForm.reset();
        toast("密码已修改");
      } catch (err) {
        toast(err.message);
      } finally {
        pwdBtn.disabled = false;
      }
      return;
    }
  });

  /* ---------- 评论区点击委托：一键回复 / 楼中楼折叠 / 顶级评论折叠 / 取消回复 ---------- */
  document.addEventListener("click", e => {
    // 评论时间戳锚点：跳转到视频对应时间点
    const tsLink = e.target.closest?.("a.comment-timestamp[data-ts]");
    if (tsLink) {
      e.preventDefault();
      const sec = parseTimestamp(tsLink.dataset.ts);
      // 在当前文章页找第一个视频（Artplayer 或原生 video）
      const artBox = document.querySelector(".essay-media-video--art");
      const nativeVideo = document.querySelector("video.essay-media-video");
      if (artBox && artBox._art) {
        artBox._art.video.currentTime = sec;
        artBox._art.play();
        artBox.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (nativeVideo) {
        nativeVideo.currentTime = sec;
        nativeVideo.play().catch(() => {});
        nativeVideo.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        toast(t("common.video_not_found"));
      }
      return;
    }
    const btn = e.target.closest?.("button");
    if (!btn) return;
    if (btn.hasAttribute("data-replies-toggle")) {
      const id = Number(btn.dataset.repliesToggle);
      if (commentUi.expandedThreads.has(id)) commentUi.expandedThreads.delete(id);
      else commentUi.expandedThreads.add(id);
      rerenderCommentList();
      return;
    }
    if (btn.hasAttribute("data-comments-toggle")) {
      commentUi.showAll = !commentUi.showAll;
      rerenderCommentList();
      return;
    }
    if (btn.classList.contains("comment-reply-btn")) {
      startCommentReply(Number(btn.dataset.replyRoot), btn.dataset.replyName || "");
      return;
    }
    if (btn.hasAttribute("data-cancel-reply")) {
      const form = btn.closest("[data-comment-form]");
      // 取消回复时移除自动带入的 @昵称 前缀
      if (commentUi.replyName && form) {
        const prefix = `@${commentUi.replyName} `;
        if (form.content.value.startsWith(prefix)) form.content.value = form.content.value.slice(prefix.length);
      }
      resetReplyTarget(form);
    }
    // 随机评论
    if (btn.hasAttribute("data-random-comment")) {
      const form = btn.closest("[data-comment-form]");
      if (form?.content) fillRandomComment(form.content);
    }
  });

  /* ---------- 评论提交：监听 document（评论弹窗渲染在 #app 外的 #modalRoot 中） ---------- */
  document.addEventListener("submit", async e => {
    const form = e.target.closest?.("[data-comment-form]");
    if (!form) return;
    e.preventDefault();
    const target = state.commentTarget;
    if (!target) return toast(t("comment.select_target_first"));
    const ctype = target.ctype === "post" ? "post" : "moment";
    const cid = Number(target.cid);
    const nickname = form.nickname.value.trim();
    const email = form.email?.value.trim() || "";
    const content = form.content.value.trim();
    const website = form.website?.value.trim() || "";
    if (!nickname) return toast(t("comment.nickname_required"));
    if (!email) return toast(t("comment.email_required"));
    if (!content) return toast(t("comment.empty_tip"));
    const qq = (form.dataset.qq || "").trim();
    const parentId = Number(form.dataset.parentId) || 0;
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const endpoint = ctype === "post"
        ? `/api/posts/${encodeURIComponent(target.slug)}/comments`
        : `/api/moments/${cid}/comments`;
      const cm = await api(endpoint, {
        method: "POST",
        body: {
          nickname,
          content,
          qq: QQ_NUM_RE.test(qq) ? qq : "",
          email,
          avatar_url: form.dataset.avatar || "",
          website,
          parent_id: parentId,
          images: getCommentImages(form),
          notify_reply: !!(form.elements["notify_reply"] && form.elements["notify_reply"].checked),
        },
      });
      localStorage.setItem("moments_nick", nickname);
      localStorage.setItem("moments_email", email);
      // 缓存头像与 QQ，重开评论弹窗时直接回填
      if (form.dataset.avatar) localStorage.setItem("moments_avatar", form.dataset.avatar);
      if (QQ_NUM_RE.test(qq)) localStorage.setItem("moments_qq", qq);
      // 仅保存合法且非占位的网址
      if (website && !EXAMPLE_URL_RE.test(website)) localStorage.setItem("moments_website", website);
      else localStorage.removeItem("moments_website");
      form.content.value = "";
      setCommentImages(form, []);
      resetReplyTarget(form);
      // 写入缓存并重整棵评论树（保证楼中楼归属/折叠计数正确）
      if (!Array.isArray(target.comments)) target.comments = [];
      target.comments.push(cm);
      if (parentId) commentUi.expandedThreads.add(parentId); // 发回复后自动展开所在楼
      rerenderCommentList();
      // 新回复滚动到可视区域
      if (parentId) {
        const thread = document.querySelector(`[data-comment-list] [data-thread-id="${parentId}"] .comment-replies-list`);
        thread?.lastElementChild?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
      target.comment_count = (target.comment_count || 0) + 1;
      if (ctype === "moment") {
        const card = app.querySelector(`.bber-item[data-id="${cid}"] .bber-reply`);
        if (card) updateReplyCount(card, target.comment_count);
        const m = state.feed.find(x => x.id === cid);
        if (m) m.comment_count = target.comment_count;
      } else {
        updateArticleCommentCount(target.comment_count);
      }
      // @机器人：提示并轻量轮询异步生成的 AI 回复
      const botName = state.settings.ai_bot_name || "小J";
      if (state.settings?.ai_reply_enabled && content.includes(`@${botName}`)) {
        toast(t("comment.ai_called", { name: botName }));
        pollAiReplies(target);
      }
    } catch (err) {
      toast(err.message);
    } finally {
      btn.disabled = false;
    }
  });

  /* ================= 路由（History API 真实路径，利于 SEO） ================= */

  /** 旧 hash 链接（#/post/x、#/photos…）→ 真实路径；返回 null 表示无 hash 需处理 */
  function legacyHashToPath() {
    const h = location.hash || "";
    if (!h.startsWith("#/")) return null;
    const rest = h.slice(2);
    const main = rest.split("?")[0];
    const query = rest.includes("?") ? "?" + rest.slice(rest.indexOf("?") + 1) : "";
    const map = { "": "/", posts: "/posts", photos: "/photos", admin: "/admin" };
    if (main in map) return map[main] + (map[main] === "/" ? "" : query);
    if (main.startsWith("post/")) return "/" + main + query;
    return null;
  }

  /** 编程式导航 */
  function navigate(url, opts = {}) {
    if (location.pathname + location.search === url) {
      window.scrollTo(0, 0);
      return;
    }
    history[opts.replace ? "replaceState" : "pushState"](null, "", url);
    route();
  }

  /** 拦截同站内部链接，无刷新跳转（外链/新窗口/下载/api/media 放行） */
  document.addEventListener("click", e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a || a.target === "_blank" || a.hasAttribute("download") || "noSpa" in a.dataset) return;
    let u;
    try { u = new URL(a.href, location.href); } catch { return; }
    if (u.origin !== location.origin) return;
    if (u.pathname.startsWith("/api/") || u.pathname.startsWith("/media/")) return;
    // 同页 hash 锚点（文章目录 #toc-N 等）：放行给浏览器原生/专门委托处理，
    // 否则 navigate(同路径) 会 window.scrollTo(0,0) 先回顶部再平滑下滑
    if (u.hash && u.pathname === location.pathname && u.search === location.search) return;
    e.preventDefault();
    navigate(u.pathname + u.search);
  });

  // 点击带 data-copy 的元素：复制其值/文本到剪贴板
  document.addEventListener("click", e => {
    const el = e.target.closest && e.target.closest("[data-copy]");
    if (!el) return;
    const text = el.getAttribute("data-copy") || el.textContent || "";
    const done = () => toast(t("common.link_copied"));
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => {
        const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta);
        ta.select(); try { document.execCommand("copy"); done(); } catch { toast(t("common.copy_failed")); } ta.remove();
      });
    }
  });

  /* ================= SEO meta 管理（客户端切换路由时同步） ================= */

  function upsertMeta(attr, key, content) {
    let el = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (content === undefined || content === null || content === "") {
      if (el) el.remove();
      return;
    }
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  }

  function setSeo(o) {
    const title = o.title || state.settings.site_title;
    document.title = title;
    upsertMeta("name", "description", o.description || "");
    upsertMeta("name", "robots", o.noindex ? "noindex,nofollow,noarchive" : "");
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = location.origin + o.path;
    const abs = src => (/^https?:\/\//i.test(src || "") ? src : src ? location.origin + src : "");
    const img = abs(o.image);
    [
      ["og:type", o.noindex ? "" : o.type || "website"],
      ["og:title", o.noindex ? "" : title],
      ["og:description", o.noindex ? "" : o.description || ""],
      ["og:url", o.noindex ? "" : location.origin + o.path],
      ["og:image", o.noindex ? "" : img],
    ].forEach(([k, v]) => upsertMeta("property", k, v));
    [
      ["twitter:card", o.noindex ? "" : img ? "summary_large_image" : "summary"],
      ["twitter:title", o.noindex ? "" : title],
      ["twitter:description", o.noindex ? "" : o.description || ""],
      ["twitter:image", o.noindex ? "" : img],
    ].forEach(([k, v]) => upsertMeta("name", k, v));
  }

  /** 404 空状态（访问已废弃的 /admin 等地址时显示，不暴露后台存在） */
  function renderNotFound() {
    state.activeView = "404";
    setSeo({ title: `${t("404.title")} · ${state.settings.site_title}`, path: location.pathname, noindex: true });
    app.innerHTML = `<div class="essay"><div class="posts-wrap"><div class="essay-empty">
      <span class="empty-ico">${svgIcon("search", 56)}</span><span>${t("404.title")}</span>
      <a class="btn" href="/">${t("404.back_home")}</a></div></div></div>`;
  }

  /* ================= 访问统计埋点（后台/管理员不计，由后端再兜底排除） ================= */
  const Analytics = (() => {
    let sid = "";
    try { sid = sessionStorage.getItem("ma_sid") || ""; } catch (_) {}
    if (!sid) {
      sid = "s_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      try { sessionStorage.setItem("ma_sid", sid); } catch (_) {}
    }
    // 会话级：首次进入的外部来源 + UTM
    let ref = "";
    try { ref = sessionStorage.getItem("ma_ref") || ""; } catch (_) {}
    if (ref === "" && document.referrer) {
      try {
        const rh = new URL(document.referrer).host;
        if (rh && rh !== location.host) { ref = document.referrer; sessionStorage.setItem("ma_ref", ref); }
      } catch (_) {}
    }
    const q = new URLSearchParams(location.search);
    const utm = {
      source: q.get("utm_source") || "",
      medium: q.get("utm_medium") || "",
      campaign: q.get("utm_campaign") || "",
    };

    let cur = null; // { id, enterAt }
    let visEnter = Date.now();
    let accum = 0;
    const elapsed = () => accum + (visEnter ? Date.now() - visEnter : 0);

    function leave() {
      if (!cur) return;
      const sec = Math.max(0, Math.round(elapsed() / 1000));
      const id = cur.id;
      cur = null;
      if (!id || sec <= 0) return;
      const payload = JSON.stringify({ id, seconds: sec });
      try {
        const blob = new Blob([payload], { type: "application/json" });
        if (navigator.sendBeacon) { navigator.sendBeacon("/api/analytics/leave", blob); return; }
      } catch (_) {}
      try { fetch("/api/analytics/leave", { method: "POST", body: payload, keepalive: true }); } catch (_) {}
    }

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { accum += Date.now() - visEnter; visEnter = 0; leave(); }
      else { visEnter = Date.now(); }
    });
    window.addEventListener("pagehide", leave);

    async function track(path) {
      if (path === state.adminPath || path === "/admin") return; // 后台页不统计
      if (state.admin) return; // 已登录管理员不统计（后端 cookie 再兜底）
      leave(); // 结算上一页
      accum = 0; visEnter = Date.now();
      try {
        const res = await fetch("/api/analytics/pv", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ path, title: document.title || "", referrer: ref, sid, ...utm }),
        });
        const j = await res.json();
        if (j && j.data && j.data.id) cur = { id: j.data.id, enterAt: Date.now() };
      } catch (_) {}
    }
    return { track };
  })();

  function route() {
    // 后台手机抽屉若曾锁定滚动，任何路由切换都解除，避免页面卡住
    document.body.style.overflow = "";
    // 兼容旧 hash 外链：静默替换为真实路径
    const legacy = legacyHashToPath();
    if (legacy && legacy !== location.pathname + location.search) {
      history.replaceState(null, "", legacy);
    }
    const path = location.pathname || "/";
    const search = location.search;
    // SSR 注入的后台入口信号："1"=有效入口，"0"=服务端判定 404，null=SPA 内导航无信号
    const entryMetaEl = document.querySelector('meta[name="x-admin-entry"]');
    const ssrEntry = entryMetaEl ? entryMetaEl.getAttribute("content") : null;
    // 首次部署且未设密码：渲染"设置初始密码"表单
    const setupMetaEl = document.querySelector('meta[name="x-admin-setup"]');
    const ssrSetup = setupMetaEl ? setupMetaEl.getAttribute("content") : null;
    // 后台路由（含秘密入口与 SSR 判定为后台的路径）：隐藏全站背景、恢复纯色，后台不玻璃化
    const isAdminRoute = path === state.adminPath || path === "/admin" || ssrEntry === "1";
    document.body.classList.toggle("site-bg-admin", isAdminRoute);
    document.querySelectorAll("[data-route]").forEach(a => {
      const key = a.dataset.route;
      const isActive =
        (key === "feed" && path === "/") ||
        (key === "posts" && (path === "/posts" || path.startsWith("/post/"))) ||
        (key === "photos" && path === "/photos") ||
        (key === "links" && (path === "/links" || path.startsWith("/links/"))) ||
        (key === "friends" && path === "/friends") ||
        (key === "about" && path === "/about") ||
        (key === "admin" && (path === state.adminPath || path === "/admin"));
      a.classList.toggle("active", isActive);
    });
    // 切换视图会整体覆盖 #app，先销毁时间线/文章里的 HLS 实例，
    // 否则视频元素随 DOM 丢弃后仍在后台拉 m3u8/ts 分片，累积耗 CPU/网络导致卡顿
    disposeVideos(app);
    // 清理文章悬浮目录（侧栏/FAB/抽屉），避免切页残留
    document.querySelectorAll("[data-toc-sidebar], [data-toc-fab], [data-toc-mask], [data-toc-drawer]").forEach(el => el.remove());
    syncBackTop();
    if (path === "/") {
      renderFeed();
    } else if (path === "/about") {
      renderAbout();
    } else if (path === "/links") {
      renderLinks();
    } else if (path === "/friends") {
      // 友圈功能关闭时按 404 处理（导航入口也已隐藏，这里是直接访问地址的兜底）
      if (state.settings.friends_enabled === false) renderNotFound();
      else renderFriends();
    } else if (path === "/links/apply") {
      renderLinksApply();
    } else if (path === "/posts") {
      renderPostList();
    } else if (path === "/photos") {
      renderPhotos();
    } else if (path.startsWith("/post/")) {
      const slug = decodeURIComponent(path.slice("/post/".length));
      const preview = state.admin && new URLSearchParams(search).get("preview") === "1";
      renderPostDetail(slug, preview);
    } else if (path === state.adminPath || ssrEntry === "1") {
      // 秘密后台入口（SPA 跳转靠本地记录的路径，硬加载靠 SSR meta 标记；
      // ssrEntry=1 仅由后端在 path===admin_path 时注入，故任意路径均适用）
      // 首次部署且未设密码：渲染设置初始密码表单，而非解锁页
      if (ssrSetup === "1" && !state.admin) {
        renderAdminSetup();
      } else {
        renderAdmin();
      }
    } else if (path === "/admin") {
      // 旧后台地址：以 SSR 信号为准，防止清缓存访客被前端画出解锁表单
      if (ssrEntry === "1") {
        if (ssrSetup === "1" && !state.admin) {
          renderAdminSetup();
        } else {
          renderAdmin();
        }
      } else if (ssrEntry === "0") {
        renderNotFound();
      } else if (state.admin && state.adminPath !== "/admin") {
        navigate(state.adminPath, { replace: true });
        return;
      } else if (state.adminPath === "/admin") {
        renderAdmin();
      } else {
        renderNotFound();
      }
    } else {
      navigate("/", { replace: true });
      return;
    }
    syncFab();
    Analytics.track(path);
    window.scrollTo(0, 0);
  }

  window.addEventListener("popstate", route);

  /* bfcache（往返缓存）恢复页面时 JS 不会重新执行，
     浏览器后退/前进返回本站会导致初始折叠丢失 —— 在此重新应用 */
  window.addEventListener("pageshow", event => {
    if (event.persisted) applyMusicSettings();
  });

  /* ================= 多语言（i18n） ================= */
  const I18N_LANGS_OK = ["zh-CN", "zh-TW", "en"];

  /** 顶栏语言切换器：地球按钮 + 下拉菜单（仅后台开启且开放语言≥2 时显示） */
  function renderLangSwitcher() {
    const box = document.getElementById("langSwitch");
    if (!box || !window.I18N) return;
    const enabled = !!(state.settings.i18n_enabled && window.I18N.enabled);
    const langs = String(state.settings.i18n_langs || "")
      .split(",")
      .map(s => s.trim())
      .filter(l => I18N_LANGS_OK.indexOf(l) >= 0);
    if (!enabled || langs.length < 2) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    box.hidden = false;
    const cur = window.I18N.lang;
    const checkSvg = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    box.innerHTML = `
      <button class="topbar-btn lang-switch-btn" id="langSwitchBtn" type="button"
        title="${esc(t("lang.switch"))}" aria-label="${esc(t("lang.switch"))}"
        aria-haspopup="menu" aria-expanded="false">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        <span class="lang-switch-code">${esc(window.I18N.shortOf(cur))}</span>
      </button>
      <div class="lang-menu" id="langMenu" role="menu" hidden>
        ${langs
          .map(
            l =>
              `<button class="lang-menu-item ${l === cur ? "is-active" : ""}" role="menuitemradio" data-lang="${l}" type="button">
                 <span>${esc(window.I18N.labelOf(l))}</span>${l === cur ? checkSvg : ""}
               </button>`
          )
          .join("")}
      </div>`;
    const btn = box.querySelector("#langSwitchBtn");
    const menu = box.querySelector("#langMenu");
    const setOpen = open => {
      menu.hidden = !open;
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    };
    btn.addEventListener("click", e => {
      e.stopPropagation();
      setOpen(menu.hidden);
    });
    menu.addEventListener("click", e => {
      const item = e.target.closest("[data-lang]");
      if (!item) return;
      window.I18N.setLang(item.dataset.lang);
      setOpen(false);
    });
    // 外部点击 / Esc 关闭（只绑一次）
    if (!renderLangSwitcher._bound) {
      renderLangSwitcher._bound = true;
      document.addEventListener("click", e => {
        const b = document.getElementById("langSwitch");
        if (b && !b.contains(e.target)) {
          const m = b.querySelector("#langMenu");
          const bt = b.querySelector("#langSwitchBtn");
          if (m && !m.hidden) {
            m.hidden = true;
            if (bt) bt.setAttribute("aria-expanded", "false");
          }
        }
      });
      document.addEventListener("keydown", e => {
        if (e.key !== "Escape") return;
        const b = document.getElementById("langSwitch");
        if (!b) return;
        const m = b.querySelector("#langMenu");
        if (m) m.hidden = true;
      });
    }
  }

  /** 语言切换后：刷新静态文案 + 重绘访客视图（后台页保持中文不重绘） */
  if (window.I18N) {
    window.I18N.on(() => {
      renderLangSwitcher();
      window.I18N.applyStatic(document);
      applySettings();
      const p = location.pathname || "/";
      const isAdmin = p === state.adminPath || p === "/admin";
      if (!isAdmin) route();
    });
  }

  /* ================= 内容按需翻译（P2：文章 / 说说 / 关于页） ================= */
  // 设计：不自动翻译，访客点按钮按需译；译文仅当前页有效，切页/切语言即还原（不记忆）
  const xlateStore = new Map(); // `${type}:${id}` -> { engine, showing, show(which) }
  const XLATE_GLOBE_SVG =
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';

  function xlateEnabled() {
    const I = window.I18N;
    return !!(
      state.settings.i18n_enabled &&
      state.settings.i18n_content_translate &&
      I &&
      I.enabled &&
      (I.lang === "en" || I.lang === "zh-TW")
    );
  }

  function xlateRequest(type, id) {
    return api("/api/translate", { body: { type, id: String(id), lang: window.I18N.lang } });
  }

  /** 说说是否值得翻译：含汉字且 ≥2 字（纯表情/图片动态不显示按钮） */
  function momentTranslatable(text) {
    const s = String(text || "").trim();
    return s.length >= 2 && /[㐀-鿿]/.test(s);
  }

  /** 文章/关于页正文上方的翻译工具条（初始态） */
  function xlateBarHtml(type, id) {
    const labelKey = window.I18N.lang === "en" ? "translate.btn_en" : "translate.btn_zh_tw";
    return `<div class="xlate-bar" data-xlate-root data-xlate-type="${type}" data-xlate-id="${esc(String(id))}">
      <button type="button" class="xlate-btn" data-xlate-act="go">${XLATE_GLOBE_SVG}<span>${esc(t(labelKey))}</span></button>
    </div>`;
  }

  function paintBarLoading(root) {
    root.innerHTML = `<span class="xlate-spin"></span><span>${esc(t("translate.loading"))}</span>`;
  }

  function paintBarIdle(root) {
    const labelKey = window.I18N.lang === "en" ? "translate.btn_en" : "translate.btn_zh_tw";
    root.innerHTML = `<button type="button" class="xlate-btn" data-xlate-act="go">${XLATE_GLOBE_SVG}<span>${esc(t(labelKey))}</span></button>`;
  }

  function paintBarDone(root, entry) {
    const note = t(entry.engine === "ai" ? "translate.note_ai" : "translate.note_local");
    const link = t(entry.showing === "trans" ? "translate.view_original" : "translate.view_translation");
    root.innerHTML =
      `<span class="xlate-bar-ico">${XLATE_GLOBE_SVG}</span>` +
      `<span class="xlate-note-text">${esc(note)}</span><span aria-hidden="true">·</span>` +
      `<button type="button" class="xlate-link" data-xlate-act="toggle">${esc(link)}</button>`;
  }

  /** 文章译文条目：抓原文 → 请求 → 返回可在原文/译文间切换的 entry */
  async function buildPostEntry(root) {
    const id = root.dataset.xlateId;
    const card = root.closest(".article-card") || app;
    const titleEl = card.querySelector("[data-xlate-title]");
    const bodyEl = card.querySelector(".article-body");
    const origTitle = titleEl ? titleEl.textContent : "";
    const origBody = bodyEl ? bodyEl.innerHTML : "";
    const res = await xlateRequest("post", id);
    const transTitle = res.title || origTitle;
    const transBody = sanitizeHtml(marked.parse(res.content || ""));
    const entry = {
      engine: res.engine || "ai",
      showing: "orig",
      show(which) {
        if (titleEl) titleEl.textContent = which === "trans" ? transTitle : origTitle;
        if (bodyEl) bodyEl.innerHTML = which === "trans" ? transBody : origBody;
        hydrateMusicCards(card);
        hydrateVideos(card);
        buildArticleToc(card); // 译文标题层级变了，目录同步重建
        this.showing = which;
      },
    };
    xlateStore.set("post:" + id, entry);
    return entry;
  }

  /** 关于页译文条目：问候/副标题/签名走纯文本，bio 走 Markdown */
  async function buildAboutEntry() {
    const greetingEl = app.querySelector(".about-greet h1");
    const subEl = app.querySelector(".about-greet-sub");
    const signEl = app.querySelector(".about-author-sign");
    const bioEl = app.querySelector(".about-bio .article-body");
    const orig = {
      greeting: greetingEl ? greetingEl.textContent : "",
      sub: subEl ? subEl.textContent : "",
      sign: signEl ? signEl.textContent : "",
      bio: bioEl ? bioEl.innerHTML : "",
    };
    const res = await xlateRequest("about", "site");
    const f = res.fields || {};
    const transBio = sanitizeHtml(marked.parse(f.bio || ""));
    const entry = {
      engine: res.engine || "ai",
      showing: "orig",
      show(which) {
        if (which === "trans") {
          if (greetingEl) greetingEl.textContent = f.greeting || orig.greeting;
          if (subEl) subEl.textContent = f.greeting_sub || orig.sub;
          if (signEl) signEl.textContent = f.signature || orig.sign;
          if (bioEl) bioEl.innerHTML = transBio;
        } else {
          if (greetingEl) greetingEl.textContent = orig.greeting;
          if (subEl) subEl.textContent = orig.sub;
          if (signEl) signEl.textContent = orig.sign;
          if (bioEl) bioEl.innerHTML = orig.bio;
        }
        this.showing = which;
      },
    };
    xlateStore.set("about:site", entry);
    return entry;
  }

  async function handleXlateGo(root) {
    const type = root.dataset.xlateType;
    const key = type + ":" + root.dataset.xlateId;
    paintBarLoading(root);
    try {
      let entry = xlateStore.get(key);
      if (!entry) entry = type === "post" ? await buildPostEntry(root) : await buildAboutEntry(root);
      entry.show("trans");
      paintBarDone(root, entry);
    } catch (err) {
      paintBarIdle(root);
      toast(err.message || t("translate.error"));
    }
  }

  function handleXlateToggle(root) {
    const entry = xlateStore.get(root.dataset.xlateType + ":" + root.dataset.xlateId);
    if (!entry) return;
    entry.show(entry.showing === "trans" ? "orig" : "trans");
    paintBarDone(root, entry);
  }

  /* ---------- 说说卡片：操作行地球按钮 + 译文声明 ---------- */
  function setMomentBtnPending(btn, pending) {
    btn.classList.toggle("is-pending", pending);
    btn.innerHTML = pending ? '<span class="xlate-spin"></span>' : XLATE_GLOBE_SVG;
  }

  function paintMomentNote(card, entry, btn) {
    let note = card.querySelector("[data-mnote]");
    const contentEl = card.querySelector("[data-mcontent]");
    if (!note && contentEl) {
      contentEl.insertAdjacentHTML(
        "afterend",
        `<div class="m-xlate-note" data-mnote><span class="m-xlate-note-text"></span><span>·</span><button type="button" class="xlate-link" data-act="xlate-toggle"></button></div>`
      );
      note = card.querySelector("[data-mnote]");
    }
    if (!note) return;
    note.querySelector(".m-xlate-note-text").textContent =
      t(entry.engine === "ai" ? "translate.note_ai" : "translate.note_local");
    note.querySelector("[data-act='xlate-toggle']").textContent =
      t(entry.showing === "trans" ? "translate.view_original" : "translate.view_translation");
    if (btn) {
      setMomentBtnPending(btn, false);
      btn.title = t(entry.showing === "trans" ? "translate.view_original" : "translate.title");
    }
  }

  async function handleMomentXlate(btn) {
    const card = btn.closest(".bber-item");
    if (!card) return;
    const id = Number(card.dataset.id);
    const key = "moment:" + id;
    const existed = xlateStore.get(key);
    if (existed) {
      existed.show(existed.showing === "trans" ? "orig" : "trans");
      paintMomentNote(card, existed, btn);
      return;
    }
    const contentEl = card.querySelector("[data-mcontent]");
    if (!contentEl) return;
    setMomentBtnPending(btn, true);
    try {
      const res = await xlateRequest("moment", id);
      const origHtml = contentEl.innerHTML;
      const transHtml = renderContentHtml(res.content || "");
      const entry = {
        engine: res.engine || "ai",
        showing: "orig",
        show(which) {
          contentEl.innerHTML = which === "trans" ? transHtml : origHtml;
          hydrateMusicCards(card);
          hydrateVideos(card);
          this.showing = which;
        },
      };
      xlateStore.set(key, entry);
      entry.show("trans");
      btn.classList.add("is-active");
      paintMomentNote(card, entry, btn);
    } catch (err) {
      setMomentBtnPending(btn, false);
      toast(err.message || t("translate.error"));
    }
  }

  document.addEventListener("click", e => {
    if (!xlateEnabled()) return;
    const mToggle = e.target.closest("[data-act='xlate-toggle']");
    if (mToggle) {
      const card = mToggle.closest(".bber-item");
      const entry = card ? xlateStore.get("moment:" + Number(card.dataset.id)) : null;
      if (entry && card) {
        entry.show(entry.showing === "trans" ? "orig" : "trans");
        paintMomentNote(card, entry, card.querySelector("[data-act='xlate']"));
      }
      return;
    }
    const go = e.target.closest("[data-xlate-act='go']");
    if (go) {
      const root = go.closest("[data-xlate-root]");
      if (root) handleXlateGo(root);
      return;
    }
    const toggle = e.target.closest("[data-xlate-act='toggle']");
    if (toggle) {
      const root = toggle.closest("[data-xlate-root]");
      if (root) handleXlateToggle(root);
      return;
    }
    const mBtn = e.target.closest("[data-act='xlate']");
    if (mBtn) {
      handleMomentXlate(mBtn);
      return;
    }
  });

  /* ================= 启动 ================= */
  // 旧 workers.dev 域名迁移：把缓存/接口设置中的旧绝对地址改成相对路径，
  // 资源随当前域名（e.jxe.me）走，避免老用户 localStorage 缓存继续引用旧域名
  const OLD_ORIGIN_RE = /^https?:\/\/moments\.237333536\.workers\.dev/;
  function migrateSettings(s) {
    if (!s || typeof s !== "object") return s;
    ["brand_avatar", "author_avatar", "post_avatar", "banner_bg_image", "banner_button_url"].forEach(k => {
      if (typeof s[k] === "string") s[k] = s[k].replace(OLD_ORIGIN_RE, "");
    });
    return s;
  }

  (async function init() {
    // 先用上次缓存的设置应用顶栏/页脚/音乐设置，配合 index.html 内联脚本消除首帧默认值闪现
    try {
      const cached = migrateSettings(JSON.parse(localStorage.getItem("moments_settings") || "null"));
      if (cached && typeof cached === "object" && !Array.isArray(cached)) {
        state.settings = Object.assign({ ...DEFAULT_SETTINGS }, cached);
        applySettings();
      }
    } catch (_) {}
    try {
      const s = migrateSettings(await api("/api/settings"));
      state.settings = Object.assign({ ...DEFAULT_SETTINGS }, s);
      try { localStorage.setItem("moments_settings", JSON.stringify(s)); } catch (_) {}
    } catch (_) {
      /* 后端不可用时使用兜底默认值 */
    }
    applySettings();
    setupThemeAutoFollow();
    // i18n：同步后台开关/语言集合；首次访问且无 SSR 注入（深链直连静态页）时调检测接口
    if (window.I18N) {
      window.I18N.configure(state.settings);
      if (state.settings.i18n_enabled && !window.I18N.manual && !window.__I18N_BOOT__) {
        try {
          const d = await api("/api/i18n/detect");
          window.I18N.applyDetected(d.lang);
        } catch (_) {}
      }
      window.I18N.applyStatic(document);
      renderLangSwitcher();
    }
    await loadOwoPacks(); // 预加载表情包，确保首屏评论里的 ::(slug): 能渲染成图片
    await refreshAdmin();
    route();
    initMusicPlayer();

    // 评论邮件链接定位：`#moment-<id>` → 滚动到对应说说并打开评论区
    const hashMoment = location.hash.match(/^#moment-(\d+)$/);
    if (hashMoment) {
      const mid = Number(hashMoment[1]);
      let tries = 0;
      const timer = setInterval(() => {
        tries++;
        const card = document.querySelector(`.bber-item[data-id="${mid}"]`);
        if (card) {
          clearInterval(timer);
          card.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(() => {
            const reply = card.querySelector('[data-act="reply"]');
            if (reply) reply.click();
          }, 500);
        } else if (tries > 30) {
          clearInterval(timer);
        }
      }, 200);
    }
  })();
})();
