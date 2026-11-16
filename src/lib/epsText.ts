/**
 * Builds EPS insight sentences in the current language.
 *
 * tools/eps_insights.py sends each flag and note with an English `text` plus `code` and
 * `params` (raw values). Here the sentence is rebuilt from the `eps.*` templates. When the
 * code is unknown, params are missing (insights saved before this change) or a value is
 * missing, the server's English text is shown unchanged. Same pattern as findingText.ts.
 */
import { translate } from "@/i18n";
import { fmtMoney } from "@/i18n/format";
import { sectorLabel } from "@/data/researchGuide";
import type { EpsFlag, EpsHolding, EpsNote, EpsParams, EpsSkipped } from "@/services/epsInsightsApi";

type Vars = Record<string, string | number>;

const fixed = (digits: number) => (v: unknown): string | null =>
  typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : null;
/** Rupees per share with paisa: "रु. 13.58" / "Rs. 13.58". */
const rupees = (v: unknown): string | null =>
  typeof v === "number" && Number.isFinite(v) ? fmtMoney(v, true) : null;
/** Growth is shown as a size ("40% lower"), so the sign is dropped. */
const absPct = (v: unknown): string | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.abs(v).toFixed(0) : null;
const sector = (v: unknown): string | null => (typeof v === "string" && v ? sectorLabel(v) : null);

/** Server param name to [template variable, formatter]. */
const PARAMS: Record<string, [string, (v: unknown) => string | null]> = {
  growthPct: ["pct", absPct],
  peAtCost: ["pac", fixed(1)],
  marketPe: ["mpe", fixed(1)],
  sectorPe: ["sectorPe", fixed(1)],
  annualizedEps: ["ann", rupees],
  sector: ["sector", sector],
};

const toVars = (code: string, params: EpsParams): Vars => {
  const vars: Vars = {};
  for (const [name, raw] of Object.entries(params)) {
    if (name === "ttmEps") {
      // The loss sentence calls it {eps}; the annualized comparisons call it {ttm}.
      const out = rupees(raw);
      if (out !== null) vars[code === "LOSS" ? "eps" : "ttm"] = out;
      continue;
    }
    const spec = PARAMS[name];
    if (!spec) continue;
    const out = spec[1](raw);
    if (out !== null) vars[spec[0]] = out;
  }
  return vars;
};

const fill = (key: string, vars: Vars): string | null => {
  const out = translate(key, vars);
  if (out === key || /\{\w+\}/.test(out)) return null;
  return out;
};

/** Template key for a flag; PROFIT_FALLING has one sentence per variant. */
const flagKey = (f: EpsFlag): string | null => {
  if (f.code === "PROFIT_FALLING") {
    const variant = f.params?.variant;
    return typeof variant === "string" ? `eps.flag_PROFIT_FALLING_${variant}` : null;
  }
  return `eps.flag_${f.code}`;
};

export const epsFlagText = (f: EpsFlag): string => {
  if (!f.params || typeof f.params !== "object") return f.text;
  const key = flagKey(f);
  if (!key) return f.text;
  return fill(key, toVars(f.code, f.params)) ?? f.text;
};

const noteText = (n: EpsNote): string =>
  n.params && typeof n.params === "object" ? fill(`eps.note_${n.code}`, toVars(n.code, n.params)) ?? n.text : n.text;

/** A holding's notes in the current language; the plain English list when items are absent. */
export const epsNotes = (h: EpsHolding): string[] =>
  Array.isArray(h.note_items) ? h.note_items.map(noteText) : h.notes;

/** Reason a holding was left out, or null when the server sent no reason code. */
export const skipReasonText = (s: EpsSkipped): string | null =>
  s.reason_code ? fill(`eps.skip_${s.reason_code}`, {}) : null;
