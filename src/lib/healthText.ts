/**
 * Builds the portfolio health card's sentences in the current language.
 *
 * tools/portfolio_health.py sends each strength, warning, thing to check and summary part as
 * { code, params, text }: `text` is the English sentence and `params` holds the raw values.
 * Here the sentence is rebuilt from the `health.<code>` template. When the code is unknown,
 * params are missing (a report saved before this change) or a value is missing, the server's
 * English text is shown unchanged. Same pattern as src/lib/findingText.ts.
 */
import { translate } from "@/i18n";
import { fmtMoney, fmtNumber } from "@/i18n/format";
import { findingText, sectorLabel } from "@/lib/findingText";
import type { RiskFinding } from "@/services/riskApi";
import type { PortfolioHealthResponse } from "@/services/portfolioDb";

type Vars = Record<string, string | number>;

export interface HealthTextItem {
  code: string;
  params?: Record<string, unknown> | null;
  text: string;
}

export type HealthPillarId = "structure" | "fundamentals" | "valuation" | "dividend" | "volatility";

/** Fields added to the health report for translation. All optional: older saved reports lack them. */
export interface HealthResponseItems {
  strengthItems?: HealthTextItem[];
  warningItems?: HealthTextItem[];
  recommendationItems?: HealthTextItem[];
  summaryItems?: HealthTextItem[];
}
export type HealthResponseWithItems = PortfolioHealthResponse & HealthResponseItems;

const fixed = (digits: number) => (v: unknown): string | null =>
  typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : null;
const text = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const count = (v: unknown): string | null => (typeof v === "number" && Number.isFinite(v) ? fmtNumber(v) : null);
const money = (v: unknown): string | null => (typeof v === "number" && Number.isFinite(v) ? fmtMoney(v) : null);
const sector = (v: unknown): string | null => {
  const s = text(v);
  return s ? sectorLabel(s) : null;
};

/** How each server param becomes a template variable: [variable name, formatter]. */
const PARAMS: Record<string, [string, (v: unknown) => string | null]> = {
  symbol: ["symbol", text],
  sector: ["sector", sector],
  grade: ["grade", text],
  score: ["score", fixed(0)],
  weightPct: ["weight", fixed(1)],
  limitPct: ["limit", fixed(0)],
  targetPct: ["target", fixed(0)],
  thresholdPct: ["threshold", fixed(0)],
  shares: ["shares", count],
  amount: ["amount", money],
  value: ["value", money],
  sectors: ["sectors", fixed(0)],
  carPct: ["car", fixed(2)],
  cdPct: ["cd", fixed(2)],
  cofPct: ["cof", fixed(2)],
  nplPct: ["npl", fixed(2)],
  de: ["de", fixed(2)],
  limit: ["limit", fixed(1)],
  promoterPct: ["promoter", fixed(1)],
  avgVolume: ["volume", count],
  pe: ["pe", fixed(1)],
  sectorPe: ["sectorPe", fixed(1)],
  roePct: ["roe", fixed(1)],
  yieldPct: ["yield", fixed(2)],
  ratio: ["ratio", fixed(1)],
  lossPct: ["loss", fixed(1)],
};

const toVars = (params: Record<string, unknown>): Vars => {
  const vars: Vars = {};
  for (const [name, raw] of Object.entries(params)) {
    const spec = PARAMS[name];
    if (!spec) continue;
    const out = spec[1](raw);
    if (out !== null) vars[spec[0]] = out;
  }
  return vars;
};

const fill = (key: string, vars: Vars): string | null => {
  const out = translate(key, vars);
  // Missing key, or a placeholder left unfilled because a value was missing: use the fallback.
  if (out === key || /\{\w+\}/.test(out)) return null;
  return out;
};

/** One server line in the current language, or its English text when it cannot be rebuilt. */
export const healthItemText = (item: HealthTextItem): string => {
  if (!item || typeof item.code !== "string" || !item.params || typeof item.params !== "object") {
    return item?.text ?? "";
  }
  let vars: Vars;
  if (item.code === "w_risk_finding") {
    // A risk finding passed through from tools/portfolio_risk.py: reuse its own builder.
    const f = item.params.finding as RiskFinding | undefined;
    if (!f || typeof f !== "object") return item.text;
    const built = findingText(f);
    vars = { title: built.title, detail: built.detail };
  } else {
    vars = toVars(item.params);
  }
  return fill(`health.${item.code}`, vars) ?? item.text;
};

/** List of lines: items when the server sent them, else the plain English list. */
export const healthLines = (items: HealthTextItem[] | undefined, plain: string[] | undefined): string[] =>
  Array.isArray(items) ? items.map(healthItemText) : plain ?? [];

/** Pillar name and description by id, falling back to the server's English. */
export const pillarText = (id: string, name: string, description: string): { name: string; description: string } => {
  const n = translate(`health.pillar_${id}_name`);
  const d = translate(`health.pillar_${id}_desc`);
  return {
    name: n === `health.pillar_${id}_name` ? name : n,
    description: d === `health.pillar_${id}_desc` ? description : d,
  };
};

/** Pillar name and description for the browser-side fallback score (src/lib/valuationScoring.ts). */
export const clientPillarText = (id: string, name: string, description: string) => {
  const n = translate(`health.client_${id}_name`);
  const d = translate(`health.client_${id}_desc`);
  return {
    name: n === `health.client_${id}_name` ? name : n,
    description: d === `health.client_${id}_desc` ? description : d,
  };
};

/**
 * The browser-side fallback (calculatePortfolioHealth) returns English sentences without codes.
 * They are a short fixed list, so they are matched exactly here.
 */
const CLIENT_LINES: Record<string, string> = {
  "Well-diversified portfolio reduces risk": "c_well_diversified",
  "Portfolio concentration is high": "c_concentration_high",
  "Consider adding more stocks to improve diversification": "c_add_stocks",
  "Holdings are generally well-valued": "c_well_valued",
  "Several holdings appear overvalued": "c_overvalued",
  "Review high P/E and P/B ratio stocks for potential rebalancing": "c_review_valuation",
  "Strong dividend income potential": "c_dividend_strong",
  "Consider reducing position in largest holding": "c_reduce_largest",
  "Good sector diversification": "c_good_sectors",
  "Limited sector exposure": "c_limited_sectors",
  "Consider adding stocks from different sectors": "c_add_sectors",
};

export const clientLineText = (line: string): string => {
  const code = CLIENT_LINES[line];
  if (code) return fill(`health.${code}`, {}) ?? line;
  const m = line.match(/^Single stock makes up ([\d.]+)% of portfolio$/);
  if (m) return fill("health.c_single_stock", { weight: m[1] }) ?? line;
  return line;
};
