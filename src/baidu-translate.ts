/**
 * 百度翻译开放平台（通用翻译 API）
 * 文档：https://fanyi-api.baidu.com/doc/21
 * - 接口：POST https://fanyi-api.baidu.com/api/trans/vip/translate
 * - 签名：MD5(appid + q + salt + 密钥)，32 位小写；签名时 q 不做 URL encode
 * - 标准版 QPS=1（免费不限字符量），高级版 QPS=10（每月 200 万字符免费）
 * - 译文按行返回（trans_result 每行一条），多行换行结构可完整还原
 *
 * Workers SubtleCrypto 不支持 MD5，内置纯 JS 实现（RFC 1321，UTF-8 安全）。
 */
import { protectCode, restoreCode, chunkMarkdown, ph } from "./translate";

const BAIDU_URL = "https://fanyi-api.baidu.com/api/trans/vip/translate";
/** 单次请求上限 6000 UTF-8 字节；分块约 900 字符（最坏 ~2700 字节），安全 */
const REQ_TIMEOUT_MS = 8000;

/* ================= MD5（RFC 1321，纯 JS） ================= */

function md5(raw: string): string {
  // UTF-8 编码（处理代理对）
  const bytes: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    let c = raw.charCodeAt(i);
    if (c < 0x80) {
      bytes.push(c);
    } else if (c < 0x800) {
      bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c < 0xd800 || c >= 0xe000) {
      bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    } else {
      i++;
      c = 0x10000 + (((c & 0x3ff) << 10) | (raw.charCodeAt(i) & 0x3ff));
      bytes.push(
        0xf0 | (c >> 18),
        0x80 | ((c >> 12) & 0x3f),
        0x80 | ((c >> 6) & 0x3f),
        0x80 | (c & 0x3f)
      );
    }
  }

  const origBits = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  // 长度 64 位小端；JS 移位按 32 取模（>>>32 等价 >>>0），高 4 字节需显式处理。
  // 博客内容远小于 2^32 位（512MB），高位固定为 0。
  for (let i = 0; i < 8; i++) {
    const shift = 8 * i;
    bytes.push(shift < 32 ? (origBits >>> shift) & 0xff : 0);
  }

  const add = (x: number, y: number) => (x + y) & 0xffffffff;
  const rol = (x: number, n: number) => (x << n) | (x >>> (32 - n));
  const cmn = (q: number, a: number, b: number, x: number, s: number, t: number) =>
    add(rol(add(add(a, q), add(x, t)), s), b);
  const ff = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) =>
    cmn((b & c) | (~b & d), a, b, x, s, t);
  const gg = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) =>
    cmn((b & d) | (c & ~d), a, b, x, s, t);
  const hh = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) =>
    cmn(b ^ c ^ d, a, b, x, s, t);
  const ii = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) =>
    cmn(c ^ (b | ~d), a, b, x, s, t);

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const x = new Array<number>(16);

  for (let off = 0; off < bytes.length; off += 64) {
    for (let k = 0; k < 16; k++) {
      const j = off + k * 4;
      x[k] = bytes[j] | (bytes[j + 1] << 8) | (bytes[j + 2] << 16) | (bytes[j + 3] << 24);
    }
    let a = a0, b = b0, c = c0, d = d0;

    // Round 1
    a = ff(a, b, c, d, x[0], 7, 0xd76aa478); d = ff(d, a, b, c, x[1], 12, 0xe8c7b756);
    c = ff(c, d, a, b, x[2], 17, 0x242070db); b = ff(b, c, d, a, x[3], 22, 0xc1bdceee);
    a = ff(a, b, c, d, x[4], 7, 0xf57c0faf); d = ff(d, a, b, c, x[5], 12, 0x4787c62a);
    c = ff(c, d, a, b, x[6], 17, 0xa8304613); b = ff(b, c, d, a, x[7], 22, 0xfd469501);
    a = ff(a, b, c, d, x[8], 7, 0x698098d8); d = ff(d, a, b, c, x[9], 12, 0x8b44f7af);
    c = ff(c, d, a, b, x[10], 17, 0xffff5bb1); b = ff(b, c, d, a, x[11], 22, 0x895cd7be);
    a = ff(a, b, c, d, x[12], 7, 0x6b901122); d = ff(d, a, b, c, x[13], 12, 0xfd987193);
    c = ff(c, d, a, b, x[14], 17, 0xa679438e); b = ff(b, c, d, a, x[15], 22, 0x49b40821);
    // Round 2
    a = gg(a, b, c, d, x[1], 5, 0xf61e2562); d = gg(d, a, b, c, x[6], 9, 0xc040b340);
    c = gg(c, d, a, b, x[11], 14, 0x265e5a51); b = gg(b, c, d, a, x[0], 20, 0xe9b6c7aa);
    a = gg(a, b, c, d, x[5], 5, 0xd62f105d); d = gg(d, a, b, c, x[10], 9, 0x02441453);
    c = gg(c, d, a, b, x[15], 14, 0xd8a1e681); b = gg(b, c, d, a, x[4], 20, 0xe7d3fbc8);
    a = gg(a, b, c, d, x[9], 5, 0x21e1cde6); d = gg(d, a, b, c, x[14], 9, 0xc33707d6);
    c = gg(c, d, a, b, x[3], 14, 0xf4d50d87); b = gg(b, c, d, a, x[8], 20, 0x455a14ed);
    a = gg(a, b, c, d, x[13], 5, 0xa9e3e905); d = gg(d, a, b, c, x[2], 9, 0xfcefa3f8);
    c = gg(c, d, a, b, x[7], 14, 0x676f02d9); b = gg(b, c, d, a, x[12], 20, 0x8d2a4c8a);
    // Round 3
    a = hh(a, b, c, d, x[5], 4, 0xfffa3942); d = hh(d, a, b, c, x[8], 11, 0x8771f681);
    c = hh(c, d, a, b, x[11], 16, 0x6d9d6122); b = hh(b, c, d, a, x[14], 23, 0xfde5380c);
    a = hh(a, b, c, d, x[1], 4, 0xa4beea44); d = hh(d, a, b, c, x[4], 11, 0x4bdecfa9);
    c = hh(c, d, a, b, x[7], 16, 0xf6bb4b60); b = hh(b, c, d, a, x[10], 23, 0xbebfbc70);
    a = hh(a, b, c, d, x[13], 4, 0x289b7ec6); d = hh(d, a, b, c, x[0], 11, 0xeaa127fa);
    c = hh(c, d, a, b, x[3], 16, 0xd4ef3085); b = hh(b, c, d, a, x[6], 23, 0x04881d05);
    a = hh(a, b, c, d, x[9], 4, 0xd9d4d039); d = hh(d, a, b, c, x[12], 11, 0xe6db99e5);
    c = hh(c, d, a, b, x[15], 16, 0x1fa27cf8); b = hh(b, c, d, a, x[2], 23, 0xc4ac5665);
    // Round 4
    a = ii(a, b, c, d, x[0], 6, 0xf4292244); d = ii(d, a, b, c, x[7], 10, 0x432aff97);
    c = ii(c, d, a, b, x[14], 15, 0xab9423a7); b = ii(b, c, d, a, x[5], 21, 0xfc93a039);
    a = ii(a, b, c, d, x[12], 6, 0x655b59c3); d = ii(d, a, b, c, x[3], 10, 0x8f0ccc92);
    c = ii(c, d, a, b, x[10], 15, 0xffeff47d); b = ii(b, c, d, a, x[1], 21, 0x85845dd1);
    a = ii(a, b, c, d, x[8], 6, 0x6fa87e4f); d = ii(d, a, b, c, x[15], 10, 0xfe2ce6e0);
    c = ii(c, d, a, b, x[6], 15, 0xa3014314); b = ii(b, c, d, a, x[13], 21, 0x4e0811a1);
    a = ii(a, b, c, d, x[4], 6, 0xf7537e82); d = ii(d, a, b, c, x[11], 10, 0xbd3af235);
    c = ii(c, d, a, b, x[2], 15, 0x2ad7d2bb); b = ii(b, c, d, a, x[9], 21, 0xeb86d391);

    a0 = add(a0, a); b0 = add(b0, b); c0 = add(c0, c); d0 = add(d0, d);
  }

  const hex = (n: number) => {
    let s = "";
    for (let j = 0; j <= 3; j++) {
      s += ((n >>> (j * 8 + 4)) & 0x0f).toString(16) + ((n >>> (j * 8)) & 0x0f).toString(16);
    }
    return s;
  };
  return hex(a0) + hex(b0) + hex(c0) + hex(d0);
}

/* ================= Markdown 语法保护 =================
 * 百度通用翻译不是 Markdown 感知接口，实测会：
 *  - 丢掉标题/引用/列表标记后的空格（## 标题 → ##Title、- 项 → -Item）
 *  - 给加粗收尾 ** 插空格、把链接圆括号转全角
 * 因此把所有语法标记/URL 替换为 {MDn} 占位符（与代码占位同族、共享 slots，实测原样保留），
 * 翻译后用 restoreCode 统一还原。
 */

/**
 * 保护代码 + 行内 HTML + 行首标记（标题/引用/列表）+ 图片链接 + 强调符号。
 * 链接文字、表头、普通正文仍正常参与翻译。
 */
function protectMarkdown(md: string): [string, string[]] {
  const [afterCode, slots] = protectCode(md);
  const put = (v: string): string => {
    slots.push(v);
    return ph(slots.length - 1);
  };
  let out = afterCode;

  // 1. 行内 HTML 标签（<br>、<img ...> 等）
  out = out.replace(/<\/?[a-zA-Z][^>]*>/g, m => put(m));

  // 2. 行首标记：标题 / 引用 / 无序列表 / 有序列表（整块前缀含尾随空格，逐行处理）
  out = out
    .split("\n")
    .map(line =>
      line
        .replace(/^(\s{0,3}#{1,6})[ \t]+/, (_m, p: string) => put(p + " "))
        .replace(/^(\s*(?:>[ \t]*)+)/, (m: string) => put(/[ \t]$/.test(m) ? m : m + " "))
        .replace(/^(\s*[-*+])[ \t]+/, (_m, p: string) => put(p + " "))
        .replace(/^(\s*\d+[.)])[ \t]+/, (_m, p: string) => put(p + " "))
    )
    .join("\n");

  // 3. 任务复选框 [x] / [ ]
  out = out.replace(/\[\s*[xX ]\s*\]/g, m => put(m));
  // 4. 链接/图片整体匹配：前缀 [ 或 ![、尾部 ](url) 各自入槽，方括号不悬空（防止引擎补括号/转全角）
  out = out.replace(
    /(!?)\[([^\]\n]*?)(\]\(\s*[^)\s]+(?:\s+"[^"]*")?\s*\))/g,
    (_m, bang: string, _text: string, tail: string) => put(bang ? "![" : "[") + _text + put(tail)
  );
  // 5. 裸 URL
  out = out.replace(/https?:\/\/[^\s)）\]>"'，。；！？]+/g, m => put(m));
  // 6. 强调/删除线标记（** __ ~~ * _）；代码、URL 中的早已保护
  out = out.replace(/\*\*|__|~~|\*|_/g, m => put(m));

  return [out, slots];
}

/** 还原后规范化：修复引擎对占位符周边空格造成的格式偏差 */
function normalizeMarkdown(s: string): string {
  // 行首标记后的重复空格（占位符自带尾随空格 + 引擎又保留一个）
  s = s.replace(/^(#{1,6}|>|[-*+]|\d+[.)])[ \t]{2,}/gm, "$1 ");
  // 链接/图片文字两侧空格：[ text ](url) → [text](url)
  s = s.replace(/\[[ \t]*([^\]\n]*?)[ \t]*\]\(/g, "[$1](");
  // ** 粗体 ** / __ 粗体 __ / ~~ 删除 ~~：去掉内侧空格（CommonMark 要求紧邻文字才生效）
  s = s.replace(/(\*\*|__|~~)([^\n]*?)\1/g, (_m, m, inner: string) => m + inner.trim() + m);
  // *斜体* / _斜体_：要求前有非空字符（避开行首 * 列表），后接空白/标点/行尾
  s = s.replace(
    /([^\s*_])[ \t]+(\*|_)[ \t]*(\S(?:[^\n*_]*?\S)?)[ \t]*\2(?=[\s.,!?;:，。！？；：）)]|$)/gm,
    "$1 $2$3$2"
  );
  return s;
}

function restoreMarkdown(text: string, slots: string[]): string {
  return normalizeMarkdown(restoreCode(text, slots));
}

/* ================= 百度接口调用 ================= */

interface BaiduResponse {
  error_code?: number | string;
  error_msg?: string;
  trans_result?: { src: string; dst: string }[];
}

/** 调一次百度接口（q 可为多行，按行返回）。标准版 QPS=1：命中频控时等待后重试 */
async function callBaidu(appid: string, key: string, q: string): Promise<string> {
  const salt = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const sign = md5(appid + q + salt + key);
  const body = new URLSearchParams({
    q,
    from: "zh",
    to: "en",
    appid,
    salt,
    sign,
  });

  const maxAttempts = 4;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQ_TIMEOUT_MS);
    let data: BaiduResponse;
    try {
      const resp = await fetch(BAIDU_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        signal: ctrl.signal,
      });
      data = (await resp.json()) as BaiduResponse;
    } finally {
      clearTimeout(timer);
    }

    if (data.trans_result?.length) {
      // 多行输入 → 每行一条结果，按顺序拼回
      return data.trans_result.map(r => r.dst).join("\n");
    }

    const code = String(data.error_code ?? "");
    // 54003=请求频率受限，54004=余额不足（重试无意义，直接抛错）
    if (code === "54003" && attempt < maxAttempts - 1) {
      await new Promise(r => setTimeout(r, 1200));
      continue;
    }
    throw new Error(`baidu ${code || "unknown"}: ${data.error_msg || "no result"}`);
  }
  throw new Error("baidu rate limit retries exhausted");
}

/**
 * 中文 Markdown → 英文（百度翻译）。
 * 代码与 URL 占位保护 → 分块顺序请求（QPS=1 安全）→ 还原占位。
 */
export async function baiduToEnglish(appid: string, key: string, md: string): Promise<string> {
  const t = (md || "").trim();
  if (!t) return md;
  const [protectedMd, slots] = protectMarkdown(md);
  const chunks = chunkMarkdown(protectedMd).filter(c => c.trim());
  const out: string[] = [];
  for (const chunk of chunks) {
    const translated = await callBaidu(appid, key, chunk);
    if (!translated.trim()) throw new Error("baidu empty translation");
    out.push(translated);
  }
  // 块间用空行连接，与原文分块语义保持一致
  return restoreMarkdown(out.join("\n\n"), slots);
}
