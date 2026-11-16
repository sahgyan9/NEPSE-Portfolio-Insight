/**
 * Fills in research-checklist items that the stored quarterly data can answer.
 *
 * Rules are keyed by item position ("kn:0", "q:1", "rf:2") in src/data/researchGuide.ts.
 * If items are reordered there, the rules below must be updated to match.
 * Result text follows the selected language (research namespace).
 * Anything that needs the report itself (auditor notes, licence years, peer figures)
 * has no rule here and stays manual.
 */
import { getSectorResearch } from '@/data/researchGuide';
import { translate, type TVars } from '@/i18n';
import { fmtMoney, fmtMoneyCompact } from '@/i18n/format';
import type { QuarterRecord } from '@/types/quarterly';

/**
 * found    - a key number was read from the data
 * answered - a question was answered, and the answer is not a concern
 * clear    - a red flag was tested and is not present
 * flagged  - a red flag is present, or a question has the worrying answer
 * suspect  - the stored value is outside any believable range; not ticked
 */
export type AutoStatus = 'found' | 'answered' | 'clear' | 'flagged' | 'suspect';

export interface AutoCheck {
    status: AutoStatus;
    detail: string;
}

interface Ctx {
    r: Record<string, number | null>;
    /** Same quarter of the previous fiscal year, if stored. */
    prev: Record<string, number | null> | null;
}

type Rule = (c: Ctx) => AutoCheck | null;

const num = (r: Record<string, number | null> | null, ...keys: string[]): number | null => {
    if (!r) return null;
    for (const k of keys) {
        const v = r[k];
        if (typeof v === 'number' && Number.isFinite(v)) return v;
    }
    return null;
};

const f = (v: number, digits = 2) =>
    v.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signed = (v: number, digits = 1) => `${v > 0 ? '+' : ''}${f(v, digits)}%`;
const crore = (v: number) => fmtMoneyCompact(v);
const tr = (key: string, vars?: TVars) => translate(`research.${key}`, vars);
const yesNo = (yes: boolean) => tr(yes ? 'auto_yes' : 'auto_no');

/** A percentage field with the range outside which the stored value is a data fault. */
interface PctSpec {
    /** Key in the research namespace */
    label: string;
    keys: string[];
    lo: number;
    hi: number;
}

// Some stored quarters hold percentages without the decimal point (11.12 as 1112).
// The ranges below reject those instead of reporting them as real.
const NPL: PctSpec = { label: 'label_npl', keys: ['NPL'], lo: 0, hi: 30 };
const CAR: PctSpec = { label: 'label_car', keys: ['CAR'], lo: -20, hi: 60 };
const CD: PctSpec = { label: 'label_cd', keys: ['Credit To Deposit Ratio', 'CD ratio'], lo: 10, hi: 150 };
const COF: PctSpec = { label: 'label_cof', keys: ['Cost of funds'], lo: 0, hi: 20 };
const SPREAD: PctSpec = { label: 'label_spread', keys: ['Interest Spread Rate'], lo: 0, hi: 10 };

const suspect = (label: string, v: number): AutoCheck => ({
    status: 'suspect',
    detail: tr('auto_suspect', { label: tr(label), v: f(v) }),
});

type Read = { v: number } | { bad: AutoCheck } | null;

const read = (c: Ctx, s: PctSpec): Read => {
    const v = num(c.r, ...s.keys);
    if (v == null) return null;
    return v < s.lo || v > s.hi ? { bad: suspect(s.label, v) } : { v };
};

const pct = (...specs: PctSpec[]): Rule => (c) => {
    const parts: string[] = [];
    for (const s of specs) {
        const x = read(c, s);
        if (!x) return null;
        if ('bad' in x) return x.bad;
        parts.push(tr('auto_pct', { label: tr(s.label), v: f(x.v) }));
    }
    return { status: 'found', detail: parts.join(', ') };
};

const above = (s: PctSpec, limit: number): Rule => (c) => {
    const x = read(c, s);
    if (!x) return null;
    if ('bad' in x) return x.bad;
    return x.v > limit
        ? { status: 'flagged', detail: tr('auto_above', { label: tr(s.label), v: f(x.v), limit }) }
        : { status: 'clear', detail: tr('auto_notAbove', { label: tr(s.label), v: f(x.v), limit }) };
};

const debtToEquity = (c: Ctx): number | null => {
    const debt = num(c.r, 'Borrowings', 'Loans and Borrowings');
    const equity = num(c.r, 'Total Equity');
    if (debt == null || equity == null || equity <= 0) return null;
    const de = debt / equity;
    return de >= 0 && de < 20 ? de : null;
};

const deFound: Rule = (c) => {
    const de = debtToEquity(c);
    return de == null ? null : { status: 'found', detail: tr('auto_de', { v: f(de) }) };
};

const deAbove = (limit: number): Rule => (c) => {
    const de = debtToEquity(c);
    if (de == null) return null;
    return de > limit
        ? { status: 'flagged', detail: tr('auto_deAbove', { v: f(de), limit }) }
        : { status: 'clear', detail: tr('auto_deNotAbove', { v: f(de), limit }) };
};

const carFloorQuestion = (floor: number): Rule => (c) => {
    const x = read(c, CAR);
    if (!x) return null;
    if ('bad' in x) return x.bad;
    const gap = x.v - floor;
    const vars = { answer: yesNo(gap < 0.5), v: f(x.v), gap: f(Math.abs(gap)), floor };
    return {
        status: gap < 0.5 ? 'flagged' : 'answered',
        detail: tr(gap >= 0 ? 'auto_carAboveFloor' : 'auto_carBelowFloor', vars),
    };
};

const carNearFloor = (floor: number): Rule => (c) => {
    const x = read(c, CAR);
    if (!x) return null;
    if ('bad' in x) return x.bad;
    return x.v < floor + 0.5
        ? { status: 'flagged', detail: tr('auto_carNear', { v: f(x.v), floor }) }
        : { status: 'clear', detail: tr('auto_carClear', { v: f(x.v), gap: f(x.v - floor) }) };
};

const distributablePerShare: Rule = (c) => {
    const dist = num(c.r, 'Distributable Profit');
    const shares = num(c.r, 'Number of Shares');
    if (dist == null || shares == null || shares <= 0) return null;
    return { status: 'found', detail: tr('auto_distPerShare', { v: fmtMoney(dist / shares, true) }) };
};

const distributableVsNet: Rule = (c) => {
    const dist = num(c.r, 'Distributable Profit');
    const net = num(c.r, 'Net Profit');
    if (dist == null || net == null || net <= 0) return null;
    if (dist < 0) {
        return { status: 'flagged', detail: tr('auto_distNegative', { dist: crore(dist), net: crore(net) }) };
    }
    const share = (dist / net) * 100;
    // "Much lower" is taken as under half of net profit.
    return {
        status: share < 50 ? 'flagged' : 'answered',
        detail: tr('auto_distShare', { answer: yesNo(share < 50), share: f(share, 0), dist: crore(dist), net: crore(net) }),
    };
};

const borrowingsAgainstDeposits: Rule = (c) => {
    const b = num(c.r, 'Borrowings');
    const d = num(c.r, 'Deposits from Customers');
    if (b == null || d == null) return null;
    return { status: 'found', detail: tr('auto_borrowDeposits', { b: crore(b), d: crore(d) }) };
};

const wholesaleDependence: Rule = (c) => {
    const b = num(c.r, 'Borrowings');
    const d = num(c.r, 'Deposits from Customers');
    if (b == null || d == null || b + d <= 0) return null;
    return { status: 'answered', detail: tr('auto_wholesale', { v: f((b / (b + d)) * 100, 0) }) };
};

const REVENUE = ['Revenue from Operation', 'Revenue from Operations', 'Revenue'];
const OPERATING_PROFIT = ['Total Operating Profit', 'Operating Profit'];

const operatingMarginOf = (r: Record<string, number | null> | null): number | null => {
    const rev = num(r, ...REVENUE);
    const op = num(r, ...OPERATING_PROFIT);
    return rev == null || op == null || rev <= 0 ? null : (op / rev) * 100;
};

const operatingMargin: Rule = (c) => {
    const m = operatingMarginOf(c.r);
    return m == null ? null : { status: 'found', detail: tr('auto_opMargin', { v: f(m, 1) }) };
};

const marginsFallingSalesRising: Rule = (c) => {
    const now = operatingMarginOf(c.r);
    const before = operatingMarginOf(c.prev);
    const rev = num(c.r, ...REVENUE);
    const revBefore = num(c.prev, ...REVENUE);
    if (now == null || before == null || rev == null || revBefore == null || revBefore <= 0) return null;
    const growth = (rev / revBefore - 1) * 100;
    // Revenue stands in for volume; a fall of over one point is treated as a real fall.
    const hit = growth > 0 && now < before - 1;
    return {
        status: hit ? 'flagged' : 'clear',
        detail: tr('auto_marginTrend', { g: signed(growth), before: f(before, 1), now: f(now, 1) }),
    };
};

const yoy = (keys: string[], label: string): Rule => (c) => {
    const now = num(c.r, ...keys);
    const before = num(c.prev, ...keys);
    if (now == null || before == null || before <= 0) return null;
    const g = (now / before - 1) * 100;
    if (Math.abs(g) > 300) return null;
    return { status: 'found', detail: tr('auto_yoy', { label: tr(label), g: signed(g) }) };
};

const lifeFund: Rule = (c) => {
    const now = num(c.r, 'Insurance Fund');
    if (now == null || now <= 0) return null;
    const before = num(c.prev, 'Insurance Fund');
    return before != null && before > 0
        ? { status: 'found', detail: tr('auto_lifeFundGrowth', { v: crore(now), g: signed((now / before - 1) * 100) }) }
        : { status: 'found', detail: tr('auto_lifeFund', { v: crore(now) }) };
};

const solvency: Rule = (c) => {
    const v = num(c.r, 'Solvency Ratio');
    return v == null ? null : { status: 'found', detail: tr('auto_solvency', { v: f(v) }) };
};

/**
 * Sector name (as in SECTOR_RESEARCH) -> item id -> rule. Ids are positions in the
 * sector's groups ("kn:0" = first key number), the same ids used for saved ticks.
 */
const RULES: Record<string, Record<string, Rule>> = {
    'Commercial Bank': {
        'kn:0': pct(NPL),
        'kn:1': pct(CAR),
        'kn:2': pct(CD),
        'kn:3': pct(COF, SPREAD),
        'kn:4': distributablePerShare,
        'q:1': carFloorQuestion(11),
        'q:2': distributableVsNet,
        'rf:0': above(NPL, 5),
        'rf:1': carNearFloor(11),
    },
    'Development Bank': {
        'kn:0': pct(NPL),
        'kn:1': pct(CAR),
        'kn:2': pct(CD),
        'kn:3': pct(COF),
    },
    'Microfinance': {
        'kn:0': pct(NPL),
        'kn:1': borrowingsAgainstDeposits,
        'kn:2': pct(COF),
        'kn:3': pct(CAR),
        'q:0': wholesaleDependence,
        'rf:0': above(NPL, 5),
    },
    'Hydropower': {
        'kn:0': deFound,
        'rf:0': deAbove(2),
    },
    'Life Insurance': {
        'kn:0': lifeFund,
        'kn:2': solvency,
    },
    'Non-Life Insurance': {
        'kn:1': yoy(['Net Premium'], 'label_netPremium'),
        'kn:3': solvency,
    },
    'Manufacturing': {
        'kn:0': operatingMargin,
        'kn:2': deFound,
        'rf:1': marginsFallingSalesRising,
    },
    'Hotels': {
        'kn:2': deFound,
    },
};

const startYear = (fy: string) => parseInt(fy, 10);

/** Item id ("kn:0", "q:1", "rf:2", matching SectorResearchPanel) -> result from the latest quarter. */
export function evaluateResearchChecks(sector: string, quarters: QuarterRecord[]): Record<string, AutoCheck> {
    const info = getSectorResearch(sector);
    const latest = quarters[quarters.length - 1];
    const rules = info ? RULES[info.sector] : undefined;
    if (!info || !latest?.raw || !rules) return {};

    const prevQ = quarters.find((q) => q.quarter === latest.quarter && startYear(q.fy) === startYear(latest.fy) - 1);
    const ctx: Ctx = { r: latest.raw, prev: prevQ?.raw ?? null };

    const out: Record<string, AutoCheck> = {};
    for (const [id, rule] of Object.entries(rules)) {
        const result = rule(ctx);
        if (result) out[id] = result;
    }
    return out;
}

/** True when the result counts as a tick. A suspect value is shown but not ticked. */
export const isAutoTicked = (c: AutoCheck | undefined) => !!c && c.status !== 'suspect';
