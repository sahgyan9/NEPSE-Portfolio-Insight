/**
 * Money, number and date formatting that follows the selected language.
 *
 * Digits stay Latin (0-9) in both languages so amounts match what investors
 * see in Meroshare and TMS. Grouping is lakh/crore (12,50,000).
 * Dates are shown in Bikram Sambat.
 */
import NepaliDate from "nepali-date-converter";
import { getLang } from "./index";

const grouped = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const grouped2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const isBad = (v: number | null | undefined): v is null | undefined =>
  v === null || v === undefined || Number.isNaN(v);

export const currencyPrefix = (): string => (getLang() === "ne" ? "रु." : "Rs.");

/** रु. 12,50,000  /  Rs. 12,50,000 */
export const fmtMoney = (v: number | null | undefined, decimals = false): string => {
  if (isBad(v)) return "-";
  const sign = v < 0 ? "-" : "";
  const body = decimals ? grouped2.format(Math.abs(v)) : grouped.format(Math.round(Math.abs(v)));
  return `${sign}${currencyPrefix()} ${body}`;
};

/** रु. 12.50 लाख  /  Rs. 12.50 lakh. For tight labels and plain sentences. */
export const fmtMoneyCompact = (v: number | null | undefined): string => {
  if (isBad(v)) return "-";
  const ne = getLang() === "ne";
  const a = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  const p = currencyPrefix();
  if (a >= 1e7) return `${sign}${p} ${(a / 1e7).toFixed(2)} ${ne ? "करोड" : "crore"}`;
  if (a >= 1e5) return `${sign}${p} ${(a / 1e5).toFixed(2)} ${ne ? "लाख" : "lakh"}`;
  if (a >= 1e3) return `${sign}${p} ${(a / 1e3).toFixed(1)} ${ne ? "हजार" : "thousand"}`;
  return `${sign}${p} ${a.toFixed(0)}`;
};

/** 12,50,000 without a currency prefix */
export const fmtNumber = (v: number | null | undefined): string => (isBad(v) ? "-" : grouped.format(Math.round(v)));

/** Percent number (4.2) to "+4.2%" */
export const fmtPercent = (v: number | null | undefined, digits = 1, signed = true): string => {
  if (isBad(v)) return "-";
  return `${signed && v > 0 ? "+" : ""}${v.toFixed(digits)}%`;
};

const toDate = (d: string | Date): Date | null => {
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date;
};

const EN_MONTHS = ["Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"];
const NE_MONTHS = ["बैशाख", "जेठ", "असार", "साउन", "भदौ", "असोज", "कात्तिक", "मंसिर", "पुस", "माघ", "फागुन", "चैत"];

/** Bikram Sambat parts for a date, or null when it is outside the supported range. */
export const toBS = (d: string | Date): { year: number; month: number; day: number } | null => {
  const date = toDate(d);
  if (!date) return null;
  try {
    const bs = new NepaliDate(date);
    return { year: bs.getYear(), month: bs.getMonth(), day: bs.getDate() };
  } catch {
    return null;
  }
};

/** BS month name by 0-based index (0 = Baisakh) */
export const bsMonthName = (monthIndex: number): string =>
  (getLang() === "ne" ? NE_MONTHS : EN_MONTHS)[monthIndex] ?? "";

/** "29 कात्तिक 2083"  /  "29 Kartik 2083". Falls back to the input when it cannot be parsed. */
export const fmtDate = (d: string | Date | null | undefined): string => {
  if (!d) return "-";
  const bs = toBS(d);
  if (!bs) return typeof d === "string" ? d : "-";
  return `${bs.day} ${bsMonthName(bs.month)} ${bs.year}`;
};

/** "कात्तिक 2083"  /  "Kartik 2083" */
export const fmtMonthYear = (d: string | Date | null | undefined): string => {
  if (!d) return "-";
  const bs = toBS(d);
  if (!bs) return typeof d === "string" ? d : "-";
  return `${bsMonthName(bs.month)} ${bs.year}`;
};

/** Gregorian date for places that must match an external source: "15 Nov 2026" */
export const fmtDateAD = (d: string | Date | null | undefined): string => {
  if (!d) return "-";
  const date = toDate(d);
  if (!date) return typeof d === "string" ? d : "-";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

/** Nepal fiscal year (Shrawan to Ashadh) containing the date, as "2083/84" */
export const fiscalYearOf = (d: string | Date = new Date()): string => {
  const bs = toBS(d);
  if (!bs) return "";
  const start = bs.month >= 3 ? bs.year : bs.year - 1; // month index 3 = Shrawan
  return `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
};
