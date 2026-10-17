// 复刻 friendfeed.ts 的解析逻辑，直接跑真实 feed，定位漏文章原因
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function cdata(s) { return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"); }
function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => { const n = parseInt(h, 16); try { return String.fromCodePoint(n); } catch { return ""; } })
    .replace(/&#(\d+);/g, (_, d) => { const n = parseInt(d, 10); try { return String.fromCodePoint(n); } catch { return ""; } })
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&apos;|&#39;/gi, "'");
}
function tagText(block, tag) {
  const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? decodeEntities(cdata(m[1])).trim() : "";
}
function absUrl(raw, base) {
  const v = (raw || "").trim();
  if (!v || v.startsWith("data:")) return "";
  try { const u = new URL(v, base); if (u.protocol !== "http:" && u.protocol !== "https:") return ""; return u.toString(); } catch { return ""; }
}
function parseDate(raw) {
  const v = (raw || "").trim();
  if (!v) return "";
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : "";
}
function parseRssItem(block, base) {
  const title = tagText(block, "title").slice(0, 200);
  const link = absUrl(tagText(block, "link") || tagText(block, "guid"), base);
  if (!link) return { title, link: "", reason: "link empty; guid=" + tagText(block, "guid") };
  const pub = parseDate(tagText(block, "pubDate")) || parseDate(block.match(/<dc:date(?:\s[^>]*)?>([\s\S]*?)<\/dc:date>/i)?.[1] ?? "");
  return { title, link, published_at: pub };
}
function parseFeed(xml, base) {
  const out = []; const seen = new Set();
  const rssRe = /<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi;
  let m;
  while ((m = rssRe.exec(xml)) && out.length < 20) {
    const it = parseRssItem(m[0], base);
    if (it.link && !seen.has(it.link)) { seen.add(it.link); out.push({ title: it.title, link: it.link, published_at: it.published_at }); }
  }
  return out;
}

async function main() {
  const urls = [
    "https://www.9ll.uk/rss.xml",
    "https://www.zhyok.cn/feed/",
    "https://hxy.cc/feed/",
    "https://wang618.cn/rss.php",
    "https://fengcblog.880200.xyz/feed/",
    "https://ink.tino.im/feed/",
    "https://my1981.cn/feed"
  ];
  for (const u of urls) {
    console.log("===== " + u + " =====");
    let xml = "";
    try {
      const res = await fetch(u, { headers: { "User-Agent": UA, Accept: "application/rss+xml,application/atom+xml,application/xml,text/xml,*/*", "Accept-Encoding": "gzip" }, redirect: "follow" });
      xml = await res.text();
    } catch (e) { console.log("FETCH FAIL:", e.message); continue; }
    const items = parseFeed(xml, u);
    console.log("parsed items:", items.length);
    items.slice(0, 3).forEach((it, i) => console.log(`  [${i}] ${it.published_at} ${it.title.slice(0, 40)}  ${it.link}`));
    if (items.length > 3) items.slice(-2).forEach((it, i) => console.log(`  [tail ${i}] ${it.published_at} ${it.title.slice(0, 40)}  ${it.link}`));
  }
}
main().catch(e => { console.error(e); process.exit(1); });