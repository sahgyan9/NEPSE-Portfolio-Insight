/**
 * Research guide: what to read before buying a NEPSE stock, and where to find it.
 *
 * Adapted to Nepal from the standard retail due-diligence sequence (annual report,
 * investor presentation, offer document, industry report, industry association).
 * Local equivalents:
 *  - DRHP / RHP            -> the prospectus ("Bibaran Patra") filed with SEBON before an IPO/FPO
 *  - Investor presentation -> rare in Nepal; the quarterly report and AGM notice fill the gap
 *  - Industry report       -> regulator statistics (NRB, Nepal Insurance Authority, NEA, NTA)
 *
 * All text lives in the `research` locale namespace. The objects below expose the same
 * fields as before (title, why, keyNumbers, ...) as getters that read the current language,
 * so callers keep working. Checklist ticks are stored by position ("kn:0", "q:1", "rf:2"),
 * so the number and order of items in each group must not change.
 *
 * Regulatory figures (checked 2026-11-15):
 *  - CAR minimum 11% for class A and national-level class B, 10% for other class B and C:
 *    NRB Unified Directive 2082, Directive 1  https://www.nrb.org.np/contents/uploads/2026/01/Unified-Directive-ABC-2082.pdf
 *  - CD ratio ceiling 90% for A/B/C: same document, Directive 5, clause 6(6)
 *  - Microfinance CAR minimum 8% and the dividend cap tied to capital and NPL:
 *    https://www.nrb.org.np/contents/uploads/2026/01/MFI-Unified-Directive-2082.pdf
 *  - Promoter lock-in 3 years: Securities Registration and Issue Regulations 2073, Rule 38(1)
 *    https://www.sebon.gov.np/uploads/2023/09/24/4J6mY5hhWf86mzkHVzIcr83TG8g8YYLpz5miKJrt.pdf
 */
import { translate } from "@/i18n";

const tr = (key: string) => translate(`research.${key}`);
const list = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => tr(`${prefix}${i}`));

export interface ResearchSource {
    name: string;
    url: string;
    what: string;
}

export interface ResearchStep {
    id: string;
    title: string;
    /** The step as one yes/no question a beginner can answer */
    question: string;
    /** One line on where to find what the question needs */
    where: string;
    nepalEquivalent: string;
    why: string;
    lookFor: string[];
    /** How well the document type is available for NEPSE companies. */
    availability: 'good' | 'partial' | 'rare';
    sources: ResearchSource[];
}

export interface SectorResearch {
    /** English sector name as stored in the data; used for matching, not for display */
    sector: string;
    /** Sector name in the current language */
    label: string;
    regulator: string;
    /** One line on where most of this sector's numbers are found */
    where: string;
    keyNumbers: string[];
    questions: string[];
    redFlags: string[];
    sources: ResearchSource[];
}

/** Source catalogue: id -> URL. Name and description come from research.src_<id>_name / _what. */
const SOURCE_URLS = {
    nepseDisclosures: 'https://www.nepalstock.com',
    appQuarterly: '/quarterly',
    companyWebsite: '',
    sebon: 'https://www.sebon.gov.np',
    sebonProspectus: 'https://www.sebon.gov.np',
    meroshare: 'https://meroshare.cdsc.com.np',
    creditRating: 'https://www.icranepal.com',
    agmNotices: 'https://www.nepalstock.com',
    nrbBankingStats: 'https://www.nrb.org.np',
    nrbMacro: 'https://www.nrb.org.np',
    appIntelligence: '/intelligence',
    nba: 'https://nepalbankers.com.np',
    ippan: 'https://www.ippan.org.np',
    fncci: 'https://www.fncci.org',
    nrbBankByBank: 'https://www.nrb.org.np',
    nrbDirectives: 'https://www.nrb.org.np',
    nrbClassB: 'https://www.nrb.org.np',
    nrbMicrofinance: 'https://www.nrb.org.np',
    neaReport: 'https://www.nea.org.np',
    doed: 'https://www.doed.gov.np',
    ippanSector: 'https://www.ippan.org.np',
    nia: 'https://nia.gov.np',
    fnccIndustry: 'https://www.fncci.org',
    nrbIndustry: 'https://www.nrb.org.np',
    ntb: 'https://ntb.gov.np',
    nta: 'https://nta.gov.np',
    fundNav: 'https://www.sebon.gov.np',
} as const;

type SourceId = keyof typeof SOURCE_URLS;

const source = (id: SourceId): ResearchSource => ({
    url: SOURCE_URLS[id],
    get name() {
        return tr(`src_${id}_name`);
    },
    get what() {
        return tr(`src_${id}_what`);
    },
});

const step = (
    id: string,
    slug: string,
    lookFor: number,
    availability: ResearchStep['availability'],
    sources: SourceId[]
): ResearchStep => ({
    id,
    availability,
    sources: sources.map(source),
    get title() {
        return tr(`step_${slug}_title`);
    },
    get question() {
        return tr(`step_${slug}_q`);
    },
    get where() {
        return tr(`step_${slug}_where`);
    },
    get nepalEquivalent() {
        return tr(`step_${slug}_nepal`);
    },
    get why() {
        return tr(`step_${slug}_why`);
    },
    get lookFor() {
        return list(`step_${slug}_look`, lookFor);
    },
});

/** Step ids are stable; do not rename them. */
export const RESEARCH_STEPS: ResearchStep[] = [
    step('quarterly-report', 'quarterly', 3, 'good', ['nepseDisclosures', 'appQuarterly']),
    step('annual-report', 'annual', 5, 'partial', ['companyWebsite', 'sebon']),
    step('prospectus', 'prospectus', 5, 'good', ['sebonProspectus', 'meroshare', 'creditRating']),
    step('investor-presentation', 'presentation', 2, 'rare', ['agmNotices']),
    step('industry-data', 'industry', 3, 'good', ['nrbBankingStats', 'nrbMacro', 'appIntelligence']),
    step('industry-association', 'association', 2, 'partial', ['nba', 'ippan', 'fncci']),
];

/**
 * "Before you buy: 5 questions" shown in simple view. Each points at one existing
 * look-for item of a step above, so no new data source is involved.
 */
export const QUICK_CHECKS: { stepId: string; index: number }[] = [
    { stepId: 'quarterly-report', index: 0 },
    { stepId: 'quarterly-report', index: 1 },
    { stepId: 'annual-report', index: 0 },
    { stepId: 'annual-report', index: 3 },
    { stepId: 'prospectus', index: 2 },
];

const sector = (
    name: string,
    slug: string,
    counts: { kn: number; q: number; rf: number },
    sources: SourceId[]
): SectorResearch => ({
    sector: name,
    sources: sources.map(source),
    get label() {
        return tr(`sec_${slug}_name`);
    },
    get regulator() {
        return tr(`sec_${slug}_regulator`);
    },
    get where() {
        return tr(`sec_${slug}_where`);
    },
    get keyNumbers() {
        return list(`sec_${slug}_kn`, counts.kn);
    },
    get questions() {
        return list(`sec_${slug}_q`, counts.q);
    },
    get redFlags() {
        return list(`sec_${slug}_rf`, counts.rf);
    },
});

export const SECTOR_RESEARCH: SectorResearch[] = [
    sector('Commercial Bank', 'commercialBank', { kn: 5, q: 3, rf: 3 }, ['nrbBankByBank', 'nrbDirectives']),
    sector('Development Bank', 'developmentBank', { kn: 4, q: 2, rf: 2 }, ['nrbClassB']),
    sector('Microfinance', 'microfinance', { kn: 4, q: 3, rf: 3 }, ['nrbMicrofinance']),
    sector('Hydropower', 'hydropower', { kn: 4, q: 4, rf: 4 }, ['neaReport', 'doed', 'ippanSector']),
    sector('Life Insurance', 'lifeInsurance', { kn: 4, q: 2, rf: 2 }, ['nia']),
    sector('Non-Life Insurance', 'nonLifeInsurance', { kn: 4, q: 2, rf: 2 }, ['nia']),
    sector('Manufacturing', 'manufacturing', { kn: 4, q: 3, rf: 3 }, ['fnccIndustry', 'nrbIndustry']),
    sector('Hotels', 'hotels', { kn: 3, q: 2, rf: 2 }, ['ntb']),
    sector('Telecom', 'telecom', { kn: 4, q: 2, rf: 2 }, ['nta']),
    sector('Mutual Fund', 'mutualFund', { kn: 4, q: 5, rf: 2 }, ['fundNav']),
];

export const getSectorResearch = (sector: string): SectorResearch | undefined => {
    const s = sector.toLowerCase();
    return SECTOR_RESEARCH.find(r => r.sector.toLowerCase() === s)
        ?? SECTOR_RESEARCH.find(r => s.includes(r.sector.toLowerCase().split(' ')[0]));
};

/** Sector name in the current language when it is one of ours; otherwise the name as given. */
export const sectorLabel = (sector: string): string =>
    SECTOR_RESEARCH.find(r => r.sector.toLowerCase() === sector.toLowerCase())?.label ?? sector;
