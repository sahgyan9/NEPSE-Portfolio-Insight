/**
 * Plain status for one holding: "ok", "watch" or "problem", plus the one
 * sentence that explains why.
 *
 * Pure and deterministic: no React, no network, no translation. The caller
 * turns `reasonKey` + `vars` into text with t(). Rules only read fields that
 * useLivePortfolio really fills in (currentPrice, currentValue, totalCost,
 * gainLossPercent, eps, bookValue, sector).
 *
 * The rules describe facts in the numbers. They never say what to do with
 * the share.
 *
 * Order: every rule is checked from most serious to least serious and the
 * first match wins, so a holding shows only its most important reason.
 */
import type { StockHolding } from "@/data/portfolioData";
import { THRESHOLDS } from "@/lib/constants";

export type HoldingStatusLevel = "ok" | "watch" | "problem";

export interface HoldingStatus {
  level: HoldingStatusLevel;
  /** Full translation key, e.g. "simple.reasonLossMaking". */
  reasonKey: string;
  /** Values for the placeholders in the sentence. Numbers are pre-rounded strings. */
  vars: Record<string, string>;
}

export interface HoldingStatusContext {
  /** Current market value of the whole portfolio (sum of currentValue). */
  totalValue: number;
}

/** Share of the portfolio (percent of current value) above which one holding is flagged "watch". Same limit the rest of the app uses. */
export const WATCH_SINGLE_HOLDING_PERCENT = THRESHOLDS.maxSingleHoldingPercent;

/** Share of the portfolio above which one holding is flagged "problem": that much money in one company. */
export const PROBLEM_SINGLE_HOLDING_PERCENT = 40;

/** Unrealised loss (percent below cost) at or beyond which a holding is flagged "problem". */
export const PROBLEM_LOSS_PERCENT = THRESHOLDS.significantLoss; // -20

/** Unrealised loss at or beyond which a holding is flagged "watch". Half of the "problem" limit. */
export const WATCH_LOSS_PERCENT = THRESHOLDS.significantLoss / 2; // -10

/** Sectors that are funds, not companies: they publish NAV, not EPS, so the report-data rules do not apply. */
export const FUND_SECTORS = new Set(["Mutual Fund"]);

type HoldingInput = Pick<
  StockHolding,
  "currentPrice" | "currentValue" | "totalCost" | "gainLossPercent" | "eps" | "bookValue" | "sector"
>;

const round0 = (v: number) => String(Math.round(v));
const round1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1);

const result = (level: HoldingStatusLevel, reason: string, vars: Record<string, string> = {}): HoldingStatus => ({
  level,
  reasonKey: `simple.${reason}`,
  vars,
});

export function getHoldingStatus(holding: HoldingInput, context: HoldingStatusContext): HoldingStatus {
  const isFund = FUND_SECTORS.has(holding.sector);
  const hasPrice = Number.isFinite(holding.currentPrice) && holding.currentPrice > 0;
  const weight =
    hasPrice && context.totalValue > 0 ? (holding.currentValue / context.totalValue) * 100 : null;
  const lossPct =
    hasPrice && holding.totalCost > 0 && Number.isFinite(holding.gainLossPercent) ? holding.gainLossPercent : null;
  const eps = holding.eps;

  // 1. The company reported a loss (negative earnings per share).
  if (!isFund && eps !== null && eps !== undefined && eps < 0) {
    return result("problem", "reasonLossMaking", { eps: round1(eps) });
  }

  // 2. No price today: value and gain below would be wrong, so say so and stop.
  if (!hasPrice) {
    return result("watch", "reasonNoPrice");
  }

  // 3. Very large share of the portfolio in this one holding.
  if (weight !== null && weight > PROBLEM_SINGLE_HOLDING_PERCENT) {
    return result("problem", "reasonVeryConcentrated", { weight: round0(weight) });
  }

  // 4. Price far below what was paid.
  if (lossPct !== null && lossPct <= PROBLEM_LOSS_PERCENT) {
    return result("problem", "reasonBigLoss", { percent: round0(Math.abs(lossPct)) });
  }

  // 5. Large share of the portfolio.
  if (weight !== null && weight > WATCH_SINGLE_HOLDING_PERCENT) {
    return result("watch", "reasonConcentrated", { weight: round0(weight) });
  }

  // 6. Price clearly below what was paid.
  if (lossPct !== null && lossPct <= WATCH_LOSS_PERCENT) {
    return result("watch", "reasonLoss", { percent: round0(Math.abs(lossPct)) });
  }

  // 7. No company report data (EPS and book value both missing).
  if (!isFund && (eps === null || eps === undefined) && (holding.bookValue === null || holding.bookValue === undefined)) {
    return result("watch", "reasonNoData");
  }

  // 8. Nothing above applies.
  if (isFund) {
    return result("ok", "reasonOkFund", { weight: weight !== null ? round0(weight) : "0" });
  }
  return result("ok", "reasonOk", { weight: weight !== null ? round0(weight) : "0" });
}
