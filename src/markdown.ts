/**
 * 服务端极简 Markdown → 安全 HTML（用于文章页 SSR，供搜索引擎抓取）
 * 原则：先整体转义，再做白名单标签转换，绝不透传原始 HTML（防 XSS）。
 * 覆盖：标题/段落/粗斜体/删除线/高亮/行内代码/代码块/引用/有序无序列表/
 *       分隔线/链接/图片/[music=id] 音乐块/@[video](url) 视频块/:::center 居中块。
 * 复杂排版（表格等）在客户端由 marked 增强；此处保证内容完整可读即可。
 */
import { keyToSrc } from "./db";
import { parseEmbed } from "./video-embed";

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** 行内：转义后调用，输入已安全 */
function inline(text: string, r2Domain?: string, b2Domain?: string): string {
  let out = text;
  // 行内代码
  out = out.replace(/`([^`]+)`/g, (_m, code) => `<code>${code}</code>`);
  // 图片 ![alt](url) — 展示用缩略图，data-orig 供前端查看原图
  // url 允许：http(s) 外链、/media/ 站内路径、uploads|b2/uploads 开头的裸 key（数据库统一存 key）
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^&]*?&quot;)?\)/g, (_m, alt, url) => {
    let safe = safeUrl(url);
    if (!safe && /^(uploads|b2\/uploads)\//.test(url)) safe = keyToSrc(url, r2Domain, b2Domain);
    if (!safe) return alt;
    return `<img src="${thumbUrl(safe, r2Domain, b2Domain)}" alt="${alt}" loading="lazy" data-orig="${safe}" referrerpolicy="no-referrer" />`;
  });
  // 链接 [text](url)
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*?&quot;)?\)/g, (_m, label, url) => {
    if (/^music=/.test(label)) return musicBlock(label);
    const safe = safeUrl(url);
    if (!safe) return label;
    const external = /^https?:\/\//i.test(safe);
    return `<a href="${safe}"${external ? ' target="_blank" rel="noopener noreferrer nofollow"' : ""}>${label}</a>`;
  });
  // 音乐块 [music=123]（旧网易云）/ [music=t12]（站内曲库）
  out = out.replace(/\[music=(t?\d+)\]/g, (_m, id) => musicBlock(`music=${id}`));
  // 粗体/斜体/删除线
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  out = out.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  out = out.replace(/==([^=\n]+)==/g, "<mark>$1</mark>");
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  return out;
}

function musicBlock(label: string): string {
  const id = label.replace(/^music=/, "").trim();
  if (/^t\d+$/.test(id)) {
    // 站内曲库曲目：SSR 输出纯展示占位，前端水合为可播放卡片
    return `<span class="ssr-music-link">站内音乐（${id}）</span>`;
  }
  if (!/^\d+$/.test(id)) return "";
  return `<a class="ssr-music-link" data-music-id="${id}" href="https://music.163.com/song?id=${id}" target="_blank" rel="noopener noreferrer nofollow">网易云音乐（ID: ${id}）</a>`;
}

/** @[video](url) 或 @[video](url "封面URL") 视频块（m3u8 输出占位 video，前端水合挂 HLS；mp4 直出 src）。
 *  无封面时使用站点统一封面 defaultPoster（后台设置） */
function videoBlock(url: string, poster: string, defaultPoster = "", r2Domain?: string, b2Domain?: string): string {
  // 站外嵌入（B站/YouTube）：输出带 provider/vid 的占位容器，前端 hydrateVideos 注入 iframe。
  // 不能直出 <iframe>——客户端 sanitizeHtml 会过滤掉 iframe。
  const rawUrl = url.replace(/&amp;/g, "&");
  const emb = parseEmbed(rawUrl);
  if (emb) {
    return `<div class="article-video"><div class="video-embed" data-embed-provider="${emb.provider}" data-embed-vid="${escapeHtml(emb.vid)}"></div></div>`;
  }
  const safe = safeUrl(url) || (/^(uploads|b2\/uploads)\//.test(url) ? escapeHtml(keyToSrc(url, r2Domain, b2Domain)) : "");
  if (!safe) return "";
  const resolvePoster = (p: string) => {
    if (!p) return "";
    if (/^https?:\/\//i.test(p) || p.startsWith("/")) return p;
    // 裸 key：无直连域名时 keyToSrc 回退 /media/ 代理
    return keyToSrc(p, r2Domain, b2Domain);
  };
  const dp = defaultPoster && (/^https?:\/\//i.test(defaultPoster) || defaultPoster.startsWith("/"))
    ? escapeHtml(defaultPoster)
    : defaultPoster ? escapeHtml(keyToSrc(defaultPoster, r2Domain, b2Domain)) : "";
  const usePoster = resolvePoster(poster) || dp;
  const posterAttr = usePoster ? ` poster="${usePoster}"` : "";
  const inner = /\.m3u8(?:[?#]|$)/i.test(safe)
    ? `<video class="essay-media-video essay-media-video--hls" data-hls-src="${safe}"${posterAttr} controls preload="none" playsinline></video>`
    : `<video class="essay-media-video" src="${safe}"${posterAttr} controls preload="none" playsinline></video>`;
  return `<div class="article-video">${inner}</div>`;
}

function safeUrl(url: string): string | null {
  const u = url.trim();
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("/")) return u; // 站内路径（/media/...）
  if (/^mailto:/i.test(u)) return u;
  return null;
}

/** 从原图 src 推导缩略图 URL（/media/ 或 R2/B2 直连域名路径插入 _w1200.jpg 后缀；外链/GIF 原样返回） */
function thumbUrl(src: string, r2Domain?: string, b2Domain?: string): string {
  // 裸 key（uploads/ / b2/uploads/ 开头）→ 先转直连或代理 URL（数据库已统一存 key）
  let s = src;
  if (/^(uploads|b2\/uploads)\//.test(s)) s = keyToSrc(s, r2Domain, b2Domain);
  const r2Base = r2Domain ? r2Domain.replace(/\/$/, "") : "";
  const b2Base = b2Domain ? b2Domain.replace(/\/$/, "") : "";
  const isLocal =
    s.includes("/media/") ||
    (r2Base && s.startsWith(r2Base + "/")) ||
    (b2Base && s.startsWith(b2Base + "/"));
  if (!isLocal) return s;
  if (s.includes("_w1200.")) return s;
  if (/\.gif(?:$|[?#])/i.test(s)) return s;
  return s.replace(/\.([^.]+)$/, "_w1200.jpg");
}

export function renderMarkdownSafe(input: string, defaultPoster = "", r2Domain?: string, b2Domain?: string): string {
  if (!input) return "";
  const src = escapeHtml(input.replace(/\r\n?/g, "\n"));
  const lines = src.split("\n");
  const html: string[] = [];

  let i = 0;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) {
      html.push(`<p>${inline(para.join("<br>"), r2Domain, b2Domain)}</p>`);
      para = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // 围栏代码块
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      flushPara();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // 跳过结束围栏
      html.push(`<pre><code>${buf.join("\n")}</code></pre>`);
      continue;
    }

    // 空行
    if (!line.trim()) {
      flushPara();
      i++;
      continue;
    }

    // 标题
    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      flushPara();
      const level = h[1].length;
      html.push(`<h${level}>${inline(h[2].trim(), r2Domain, b2Domain)}</h${level}>`);
      i++;
      continue;
    }

    // 分隔线
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushPara();
      html.push("<hr>");
      i++;
      continue;
    }

    // 视频块 @[video](url) 或 @[video](url "封面URL")（独占一行）
    // 注意：正文已整体 escapeHtml，此处引号形态为 &quot;（与图片块一致）
    const vid = line.match(/^@\[video\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)\s*$/);
    if (vid) {
      flushPara();
      html.push(videoBlock(vid[1], vid[2] || "", defaultPoster, r2Domain, b2Domain));
      i++;
      continue;
    }

    // 居中块 :::center ... :::（内部递归渲染，支持图片/音乐等）
    if (/^:::center\s*$/.test(line)) {
      flushPara();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^:::\s*$/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // 跳过结束围栏（缺失时到文件尾）
      html.push(`<div class="text-center">${renderMarkdownSafe(buf.join("\n"), defaultPoster, r2Domain, b2Domain)}</div>`);
      continue;
    }

    // 引用
    if (/^&gt;\s?/.test(line)) {
      flushPara();
      const buf: string[] = [];
      while (i < lines.length && /^&gt;\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^&gt;\s?/, ""));
        i++;
      }
      html.push(`<blockquote>${inline(buf.join("<br>"), r2Domain, b2Domain)}</blockquote>`);
      continue;
    }

    // 无序列表
    if (/^\s*[-*+]\s+/.test(line)) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*[-*+]\s+/, ""), r2Domain, b2Domain)}</li>`);
        i++;
      }
      html.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    // 有序列表
    if (/^\s*\d+\.\s+/.test(line)) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*\d+\.\s+/, ""), r2Domain, b2Domain)}</li>`);
        i++;
      }
      html.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    para.push(line.trim());
    i++;
  }
  flushPara();

  return html.join("\n");
}
