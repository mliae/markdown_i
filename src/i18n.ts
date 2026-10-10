/**
 * 多语言（i18n）服务端支持
 *
 * 语言判定优先级：
 *   1. 用户手动选择（cookie moments_lang，一年内有效）
 *   2. 首次访问 + 开启自动检测：访问地（cf-ipcountry）
 *      大陆→简体，台港澳→繁体，其他→英语
 *   3. Accept-Language 头
 *   4. 后台默认语言
 * 任一环节的结果必须在「开放语言」列表内，否则继续向下回退。
 */
import type { SiteSettings } from "./settings";

export const I18N_LANGS = ["zh-CN", "zh-TW", "en"] as const;
export type I18nLang = (typeof I18N_LANGS)[number];

export const I18N_COOKIE = "moments_lang";

/** 语言在界面上的自显名称（后台/切换器用，各自语言自显，不随当前语言变化） */
export const I18N_LANG_LABELS: Record<I18nLang, string> = {
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  en: "English",
};

/** 简短语种标签（切换器按钮上的短写） */
export const I18N_LANG_SHORT: Record<I18nLang, string> = {
  "zh-CN": "简",
  "zh-TW": "繁",
  en: "EN",
};

export function parseLangs(s: SiteSettings): I18nLang[] {
  return s.i18n_langs
    .split(",")
    .map(x => x.trim())
    .filter((x): x is I18nLang => (I18N_LANGS as readonly string[]).includes(x));
}

/** 访问地（ISO 3166-1 alpha-2）→ 语言 */
function countryToLang(cc: string): I18nLang | null {
  const c = (cc || "").toUpperCase();
  if (!c) return null;
  if (c === "CN") return "zh-CN";
  if (c === "TW" || c === "HK" || c === "MO") return "zh-TW";
  // XX=无法判定地区，T1=Tor 出口：不做地理判定，回退浏览器语言
  if (c === "XX" || c === "T1") return null;
  return "en";
}

/** 解析 Accept-Language，按 q 值排序返回候选语言 */
function parseAcceptLanguage(header: string): I18nLang[] {
  const picks: { lang: I18nLang; q: number }[] = [];
  (header || "")
    .split(",")
    .forEach(part => {
      const [tag, ...params] = part.trim().split(";");
      if (!tag) return;
      const qParam = params.find(p => p.trim().startsWith("q="));
      const q = qParam ? parseFloat(qParam.split("=")[1]) || 0 : 1;
      const t = tag.toLowerCase();
      // 繁体优先判定：zh-TW / zh-HK / zh-MO 及 zh-Hant
      let lang: I18nLang | null = null;
      if (t.startsWith("zh-hant") || t.startsWith("zh-tw") || t.startsWith("zh-hk") || t.startsWith("zh-mo")) {
        lang = "zh-TW";
      } else if (t.startsWith("zh")) {
        lang = "zh-CN";
      } else if (t.startsWith("en")) {
        lang = "en";
      }
      if (lang) picks.push({ lang, q });
    });
  return picks.sort((a, b) => b.q - a.q).map(p => p.lang);
}

export interface DetectInput {
  cookie: string | null;
  country: string | null; // cf-ipcountry
  acceptLanguage: string | null;
}

/**
 * 判定当前请求应使用的语言。
 * i18n 关闭时直接返回默认语言。
 */
export function detectLang(s: SiteSettings, input: DetectInput): I18nLang {
  const enabledLangs = parseLangs(s);
  const def = (enabledLangs.includes(s.i18n_default as I18nLang)
    ? s.i18n_default
    : enabledLangs[0] || "zh-CN") as I18nLang;
  if (!s.i18n_enabled) return def;
  const allow = (l: I18nLang | null | undefined): I18nLang | null =>
    l && enabledLangs.includes(l) ? l : null;

  // 1. 用户手动选择的 cookie
  const m = (input.cookie || "").match(/(?:^|;\s*)moments_lang=([^;]+)/);
  if (m) {
    const v = decodeURIComponent(m[1]).trim();
    const hit = allow(v as I18nLang);
    if (hit) return hit;
  }

  if (s.i18n_auto_detect) {
    // 2. 访问地
    const geo = allow(countryToLang(input.country || ""));
    if (geo) return geo;
    // 3. 浏览器语言
    for (const l of parseAcceptLanguage(input.acceptLanguage || "")) {
      const hit = allow(l);
      if (hit) return hit;
    }
  }

  // 4. 默认
  return def;
}
