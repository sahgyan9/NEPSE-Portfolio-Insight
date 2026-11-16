/**
 * "Start here" lessons for the Learn page. Text lives in the `learn` locale namespace:
 * <id>_title, <id>_p1..p<n>, <id>_example, <id>_remember.
 * Ids are used in deep links (/learn#lesson-<id>) and in localStorage, so do not rename them.
 */
import type { GlossaryKey } from "@/lib/glossary";

export interface Lesson {
  id: string;
  /** Number of paragraph keys (<id>_p1 ... <id>_pN) */
  paragraphs: number;
  /** Glossary words linked under the lesson */
  terms: GlossaryKey[];
}

export const LESSONS: Lesson[] = [
  { id: "owning", paragraphs: 3, terms: ["shareKitta", "faceValue", "eps"] },
  { id: "money", paragraphs: 3, terms: ["cashDividend", "bonusShare", "unrealisedGain", "wacc"] },
  { id: "bonus", paragraphs: 3, terms: ["bonusShare", "rightShare", "bookClosure", "priceAdjustment"] },
  { id: "fiveNumbers", paragraphs: 3, terms: ["eps", "pe", "bookValue", "pb", "dividendYield"] },
  { id: "costs", paragraphs: 3, terms: ["brokerCommission", "dpCharge", "capitalGainsTax", "settlementT2", "edis"] },
  { id: "tips", paragraphs: 3, terms: ["socialTip", "operatorActivity", "promoterShare", "circuitBreaker"] },
];

export const LESSONS_READ_KEY = "pi_lessons_read";

export const readLessonsRead = (): string[] => {
  try {
    const raw = localStorage.getItem(LESSONS_READ_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

export const writeLessonsRead = (ids: string[]) => {
  try {
    localStorage.setItem(LESSONS_READ_KEY, JSON.stringify(ids));
  } catch {
    // Storage blocked: progress lasts for this visit only.
  }
};
