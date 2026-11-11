/** De-duplication for news stored per symbol: one article may be attached to many symbols. */

export interface NewsLike {
  headline: string;
  link?: string | null;
  date: string;
}

export interface MergedNews<T extends NewsLike> {
  symbols: string[];
  news: T;
  /** Usable article URL, or null when the item has none of its own */
  url: string | null;
}

const TRACKING = /^(utm_|fbclid|gclid|mc_|ref$|source$)/i;

/** Lowercase host, drop query/tracking params, fragment and trailing slash. */
export const normalizeUrl = (raw?: string | null): string | null => {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    if (!/^https?:$/.test(u.protocol)) return null;
    const path = u.pathname.replace(/\/+$/, "");
    // A bare homepage is a shared generic page, not an article.
    if (path === "") return null;
    const keep = Array.from(u.searchParams.entries()).filter(([k]) => !TRACKING.test(k));
    const q = keep.length ? "?" + keep.map(([k, v]) => `${k}=${v}`).join("&") : "";
    return `${u.protocol}//${u.host.toLowerCase()}${path}${q}`;
  } catch {
    return null;
  }
};

export const normalizeTitle = (t: string): string =>
  t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

/** Merge entries that share a normalised URL or a normalised headline; collect their symbols. */
export const dedupeNews = <T extends NewsLike>(entries: { symbol: string; news: T }[]): MergedNews<T>[] => {
  const byKey = new Map<string, MergedNews<T>>();
  const out: MergedNews<T>[] = [];
  for (const { symbol, news } of entries) {
    const url = normalizeUrl(news.link);
    const title = normalizeTitle(news.headline);
    const keys = [url ? `u:${url}` : null, title ? `t:${title}` : null].filter(Boolean) as string[];
    const hit = keys.map((k) => byKey.get(k)).find(Boolean);
    if (hit) {
      if (!hit.symbols.includes(symbol)) hit.symbols.push(symbol);
      if (!hit.url && url) hit.url = url;
      keys.forEach((k) => byKey.set(k, hit));
    } else {
      const item: MergedNews<T> = { symbols: [symbol], news, url: url ? news.link!.trim() : null };
      keys.forEach((k) => byKey.set(k, item));
      out.push(item);
    }
  }
  return out;
};
