/** Number formatting helpers shared by all charts. NPR uses lakh/crore wording. */

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** Rs. 12,34,567 (Indian digit grouping) */
export const fmtRs = (v: number | null | undefined): string =>
  v === null || v === undefined || Number.isNaN(v) ? "-" : `Rs. ${inr.format(Math.round(v))}`;

/** Compact: Rs. 1.20 lakh, Rs. 3.40 cr. Used on tight labels. */
export const fmtRsCompact = (v: number | null | undefined): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return "-";
  const a = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (a >= 1e7) return `${sign}Rs. ${(a / 1e7).toFixed(2)} cr`;
  if (a >= 1e5) return `${sign}Rs. ${(a / 1e5).toFixed(2)} lakh`;
  if (a >= 1e3) return `${sign}Rs. ${(a / 1e3).toFixed(1)}k`;
  return `${sign}Rs. ${a.toFixed(0)}`;
};

/** Axis version without the currency prefix */
export const fmtAxisCompact = (v: number): string => {
  const a = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (a >= 1e7) return `${sign}${(a / 1e7).toFixed(1)}cr`;
  if (a >= 1e5) return `${sign}${(a / 1e5).toFixed(1)}L`;
  if (a >= 1e3) return `${sign}${(a / 1e3).toFixed(0)}k`;
  return `${sign}${a.toFixed(0)}`;
};

/** Fraction (0.158) to "15.8%" */
export const fmtFrac = (v: number | null | undefined, digits = 1): string =>
  v === null || v === undefined || Number.isNaN(v) ? "-" : `${(v * 100).toFixed(digits)}%`;

/** Fraction with explicit sign: "+4.2%" */
export const fmtFracSigned = (v: number | null | undefined, digits = 1): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return "-";
  const p = v * 100;
  return `${p > 0 ? "+" : ""}${p.toFixed(digits)}%`;
};

/** Percent number (4.2) with sign */
export const fmtPctSigned = (v: number | null | undefined, digits = 1): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return "-";
  return `${v > 0 ? "+" : ""}${v.toFixed(digits)}%`;
};

export const fmtDateShort = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
};

export const fmtDateLong = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};
