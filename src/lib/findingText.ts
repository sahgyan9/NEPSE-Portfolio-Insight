/**
 * Builds a risk finding's sentences in the current language.
 *
 * The server (tools/portfolio_risk.py) sends each finding with an English title and
 * detail plus a `params` object holding the raw numbers. Here the same sentence is
 * rebuilt from the `findings.<code>_title` / `findings.<code>_detail` templates.
 * When the code is unknown or params are missing (an older cached report), the
 * server's English text is shown unchanged.
 */
import { translate } from "@/i18n";
import type { RiskFinding } from "@/services/riskApi";

type Vars = Record<string, string | number>;
type Params = NonNullable<RiskFinding["params"]>;

const num = (v: unknown, digits: number): string | null =>
  typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : null;

const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

/** Sector names come from the server in English; show a Nepali name when one is known. */
export const sectorLabel = (sector: string): string => {
  const key = `findings.sector_${sector.toLowerCase().replace(/[^a-z]/g, "")}`;
  const out = translate(key);
  return out === key ? sector : out;
};

/** Each builder returns the template variables, or null when a needed value is missing. */
const BUILDERS: Record<string, (p: Params) => Vars | null> = {
  fund_concentration: (p) => {
    const symbol = str(p.symbol), weight = num(p.weightPct, 1);
    return symbol && weight ? { symbol, weight } : null;
  },
  concentration: (p) => {
    const symbol = str(p.symbol), weight = num(p.weightPct, 1);
    const threshold = num(p.thresholdPct, 0) ?? "20";
    return symbol && weight ? { symbol, weight, threshold } : null;
  },
  risk_heavy: (p) => {
    const symbol = str(p.symbol), risk = num(p.riskPct, 1), weight = num(p.weightPct, 1);
    return symbol && risk && weight ? { symbol, risk, weight } : null;
  },
  sector_risk: (p) => {
    const sector = str(p.sector), risk = num(p.riskPct, 1), weight = num(p.weightPct, 1);
    return sector && risk && weight ? { sector: sectorLabel(sector), risk, weight } : null;
  },
  correlated_pair: (p) => {
    const a = str(p.symbolA), b = str(p.symbolB), corr = num(p.correlation, 2);
    return a && b && corr ? { a, b, corr } : null;
  },
  above_market_risk: (p) => {
    const ratio = num(p.ratio, 1), vol = num(p.volatilityPct, 1), market = num(p.marketVolatilityPct, 1);
    return ratio && vol && market ? { ratio, vol, market } : null;
  },
  few_effective_holdings: (p) => {
    const effective = num(p.effective, 0), holdings = num(p.holdings, 0);
    return effective && holdings ? { effective, holdings } : null;
  },
  coverage: (p) => {
    const measured = num(p.measuredPct, 0);
    return measured ? { measured } : null;
  },
  vs_benchmark: (p) => {
    const xirr = num(p.xirrPct, 1), bench = num(p.benchmarkPct, 1);
    return xirr && bench && typeof p.ahead === "boolean" ? { xirr, bench } : null;
  },
};

/** Template key for the detail line; vs_benchmark has two versions. */
const detailKey = (f: RiskFinding): string => {
  if (f.code === "vs_benchmark") return `findings.vs_benchmark_detail_${f.params?.ahead ? "ahead" : "behind"}`;
  return `findings.${f.code}_detail`;
};

const fill = (key: string, vars: Vars): string | null => {
  const out = translate(key, vars);
  // Missing key (translate returns the key) or an unfilled placeholder: do not show half a sentence.
  if (out === key || /\{\w+\}/.test(out)) return null;
  return out;
};

export const findingText = (f: RiskFinding): { title: string; detail: string } => {
  const fallback = { title: f.title, detail: f.detail };
  const build = BUILDERS[f.code];
  if (!build || !f.params || typeof f.params !== "object") return fallback;
  const vars = build(f.params);
  if (!vars) return fallback;
  const title = fill(`findings.${f.code}_title`, vars);
  const detail = fill(detailKey(f), vars);
  if (!title || !detail) return fallback;
  return { title, detail };
};
