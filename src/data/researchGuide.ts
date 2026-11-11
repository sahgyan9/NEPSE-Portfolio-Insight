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
 * The numbers the app scores cover only part of this. The checklist below is the part a
 * score cannot do: reading and judgement. Content only, no UI.
 */

export interface ResearchSource {
    name: string;
    url: string;
    what: string;
}

export interface ResearchStep {
    id: string;
    title: string;
    nepalEquivalent: string;
    why: string;
    lookFor: string[];
    /** How well the document type is available for NEPSE companies. */
    availability: 'good' | 'partial' | 'rare';
    sources: ResearchSource[];
}

export interface SectorResearch {
    sector: string;
    regulator: string;
    keyNumbers: string[];
    questions: string[];
    redFlags: string[];
    sources: ResearchSource[];
}

export const RESEARCH_STEPS: ResearchStep[] = [
    {
        id: 'quarterly-report',
        title: 'Quarterly report',
        nepalEquivalent: 'Unaudited quarterly financial statement, published within about a month of quarter end',
        why: 'The most frequent and most current disclosure in Nepal. It moves prices more than any other document.',
        lookFor: [
            'Is profit growing against the same quarter last year, not just against the previous quarter?',
            'Did profit come from the core business or from a one-off (asset sale, provision write-back)?',
            'Are the numbers cumulative for the fiscal year? Nepali quarterlies are; Q3 profit includes Q1 and Q2.',
        ],
        availability: 'good',
        sources: [
            { name: 'NEPSE company disclosures', url: 'https://www.nepalstock.com', what: 'Official filings per company' },
            { name: 'This app: Quarterly page', url: '/quarterly', what: 'Parsed quarterly numbers and trends' },
        ],
    },
    {
        id: 'annual-report',
        title: 'Annual report',
        nepalEquivalent: 'Audited annual report, sent before the AGM',
        why: 'Audited numbers, the auditor’s opinion, and the notes that explain what the headline figures hide.',
        lookFor: [
            'Auditor’s report: any qualification or "emphasis of matter" paragraph.',
            'Related-party transactions: loans or purchases involving directors and their companies.',
            'Contingent liabilities and tax disputes in the notes.',
            'Cash flow from operations against reported profit over several years. Profit without cash is a warning.',
            'Board and management changes, and how much of the company the promoters still hold.',
        ],
        availability: 'partial',
        sources: [
            { name: 'Company website (Investor Relations / Reports)', url: '', what: 'Most listed companies post PDFs; quality varies' },
            { name: 'SEBON', url: 'https://www.sebon.gov.np', what: 'Regulator filings and notices' },
        ],
    },
    {
        id: 'prospectus',
        title: 'Offer document',
        nepalEquivalent: 'Prospectus (Bibaran Patra) for an IPO, FPO or rights issue; the DRHP equivalent',
        why: 'The single most detailed document a company ever publishes: business model, risks, project costs, promoters and how the money will be used.',
        lookFor: [
            'Risk factors section. Companies must list them; read it before the summary.',
            'Use of proceeds: growth, or repaying promoter loans?',
            'Promoter lock-in period and when locked shares become tradable (supply hits the market then).',
            'For hydropower: PPA rate, required commercial operation date, cost per megawatt, loan size.',
            'Projected financials. Compare them later with what was delivered.',
        ],
        availability: 'good',
        sources: [
            { name: 'SEBON approved prospectuses', url: 'https://www.sebon.gov.np', what: 'Offer documents approved by the regulator' },
            { name: 'CDSC MeroShare', url: 'https://meroshare.cdsc.com.np', what: 'Current issues and applications' },
            { name: 'Credit rating reports (ICRA Nepal, CARE Ratings Nepal)', url: 'https://www.icranepal.com', what: 'An independent grading is mandatory for most IPOs; the rationale is a short, candid read' },
        ],
    },
    {
        id: 'investor-presentation',
        title: 'Investor presentation and management commentary',
        nepalEquivalent: 'Rare. Use AGM minutes, the chairman’s statement and press interviews instead',
        why: 'Shows what management says it will do, which you can later hold against what it did.',
        lookFor: [
            'Specific targets with dates, versus general optimism.',
            'Whether earlier promises (branch expansion, project completion, dividend policy) were kept.',
        ],
        availability: 'rare',
        sources: [
            { name: 'AGM notices and minutes', url: 'https://www.nepalstock.com', what: 'Dividend proposals, capital plans, special resolutions' },
        ],
    },
    {
        id: 'industry-data',
        title: 'Industry report',
        nepalEquivalent: 'Regulator statistics; there are few independent industry reports',
        why: 'A company can only be judged against its industry. A bank growing loans 8% is weak in a 15% year and strong in a 3% year.',
        lookFor: [
            'Industry growth rate, and whether the company is gaining or losing share.',
            'Policy changes: NRB directives, insurance capital requirements, PPA and tariff rules.',
            'Interest-rate direction. It drives bank margins, hydropower loan costs and the whole market’s valuation.',
        ],
        availability: 'good',
        sources: [
            { name: 'NRB: Banking and Financial Statistics (monthly)', url: 'https://www.nrb.org.np', what: 'Deposits, credit, NPL, rates for every bank class' },
            { name: 'NRB: Current Macroeconomic and Financial Situation', url: 'https://www.nrb.org.np', what: 'Monthly economy-wide data and Monetary Policy' },
            { name: 'This app: Intelligence page', url: '/intelligence', what: 'Recent NRB research and policy notes' },
        ],
    },
    {
        id: 'industry-association',
        title: 'Industry association',
        nepalEquivalent: 'Sector bodies that publish positions and data',
        why: 'Associations say out loud what is hurting their members: unpaid dues, policy bottlenecks, pricing pressure.',
        lookFor: [
            'Recurring complaints. They point at the industry’s real constraint.',
            'Demands made of the regulator, which hint at coming policy changes.',
        ],
        availability: 'partial',
        sources: [
            { name: 'Nepal Bankers’ Association', url: 'https://nepalbankers.com.np', what: 'Commercial banks' },
            { name: 'IPPAN (Independent Power Producers)', url: 'https://www.ippan.org.np', what: 'Private hydropower developers' },
            { name: 'FNCCI', url: 'https://www.fncci.org', what: 'Manufacturing and trade' },
        ],
    },
];

export const SECTOR_RESEARCH: SectorResearch[] = [
    {
        sector: 'Commercial Bank',
        regulator: 'Nepal Rastra Bank (NRB)',
        keyNumbers: ['Non-performing loans (NPL)', 'Capital adequacy (CAR, minimum 11%)', 'Credit-to-deposit ratio (ceiling 90%)', 'Cost of funds and interest spread', 'Distributable profit per share'],
        questions: [
            'Is NPL rising faster than at peer banks?',
            'Is CAR close to the 11% floor? A bank near the floor cannot pay cash dividends freely or grow lending.',
            'Is distributable profit much lower than net profit? Regulatory reserves can block dividends even in a profitable year.',
        ],
        redFlags: ['NPL above 5%', 'CAR within 0.5 points of the minimum', 'Profit growth driven by provision write-backs'],
        sources: [
            { name: 'NRB monthly banking statistics', url: 'https://www.nrb.org.np', what: 'Bank-by-bank and class-wide figures' },
            { name: 'NRB unified directives', url: 'https://www.nrb.org.np', what: 'Rules on capital, provisioning, dividends' },
        ],
    },
    {
        sector: 'Development Bank',
        regulator: 'Nepal Rastra Bank (NRB)',
        keyNumbers: ['NPL', 'CAR (minimum 10%)', 'Credit-to-deposit ratio', 'Cost of funds'],
        questions: ['Is it a merger or acquisition candidate, and on what swap ratio?', 'How concentrated is lending in one region or sector?'],
        redFlags: ['NPL well above the class average', 'Deposit growth lagging the class'],
        sources: [{ name: 'NRB monthly banking statistics', url: 'https://www.nrb.org.np', what: 'Class B institution data' }],
    },
    {
        sector: 'Microfinance',
        regulator: 'Nepal Rastra Bank (NRB)',
        keyNumbers: ['NPL', 'Borrowings from banks against own deposits', 'Cost of funds', 'CAR (minimum 8%)'],
        questions: [
            'How dependent is it on wholesale loans from commercial banks? Its margin moves with their rates.',
            'Are borrower repayment problems rising in its operating districts?',
            'NRB caps microfinance dividends; what is the cap this year?',
        ],
        redFlags: ['NPL above 5%', 'Sharp fall in member count', 'Dividend capped by regulation while priced as a high-dividend stock'],
        sources: [{ name: 'NRB microfinance statistics', url: 'https://www.nrb.org.np', what: 'Class D institution data and directives' }],
    },
    {
        sector: 'Hydropower',
        regulator: 'Electricity Regulatory Commission, Department of Electricity Development, NEA as buyer',
        keyNumbers: ['Debt to equity', 'Installed capacity (MW) and actual generation against contract energy', 'PPA rate and remaining licence years', 'Interest cost as a share of revenue'],
        questions: [
            'Is the plant generating what the PPA assumes? Hydrology and transmission cuts both reduce it.',
            'How many licence years remain? The plant is handed to the government at the end, so the share is worth less each year.',
            'Is the company building new projects with new debt or rights issues?',
            'Is profit seasonal? Compare the same quarter across years, never consecutive quarters.',
        ],
        redFlags: ['Debt to equity above 2', 'Repeated rights issues', 'Project past its required commercial operation date', 'Price far above book value with under 20 licence years left'],
        sources: [
            { name: 'NEA annual report', url: 'https://www.nea.org.np', what: 'Generation, PPAs, transmission status' },
            { name: 'DoED licence database', url: 'https://www.doed.gov.np', what: 'Licence dates, capacity, project status' },
            { name: 'IPPAN', url: 'https://www.ippan.org.np', what: 'Developer-side issues' },
        ],
    },
    {
        sector: 'Life Insurance',
        regulator: 'Nepal Insurance Authority (NIA)',
        keyNumbers: ['Life fund size and growth', 'First-year premium growth', 'Solvency ratio', 'Investment yield'],
        questions: [
            'Profit depends on the actuarial valuation, which is not done every quarter. Is the reported profit before or after it?',
            'Has it met the paid-up capital requirement, or is a rights issue or merger coming?',
        ],
        redFlags: ['Falling first-year premium', 'Capital below the regulatory requirement'],
        sources: [{ name: 'Nepal Insurance Authority', url: 'https://nia.gov.np', what: 'Insurer statistics and directives' }],
    },
    {
        sector: 'Non-Life Insurance',
        regulator: 'Nepal Insurance Authority (NIA)',
        keyNumbers: ['Combined ratio (claims plus expenses over premium)', 'Net premium growth', 'Reinsurance share', 'Solvency ratio'],
        questions: ['Is underwriting itself profitable, or does all profit come from investment income?', 'How exposed is it to a single large catastrophe after reinsurance?'],
        redFlags: ['Combined ratio above 100% for several years', 'Large outstanding claims against reserves'],
        sources: [{ name: 'Nepal Insurance Authority', url: 'https://nia.gov.np', what: 'Insurer statistics and directives' }],
    },
    {
        sector: 'Manufacturing',
        regulator: 'Department of Industry; sector-specific rules',
        keyNumbers: ['Operating margin', 'Capacity utilisation', 'Debt to equity', 'Inventory and receivable days'],
        questions: ['Who sets its selling price: the company, competitors or imports from India?', 'Is demand tied to construction or remittance cycles?', 'How much of the cost is imported raw material or energy?'],
        redFlags: ['Receivables growing faster than sales', 'Margins falling while volumes rise', 'Very high P/E on a small free float'],
        sources: [
            { name: 'FNCCI', url: 'https://www.fncci.org', what: 'Industry positions and data' },
            { name: 'NRB macroeconomic situation', url: 'https://www.nrb.org.np', what: 'Industrial production, imports, credit to industry' },
        ],
    },
    {
        sector: 'Hotels',
        regulator: 'Department of Tourism',
        keyNumbers: ['Occupancy rate', 'Average room rate', 'Debt to equity'],
        questions: ['How do tourist arrivals compare with pre-2020 levels?', 'Is new room supply in its city outpacing demand?'],
        redFlags: ['High debt with low occupancy', 'Profit only in peak season quarters'],
        sources: [{ name: 'Nepal Tourism Board statistics', url: 'https://ntb.gov.np', what: 'Monthly arrivals' }],
    },
    {
        sector: 'Telecom',
        regulator: 'Nepal Telecommunications Authority (NTA)',
        keyNumbers: ['Subscribers and revenue per user', 'Data revenue against voice revenue', 'Capital spending', 'Dividend payout'],
        questions: ['Is data growth replacing falling voice and international call revenue?', 'What are the licence renewal fees and when are they due?'],
        redFlags: ['Falling revenue per user for several years', 'Dividend paid out of reserves instead of profit'],
        sources: [{ name: 'NTA Management Information System reports', url: 'https://nta.gov.np', what: 'Subscriber and market share data' }],
    },
    {
        sector: 'Mutual Fund',
        regulator: 'SEBON',
        keyNumbers: ['Net asset value (NAV) per unit', 'Market price discount or premium to NAV', 'Years to maturity (closed-end funds)', 'Expense ratio'],
        questions: [
            'Is it closed-end (listed on NEPSE, fixed maturity) or open-ended (bought and redeemed at NAV, often by monthly SIP)? The checks differ.',
            'Open-ended / SIP: what are the exit load and the lock-in, and how has NAV grown against the NEPSE index over three years or more?',
            'Open-ended / SIP: keep the SIP statement. Your real return depends on every instalment date and the NAV paid, not on the face value of Rs. 10.',
            'Is the unit trading below NAV? A closed-end fund converges to NAV at maturity.',
            'What are the top holdings, and do they duplicate stocks you already own directly?',
        ],
        redFlags: ['Paying a premium over NAV', 'Long maturity with a persistent deep discount'],
        sources: [{ name: 'Fund manager monthly NAV reports', url: 'https://www.sebon.gov.np', what: 'NAV, portfolio and expenses' }],
    },
];

export const getSectorResearch = (sector: string): SectorResearch | undefined => {
    const s = sector.toLowerCase();
    return SECTOR_RESEARCH.find(r => r.sector.toLowerCase() === s)
        ?? SECTOR_RESEARCH.find(r => s.includes(r.sector.toLowerCase().split(' ')[0]));
};
