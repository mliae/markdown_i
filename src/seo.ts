/**
 * SEO / SSR：
 * - buildSeoHead：根据路由生成 canonical / Open Graph / Twitter Card / robots / JSON-LD
 * - renderPostSsr：文章详情服务端直出 HTML（搜索引擎可直接收录正文）
 * - robots / sitemap / rss
 */
import type { SiteSettings } from "./settings";
import type { PostRow } from "./db";
import { keyToSrc, serializePost } from "./db";
import { renderMarkdownSafe } from "./markdown";

const esc = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const escAttr = esc;

/** 站内相对路径 → 绝对 URL（图片 key/相对路径均可）。
 *  siteDomain 有值时优先用它（换域名后 SEO/RSS/OG 链接自动跟随），否则用请求 origin。 */
export function absoluteUrl(origin: string, src: string, siteDomain?: string): string {
  if (!src) return "";
  if (/^https?:\/\//i.test(src)) return src;
  const base = (siteDomain || origin).replace(/\/$/, "");
  return base + (src.startsWith("/") ? src : "/" + src);
}

export interface SeoHeadOptions {
  title: string; // 完整标题（已含站名后缀）
  description?: string;
  path: string; // canonical 路径，如 /post/xxx
  image?: string; // og 图（绝对 URL）
  siteName?: string;
  type?: "website" | "article";
  noindex?: boolean;
  jsonLd?: Record<string, unknown>;
}

/** 注入 index.html 的 <!--SSR_HEAD--> 位置（title/description 在 index.ts 中单独替换） */
export function buildSeoHead(origin: string, o: SeoHeadOptions): string {
  const url = origin + o.path;
  const tags: string[] = [`<link rel="canonical" href="${escAttr(url)}" />`];
  if (o.noindex) {
    tags.push(`<meta name="robots" content="noindex,nofollow,noarchive" />`);
    return tags.join("\n    ");
  }
  const type = o.type || "website";
  tags.push(`<meta property="og:type" content="${type}" />`);
  tags.push(`<meta property="og:title" content="${escAttr(o.title)}" />`);
  if (o.description) tags.push(`<meta property="og:description" content="${escAttr(o.description)}" />`);
  tags.push(`<meta property="og:url" content="${escAttr(url)}" />`);
  tags.push(`<meta property="og:site_name" content="${escAttr(o.siteName || "Moments")}" />`);
  if (o.image) tags.push(`<meta property="og:image" content="${escAttr(o.image)}" />`);
  tags.push(`<meta name="twitter:card" content="${o.image ? "summary_large_image" : "summary"}" />`);
  tags.push(`<meta name="twitter:title" content="${escAttr(o.title)}" />`);
  if (o.description) tags.push(`<meta name="twitter:description" content="${escAttr(o.description)}" />`);
  if (o.image) tags.push(`<meta name="twitter:image" content="${escAttr(o.image)}" />`);
  if (o.jsonLd) {
    tags.push(
      `<script type="application/ld+json" id="ssr-jsonld">${JSON.stringify(o.jsonLd)}</script>`
    );
  }
  return tags.join("\n    ");
}

/** 站点级 JSON-LD（首页 WebSite 实体 + 站内搜索占位） */
export function websiteJsonLd(origin: string, s: SiteSettings) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: s.site_title,
    description: s.essay_subtitle,
    url: origin + "/",
  };
}

export function blogJsonLd(origin: string, s: SiteSettings, posts: { slug: string; title: string; updated_at: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: `${s.site_title} · 文章`,
    url: origin + "/posts",
    blogPost: posts.map(p => ({
      "@type": "BlogPosting",
      headline: p.title,
      url: origin + "/post/" + encodeURIComponent(p.slug),
      dateModified: p.updated_at,
    })),
  };
}

export function collectionJsonLd(origin: string, s: SiteSettings, count: number) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${s.site_title} · 相册`,
    description: `相册共 ${count} 张图片`,
    url: origin + "/photos",
  };
}

/* ==================== 文章详情直出 ==================== */

export function postJsonLd(origin: string, s: SiteSettings, post: PostRow) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    url: origin + "/post/" + encodeURIComponent(post.slug),
    datePublished: post.created_at,
    dateModified: post.updated_at,
    author: { "@type": "Person", name: s.author_name || s.site_title },
    publisher: { "@type": "Person", name: s.author_name || s.site_title },
    mainEntityOfPage: { "@type": "WebPage", "@id": origin + "/post/" + encodeURIComponent(post.slug) },
  };
  if (post.cover) data.image = absoluteUrl(origin, keyToSrc(post.cover, s.r2_domain, s.b2_domain), s.site_domain);
  return data;
}

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
  } catch {
    return iso;
  }
};

/** 与前端 .article-card 结构一致，data-ssr-post 供前端水合时识别（避免重绘闪烁） */
const PIN_BADGE =
  '<span class="top-badge"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg><span>置顶</span></span>';

export function renderPostSsr(row: PostRow, commentCount: number, defaultPoster = "", r2Domain?: string, b2Domain?: string): string {
  const p = serializePost(row, true, r2Domain, b2Domain);
  const body = renderMarkdownSafe(row.content_md || "", defaultPoster, r2Domain, b2Domain);
  return `
      <div class="essay">
        <div class="post-layout">
        <div class="article-card" data-ssr-post="${escAttr(p.slug)}">
          <a class="article-back" href="/" title="返回首页">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"></path></svg>
            返回首页
          </a>
          <h1>${p.pinned ? PIN_BADGE : ""}${esc(p.title)}${p.status === "draft" ? '<span class="draft-tag">草稿</span>' : ""}</h1>
          <div class="article-meta"><time datetime="${escAttr(p.created_at)}">${esc(fmtDate(p.created_at))}</time></div>
          <div class="article-body">${body}</div>
          <div class="article-actions"><a class="btn" href="/posts">返回列表</a></div>
          <section class="article-comments" data-comment-section>
            <h3 class="comment-section-title">评论<span class="comment-count-badge" data-article-comments-count>${commentCount || ""}</span></h3>
            <div class="comment-list" data-comment-list><span class="spinner"></span></div>
            <form class="comment-form-wrap comment-form-inline" data-comment-form data-ctype="post" data-cid="${p.id}" data-slug="${escAttr(p.slug)}">
              <div class="comment-form-row comment-user-row">
                <span class="qq-avatar" data-qq-avatar>?</span>
                <input name="nickname" placeholder="昵称或 QQ 号（填 QQ 号自动获取昵称邮箱头像）" maxlength="20" required autocomplete="off" />
              </div>
              <div class="comment-form-row">
                <input name="email" type="email" placeholder="邮箱 *" maxlength="100" required />
                <input name="website" placeholder="网址（选填，头像可点击跳转）" maxlength="200" />
              </div>
              <textarea name="content" placeholder="说点什么…（支持 @ 提及他人）" maxlength="500" required style="min-height:100px"></textarea>
              <div class="comment-form-foot">
                <button class="btn primary" type="submit">发表评论</button>
              </div>
            </form>
          </section>
        </div>
        </div>
      </div>`;
}

/* ==================== robots / sitemap / rss ==================== */

export function robotsTxt(origin: string): string {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /sys-",
    "Disallow: /api/",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
}

export function sitemapXml(origin: string, posts: PostRow[]): string {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
  const add = (loc: string, priority: string, changefreq: string, lastmod?: string) => {
    lines.push("  <url>");
    lines.push(`    <loc>${esc(loc)}</loc>`);
    if (lastmod) lines.push(`    <lastmod>${esc(lastmod)}</lastmod>`);
    lines.push(`    <changefreq>${changefreq}</changefreq>`);
    lines.push(`    <priority>${priority}</priority>`);
    lines.push("  </url>");
  };
  add(origin + "/", "1.0", "daily");
  add(origin + "/posts", "0.8", "weekly");
  add(origin + "/photos", "0.7", "weekly");
  add(origin + "/about", "0.6", "monthly");
  add(origin + "/links", "0.6", "weekly");
  for (const p of posts) {
    add(origin + "/post/" + encodeURIComponent(p.slug), "0.9", "monthly", p.updated_at);
  }
  lines.push("</urlset>");
  return lines.join("\n");
}

export function rssXml(origin: string, s: SiteSettings, posts: PostRow[]): string {
  const items = posts
    .map(p => {
      const desc = esc(p.excerpt || "");
      const cover = p.cover ? `<p><img src="${esc(absoluteUrl(origin, keyToSrc(p.cover, s.r2_domain, s.b2_domain), s.site_domain))}" alt="${esc(p.title)}" /></p>` : "";
      return `    <item>
      <title>${esc(p.title)}</title>
      <link>${esc(origin + "/post/" + encodeURIComponent(p.slug))}</link>
      <guid isPermaLink="true">${esc(origin + "/post/" + encodeURIComponent(p.slug))}</guid>
      <pubDate>${esc(new Date(p.updated_at).toUTCString())}</pubDate>
      <description><![CDATA[${cover}${desc}]]></description>
    </item>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${esc(s.site_title)}</title>
    <link>${esc(origin)}/</link>
    <description>${esc(s.essay_subtitle)}</description>
    <language>zh-CN</language>
${items}
  </channel>
</rss>`;
}
