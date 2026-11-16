/**
 * Plain-language definitions shown by the Explain popover and the Learn page.
 *
 * Text lives in the `glossary` locale namespace as <key>_title, <key>_text and,
 * optionally, <key>_example (src/i18n/locales/<lang>/glossary.ts). This module holds
 * only the list of keys, their groups, and helpers that read the current language.
 */
import { translate } from "@/i18n";

export const GLOSSARY_KEYS = [
  // Risk and portfolio measures
  "volatility",
  "volatilityVsMarket",
  "maxDrawdown",
  "var95",
  "cvar95",
  "beta",
  "riskShare",
  "weight",
  "correlation",
  "diversificationRatio",
  "effectiveHoldings",
  "xirr",
  "benchmarkXirr",
  "return1y",
  // Company numbers
  "pe",
  "sectorMedianPe",
  "pb",
  "roe",
  "eps",
  "ttmEps",
  "annualizedEps",
  "peAtCost",
  "yieldOnCost",
  "shareOfProfit",
  "dividendYield",
  "healthScore",
  "sectorLeaders",
  "growthOf100",
  "proxied",
  // Basics
  "shareKitta",
  "faceValue",
  "ipo",
  "fpo",
  "ltp",
  "wacc",
  "marketCap",
  "paidUpCapital",
  "promoterShare",
  "lockIn",
  "settlementT2",
  "edis",
  "collateral",
  "nepseIndex",
  "sectorIndex",
  "nav",
  "unrealisedGain",
  // Dividends and corporate actions
  "cashDividend",
  "bonusShare",
  "rightShare",
  "bookClosure",
  "priceAdjustment",
  // Company numbers (banks)
  "bookValue",
  "npl",
  "car",
  // Costs and tax
  "brokerCommission",
  "dpCharge",
  "capitalGainsTax",
  // Risk
  "circuitBreaker",
  "diversification",
  "operatorActivity",
  "socialTip",
] as const;

export type GlossaryKey = (typeof GLOSSARY_KEYS)[number];

export interface GlossaryEntry {
  title: string;
  text: string;
  example?: string;
}

const optional = (key: string): string | undefined => {
  const value = translate(key);
  // translate() returns the key itself when no language has the entry.
  return value === key ? undefined : value;
};

/** Title, explanation and optional rupee example in the current language. */
export const getGlossaryEntry = (key: GlossaryKey): GlossaryEntry => ({
  title: translate(`glossary.${key}_title`),
  text: translate(`glossary.${key}_text`),
  example: optional(`glossary.${key}_example`),
});

export const isGlossaryKey = (key: string): key is GlossaryKey => (GLOSSARY_KEYS as readonly string[]).includes(key);

/**
 * Backwards-compatible map: GLOSSARY[key].title / .text / .example read the
 * current language each time they are accessed.
 */
export const GLOSSARY = Object.fromEntries(
  GLOSSARY_KEYS.map((key) => [
    key,
    {
      get title() {
        return translate(`glossary.${key}_title`);
      },
      get text() {
        return translate(`glossary.${key}_text`);
      },
      get example() {
        return optional(`glossary.${key}_example`);
      },
    },
  ])
) as Record<GlossaryKey, GlossaryEntry>;

export type GlossaryGroupId = "basics" | "company" | "dividends" | "costs" | "risk";

/** Groups used by the searchable list on the Learn page. Every key appears exactly once. */
export const GLOSSARY_GROUPS: { id: GlossaryGroupId; keys: GlossaryKey[] }[] = [
  {
    id: "basics",
    keys: [
      "shareKitta", "faceValue", "ipo", "fpo", "ltp", "wacc", "unrealisedGain", "marketCap", "paidUpCapital",
      "promoterShare", "lockIn", "settlementT2", "edis", "collateral", "nepseIndex", "sectorIndex", "nav",
      "xirr", "benchmarkXirr", "return1y", "growthOf100",
    ],
  },
  {
    id: "company",
    keys: [
      "eps", "ttmEps", "annualizedEps", "pe", "sectorMedianPe", "peAtCost", "yieldOnCost", "shareOfProfit",
      "bookValue", "pb", "roe", "npl", "car", "healthScore", "sectorLeaders",
    ],
  },
  {
    id: "dividends",
    keys: ["cashDividend", "dividendYield", "bonusShare", "rightShare", "bookClosure", "priceAdjustment"],
  },
  {
    id: "costs",
    keys: ["brokerCommission", "dpCharge", "capitalGainsTax"],
  },
  {
    id: "risk",
    keys: [
      "diversification", "volatility", "volatilityVsMarket", "beta", "maxDrawdown", "var95", "cvar95", "correlation",
      "diversificationRatio", "effectiveHoldings", "weight", "riskShare", "proxied", "circuitBreaker",
      "operatorActivity", "socialTip",
    ],
  },
];
