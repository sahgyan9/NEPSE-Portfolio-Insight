/** Small helpers shared by the risk components. */
import { sectorLabel } from "@/lib/findingText";
import type { RiskData } from "@/services/riskApi";

export type RiskGrouping = "sector" | "holding";

/** Server sends an English level ("Lower than the market"); map it to a translation key. */
export const riskLevelKey = (level: string): string =>
  level.startsWith("Lower")
    ? "risk.levelLower"
    : level.startsWith("Similar")
      ? "risk.levelSimilar"
      : level.startsWith("Higher")
        ? "risk.levelHigher"
        : "risk.levelUnknown";

/** 0.1234 -> "12.3" (no % sign), for sentences that place the sign themselves. */
export const pctNum = (frac: number, digits = 1): string => (frac * 100).toFixed(digits);

/** Most-linked distinct pairs from a correlation matrix, strongest first. */
export const topPairs = (symbols: string[], matrix: number[][], count = 3) => {
  const pairs: { a: string; b: string; v: number }[] = [];
  for (let i = 0; i < symbols.length; i++) {
    for (let j = i + 1; j < symbols.length; j++) {
      const v = matrix[i]?.[j];
      if (typeof v === "number" && Number.isFinite(v)) pairs.push({ a: symbols[i], b: symbols[j], v });
    }
  }
  return pairs.sort((x, y) => y.v - x.v).slice(0, count);
};

/** One sentence naming the biggest source of risk, for the plain summary and the chart subtitle. */
export const topRiskSentence = (risk: RiskData | undefined, mode: RiskGrouping, t: (k: string, v?: Record<string, string | number>) => string) => {
  if (!risk) return "";
  const list =
    mode === "sector"
      ? risk.sectors.map((s) => ({ name: sectorLabel(s.sector), weight: s.weight, riskShare: s.riskShare }))
      : risk.holdings.map((h) => ({ name: h.symbol, weight: h.weight, riskShare: h.riskShare }));
  const top = [...list].sort((a, b) => b.riskShare - a.riskShare)[0];
  if (!top) return "";
  return t(mode === "sector" ? "risk.topSector" : "risk.topHolding", {
    name: top.name,
    risk: pctNum(top.riskShare),
    weight: pctNum(top.weight),
  });
};
