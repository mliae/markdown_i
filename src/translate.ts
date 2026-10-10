/**
 * 内容翻译：
 * - zh-CN → zh-TW：本地简繁转换（词组表 + 单字表），零成本零延迟
 * - zh-CN → en：Workers AI 翻译，Markdown 分块、代码/URL 原样保留
 */
import { S2T_CHARS } from "./s2t-table";
import { generateText, TEXT_MODEL, TEXT_MODEL_FALLBACK, type AiBinding } from "./ai";

/* ================= 简体 → 繁体（台湾常用词） ================= */

/** 大陆习惯用语 → 台湾用语；先于单字表、按 key 长度降序替换 */
const S2T_PHRASES: Record<string, string> = {
  // —— 互联网 / 数码 ——
  互联网: "網際網路",
  软件: "軟體",
  硬件: "硬體",
  固件: "韌體",
  应用软件: "應用軟體",
  应用程序: "應用程式",
  程序员: "程式設計師",
  源代码: "原始碼",
  服务器: "伺服器",
  网络: "網路",
  网速: "網速",
  网友: "網友",
  网页: "網頁",
  网址: "網址",
  链接: "連結",
  在线: "線上",
  宽带: "寬頻",
  资讯: "資訊",
  数据: "資料",
  数码: "數位",
  数字: "數位",
  人工智能: "人工智慧",
  视频: "影片",
  音频: "音訊",
  流媒体: "串流媒體",
  屏幕: "螢幕",
  鼠标: "滑鼠",
  内存: "記憶體",
  硬盘: "硬碟",
  光盘: "光碟",
  笔记本电脑: "筆記型電腦",
  充电宝: "行動電源",
  短信: "簡訊",
  打印机: "印表機",
  打印: "列印",
  默认: "預設",
  硅谷: "矽谷",
  芯片: "晶片",
  激光: "雷射",
  博客: "部落格",
  博主: "部落客",
  发帖: "發文",
  帖子: "貼文",
  // —— 软件交互 ——
  用户: "使用者",
  账户: "帳戶",
  账号: "帳號",
  登录: "登入",
  注册: "註冊",
  搜索: "搜尋",
  信息: "資訊",
  // —— 生活 ——
  自行车: "腳踏車",
  摩托车: "機車",
  出租车: "計程車",
  公交: "公車",
  地铁: "捷運",
  便利店: "超商",
  外卖: "外送",
  方便面: "泡麵",
  菠萝: "鳳梨",
  猕猴桃: "奇異果",
  熊猫: "貓熊",
  // —— 社会 / 教育 ——
  身份证: "身分證",
  小学: "國小",
  中学: "國中",
  幼儿园: "幼稚園",
  营销: "行銷",
  运营: "營運",
  策划: "企劃",
  质量: "品質",
};

const PHRASE_KEYS = Object.keys(S2T_PHRASES).sort((a, b) => b.length - a.length);

/** 简体中文 → 繁体中文（台湾用语优先），确定性本地转换；代码块/行内代码原样保留 */
export function toTraditional(input: string): string {
  if (!input) return input;
  // 代码不转换：字符串字面量/标识符改动可能破坏代码语义
  const [protectedMd, slots] = protectCode(input);
  let out = protectedMd;
  for (const k of PHRASE_KEYS) {
    if (out.includes(k)) out = out.split(k).join(S2T_PHRASES[k]);
  }
  let buf = "";
  for (const ch of out) buf += S2T_CHARS[ch] ?? ch;
  return restoreCode(buf, slots);
}

/* ================= 简体中文 → 英语（Workers AI） ================= */

/** 保护代码块/行内代码用的占位符。
 * 实测百度通用翻译会把 @/_ 类符号拆改（@ @ XCODE0 @ @），
 * 而 {MDn} 花括号字母数字格式在密集多标记场景下原样保留，故统一使用此格式。 */
export const ph = (i: number) => `{MD${i}}`;

/** 抽出代码围栏与行内代码，返回 [去代码文本, 代码片段表] */
export function protectCode(md: string): [string, string[]] {
  const slots: string[] = [];
  // 围栏代码块（含语言标注）
  let out = md.replace(/```[\s\S]*?```/g, m => {
    slots.push(m);
    return ph(slots.length - 1);
  });
  // 行内代码
  out = out.replace(/`[^`\n]+`/g, m => {
    slots.push(m);
    return ph(slots.length - 1);
  });
  return [out, slots];
}

export function restoreCode(text: string, slots: string[]): string {
  // 主路径：{MDn} 原样保留（百度实测稳定）
  text = text.replace(/\{MD(\d+)\}/g, (_, i) => slots[Number(i)] ?? ph(Number(i)));
  // 兜底：占位符被轻度破坏（花括号还在、内部被插空格/点号）；必须带花括号，避免误伤正文中的 MD5 等文本
  return text.replace(/\{[ \t]*M[ \t]*D[ _.\s-]*(\d+)[ \t]*\}|\{[ \t]*M[ \t]*D[ _.\s-]*(\d+)\s*\}?/gi, (m) => {
    const i = Number((m.match(/\d+/) || [""])[0]);
    return slots[i] ?? ph(i);
  });
}

/** 按段落切分并合并为不超过 maxChars 的块（标题/列表/引用保持完整行） */
export function chunkMarkdown(md: string, maxChars = 900): string[] {
  const lines = md.split("\n");
  const chunks: string[] = [];
  let cur: string[] = [];
  let len = 0;
  const flush = () => {
    if (cur.length) {
      chunks.push(cur.join("\n"));
      cur = [];
      len = 0;
    }
  };
  for (const line of lines) {
    // 超长单行（一般是长段落）硬切
    if (line.length > maxChars) {
      flush();
      for (let i = 0; i < line.length; i += maxChars) chunks.push(line.slice(i, i + maxChars));
      continue;
    }
    if (len + line.length + 1 > maxChars) flush();
    cur.push(line);
    len += line.length + 1;
  }
  flush();
  return chunks;
}

const SYSTEM_PROMPT =
  "You are a professional translator for a personal blog. Translate the user's text from Simplified Chinese into natural, fluent English. " +
  "Rules: preserve all Markdown syntax exactly (headings, lists, links, images, bold/italic, tables, blockquotes, line breaks); " +
  "never translate URLs, file paths, placeholder tokens such as {MD0}, or tags wrapped in braces; keep emoji; " +
  "output ONLY the translation with no notes, no explanation and no wrapping code fences.";

/** 调 AI 翻译一段（主模型失败回退一次），返回译文 */
async function aiTranslateOnce(ai: AiBinding, text: string): Promise<string> {
  const opts = { maxTokens: 1200, temperature: 0.2, thinking: false } as const;
  try {
    return await generateText(ai, [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: text },
    ], { ...opts, model: TEXT_MODEL });
  } catch (e) {
    console.warn("[translate] primary model failed, fallback:", e instanceof Error ? e.message : e);
    return generateText(ai, [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: text },
    ], { ...opts, model: TEXT_MODEL_FALLBACK });
  }
}

/** 去掉模型偶尔自作主张加的外层代码围栏 */
function stripOuterFence(s: string): string {
  const m = s.match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/);
  return m ? m[1] : s;
}

/** 限并发的异步 map */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const ret: R[] = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++;
      ret[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return ret;
}

/** 中译英：保护代码 → 分块 → 并发翻译 → 还原 */
export async function toEnglish(ai: AiBinding, md: string): Promise<string> {
  if (!md.trim()) return md;
  const [protectedMd, slots] = protectCode(md);
  const chunks = chunkMarkdown(protectedMd).filter(c => c.trim());
  const translated = await mapLimit(chunks, 3, async chunk => {
    const out = stripOuterFence((await aiTranslateOnce(ai, chunk)).trim());
    if (!out) throw new Error("empty translation");
    return out;
  });
  return restoreCode(translated.join("\n\n"), slots);
}

/** 短文本中译英（标题/短句），失败抛错由调用方处理 */
export async function toEnglishShort(ai: AiBinding, text: string): Promise<string> {
  const t = (text || "").trim();
  if (!t) return text;
  return stripOuterFence(await aiTranslateOnce(ai, t));
}
