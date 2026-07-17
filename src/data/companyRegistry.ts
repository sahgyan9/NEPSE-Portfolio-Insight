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
    AVYAN: { fullName: "Aviyan Laghubitta Bittiya Sanstha Limited", sector: "Microfinance" },

    // === HOTEL / TOURISM ===
    SHL: { fullName: "Soaltee Hotel Limited", sector: "Hotel" },

    // === LIFE INSURANCE ===
    CLI: { fullName: "Citizen Life Insurance Company Limited", sector: "Life Insurance" },
    SNLI: { fullName: "Sun Nepal Life Insurance Company Limited", sector: "Life Insurance" },

    // === NON-LIFE INSURANCE / REINSURANCE ===
    HRL: { fullName: "Himalayan Reinsurance Limited", sector: "Non-Life Insurance" },

    // === MANUFACTURING ===
    HDL: { fullName: "Himalayan Distillery Limited", sector: "Manufacturing" },
    GCIL: { fullName: "Ghorahi Cement Industry Limited", sector: "Manufacturing" },
    SARBTM: { fullName: "Sarbottam Cement Limited", sector: "Manufacturing" },
    SONA: { fullName: "Sonapur Minerals And Oil Limited", sector: "Manufacturing And Processing" },

    // === TRADING / OIL & GAS ===


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

import dbFundamentals from '../../db/fundamentals.json';

export const fundamentalData: Record<string, FundamentalDataEntry> = {};

// Link directly to the live fundamentals JSON database
Object.entries(dbFundamentals).forEach(([symbol, data]: [string, any]) => {
    fundamentalData[symbol] = {
        peRatio: data.peRatio,
        eps: data.eps,
        bookValue: data.bookValue || 0,
        dividendYield: data.dividendYield || 0, // Fallback to 0 if not present
    };
});

export const fallbackPrices: Record<string, number> = {
    BHL: 182.3, CBBL: 1037.7, CHCL: 505.5, CLI: 496.0, CSY: 10.0,
    GCIL: 454.3, HBL: 198.9, HDL: 1210.0, HRL: 870.0, KDBY: 9.3,
    MMF1: 8.5, NABIL: 514.9, NBF3: 9.0, NIBLSF: 10.5, NICA: 334.9,
    NIMB: 202.0, NMBSBFE: 10.42, NTC: 866.0, SAHAS: 565.5, SARBTM: 913.9,
    SGHC: 434.0, SNLI: 514.8, SONA: 437.0, UPPER: 183.0,
};
