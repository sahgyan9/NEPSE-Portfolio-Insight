// Single source of truth for NEPSE company descriptions, sectors, and fallback financials

export interface CompanyRegistryEntry {
    fullName: string;
    sector: string;
}

export const companyRegistry: Record<string, CompanyRegistryEntry> = {
    // === HYDROPOWER SECTOR ===
    BHL: { fullName: "Balephi Hydropower Limited", sector: "Hydropower" },
    CHCL: { fullName: "Chilime Hydropower Company Limited", sector: "Hydropower" },
    SAHAS: { fullName: "Sahas Urja Limited", sector: "Hydropower" },
    SGHC: { fullName: "Swet-Ganga Hydropower & Construction Limited", sector: "Hydropower" },
    UPPER: { fullName: "Upper Tamakoshi Hydropower Ltd.", sector: "Hydropower" },

    // === COMMERCIAL BANKS ===
    HBL: { fullName: "Himalayan Bank Limited", sector: "Commercial Bank" },
    NABIL: { fullName: "Nabil Bank Limited", sector: "Commercial Bank" },
    NICA: { fullName: "NIC Asia Bank Ltd.", sector: "Commercial Bank" },
    NIMB: { fullName: "Nepal Investment Mega Bank Limited", sector: "Commercial Bank" },

    // === MICROFINANCE / DEVELOPMENT BANK ===
    CBBL: { fullName: "Chhimek Laghubitta Bittiya Sanstha Limited", sector: "Microfinance" },

    // === LIFE INSURANCE ===
    CLI: { fullName: "Citizen Life Insurance Company Limited", sector: "Life Insurance" },
    SNLI: { fullName: "Sun Nepal Life Insurance Company Limited", sector: "Life Insurance" },

    // === NON-LIFE INSURANCE / REINSURANCE ===
    HRL: { fullName: "Himalayan Reinsurance Limited", sector: "Non-Life Insurance" },

    // === MANUFACTURING ===
    HDL: { fullName: "Himalayan Distillery Limited", sector: "Manufacturing" },
    GCIL: { fullName: "Ghorahi Cement Industry Limited", sector: "Manufacturing" },
    SARBTM: { fullName: "Sarbottam Cement Limited", sector: "Manufacturing" },

    // === TRADING / OIL & GAS ===
    SONA: { fullName: "Sonapur Minerals And Oil Limited", sector: "Trading" },

    // === TELECOM ===
    NTC: { fullName: "Nepal Doorsanchar Company Limited", sector: "Telecom" },

    // === MUTUAL FUNDS ===
    CSY: { fullName: "Citizens Super Yield Fund", sector: "Mutual Fund" },
    KDBY: { fullName: "Kumari Dhanabriddhi Yojana", sector: "Mutual Fund" },
    MMF1: { fullName: "Mahila Sambriddhi Kosh", sector: "Mutual Fund" },
    NBF3: { fullName: "Nabil Balanced Fund 3", sector: "Mutual Fund" },
    NIBLSF: { fullName: "NIBL Samriddhi Fund", sector: "Mutual Fund" },
    NMBSBFE: { fullName: "NMB Saral Bachat Fund - E", sector: "Mutual Fund" },
};

export interface FundamentalDataEntry {
    peRatio: number | null;
    eps: number | null;
    bookValue: number;
    dividendYield: number;
}

export const fundamentalData: Record<string, FundamentalDataEntry> = {
    BHL: { peRatio: 15.2, eps: 12.0, bookValue: 86.8, dividendYield: 3.5 },
    CBBL: { peRatio: 12.5, eps: 83.0, bookValue: 576.5, dividendYield: 2.8 },
    CHCL: { peRatio: 18.7, eps: 27.0, bookValue: 158.0, dividendYield: 4.2 },
    CLI: { peRatio: 10.8, eps: 45.9, bookValue: 330.7, dividendYield: 2.5 },
    CSY: { peRatio: null, eps: null, bookValue: 10.53, dividendYield: 0 },
    GCIL: { peRatio: 22.1, eps: 20.6, bookValue: 189.3, dividendYield: 1.8 },
    HBL: { peRatio: 8.2, eps: 24.3, bookValue: 234.0, dividendYield: 5.2 },
    HDL: { peRatio: 25.3, eps: 47.8, bookValue: 115.33, dividendYield: 3.0 },
    HRL: { peRatio: 14.5, eps: 60.0, bookValue: 310.7, dividendYield: 2.2 },
    KDBY: { peRatio: null, eps: null, bookValue: 10.0, dividendYield: 0 },
    MMF1: { peRatio: null, eps: null, bookValue: 10.0, dividendYield: 0 },
    NABIL: { peRatio: 9.5, eps: 54.2, bookValue: 429.1, dividendYield: 4.8 },
    NBF3: { peRatio: null, eps: null, bookValue: 10.0, dividendYield: 0 },
    NIBLSF: { peRatio: null, eps: null, bookValue: 10.0, dividendYield: 0 },
    NICA: { peRatio: 7.8, eps: 42.9, bookValue: 372.1, dividendYield: 4.5 },
    NIMB: { peRatio: 6.5, eps: 31.1, bookValue: 269.3, dividendYield: 5.0 },
    NMBSBFE: { peRatio: null, eps: null, bookValue: 10.0, dividendYield: 0 },
    NTC: { peRatio: 12.0, eps: 72.2, bookValue: 481.1, dividendYield: 6.5 },
    SAHAS: { peRatio: 16.8, eps: 33.7, bookValue: 226.2, dividendYield: 3.8 },
    SARBTM: { peRatio: null, eps: null, bookValue: 198, dividendYield: 0 },
    SGHC: { peRatio: 19.2, eps: 22.6, bookValue: 149.7, dividendYield: 2.8 },
    SNLI: { peRatio: 11.2, eps: 46.0, bookValue: 321.8, dividendYield: 2.0 },
    SONA: { peRatio: 20.5, eps: 21.3, bookValue: 140.9, dividendYield: 2.5 },
    UPPER: { peRatio: 8.5, eps: 21.5, bookValue: 166.4, dividendYield: 7.2 },
};

export const fallbackPrices: Record<string, number> = {
    BHL: 182.3, CBBL: 1037.7, CHCL: 505.5, CLI: 496.0, CSY: 10.0,
    GCIL: 454.3, HBL: 198.9, HDL: 1210.0, HRL: 870.0, KDBY: 9.3,
    MMF1: 8.5, NABIL: 514.9, NBF3: 9.0, NIBLSF: 10.5, NICA: 334.9,
    NIMB: 202.0, NMBSBFE: 10.42, NTC: 866.0, SAHAS: 565.5, SARBTM: 913.9,
    SGHC: 434.0, SNLI: 514.8, SONA: 437.0, UPPER: 183.0,
};
