/**
 * Money, number and date formatting that follows the selected language.
 *
 * Digits stay Latin (0-9) in both languages so amounts match what investors
 * see in Meroshare and TMS. Grouping is lakh/crore (12,50,000).
 * Dates follow the user's date-system choice: Bikram Sambat (default) or AD.
 * The fiscal year is always Nepali (Shrawan to Ashadh), whatever the choice.
 */
import NepaliDate from "nepali-date-converter";
import { getCalendar, getLang } from "./index";

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

const AD_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const AD_NE = ["जनवरी", "फेब्रुअरी", "मार्च", "अप्रिल", "मे", "जुन", "जुलाई", "अगस्ट", "सेप्टेम्बर", "अक्टोबर", "नोभेम्बर", "डिसेम्बर"];

/** Day, month name and year in the chosen date system, or null when the date cannot be read. */
const dateParts = (d: string | Date): { day: number; month: string; year: number } | null => {
  if (getCalendar() === "ad") {
    const date = toDate(d);
    if (!date) return null;
    const names = getLang() === "ne" ? AD_NE : AD_EN;
    return { day: date.getDate(), month: names[date.getMonth()], year: date.getFullYear() };
  }
  const bs = toBS(d);
  return bs ? { day: bs.day, month: bsMonthName(bs.month), year: bs.year } : null;
};

/** "29 कात्तिक 2083" / "29 Kartik 2083", or "15 Nov 2026" when AD is chosen. Falls back to the input. */
export const fmtDate = (d: string | Date | null | undefined): string => {
  if (!d) return "-";
  const p = dateParts(d);
  if (!p) return typeof d === "string" ? d : "-";
  return `${p.day} ${p.month} ${p.year}`;
};

/** "कात्तिक 2083" / "Kartik 2083", or "Nov 2026" when AD is chosen. */
export const fmtMonthYear = (d: string | Date | null | undefined): string => {
  if (!d) return "-";
  const p = dateParts(d);
  if (!p) return typeof d === "string" ? d : "-";
  return `${p.month} ${p.year}`;
};

/** "29 कात्तिक" / "29 Kartik", or "15 Nov" when AD is chosen. For short chart labels. */
export const fmtDayMonth = (d: string | Date | null | undefined): string => {
  if (!d) return "-";
  const p = dateParts(d);
  if (!p) return typeof d === "string" ? d : "-";
  return `${p.day} ${p.month}`;
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
