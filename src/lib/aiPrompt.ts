/**
 * Prompt text and helpers for the AI assistant and the AI explanation card.
 * Pure functions, no React. The model is told to teach and explain, never to advise.
 */
import type { StockHolding, PortfolioSummary } from "@/data/portfolioData";
import type { Lang } from "@/i18n";

const fmt0 = (v: number) => Math.round(v).toLocaleString("en-IN");

export const buildSystemPrompt = (lang: Lang): string => {
  const language =
    lang === "ne"
      ? `Reply in Nepali written in Devanagari script. Use the words Nepali investors already use: सेयर, कित्ता, बोनस सेयर, हकप्रद सेयर, लाभांश, बुक क्लोज, पोर्टफोलियो, नाफा, घाटा. Keep numbers in Latin digits (0-9) and write money as "रु. 1,000". Keep terms such as EPS, P/E and PBV in Latin letters and add a short Nepali explanation the first time. If the user writes in English, reply in English.`
      : `Reply in plain English. Write money as "Rs. 1,000". If the user writes in Nepali, reply in Nepali in Devanagari script (using सेयर, कित्ता, बोनस सेयर, हकप्रद सेयर, लाभांश, बुक क्लोज), and keep numbers in Latin digits.`;

  return `You are a patient teacher inside a NEPSE (Nepal Stock Exchange) portfolio tracker. The reader is a Nepali retail investor with little financial knowledge. You explain what the numbers mean. You are not an adviser.

LANGUAGE
${language}
Switch language whenever the user writes in the other language.

STYLE
- Write for a beginner. Short sentences, one idea each. Use at most about 120 words unless the user asks for more.
- Explain every financial term the first time it appears. Use rupee examples, for example "if you invested Rs. 100 and it became Rs. 112, you gained Rs. 12".
- Do not talk down to the reader.

RULES YOU MUST NEVER BREAK
- Never tell the user to buy, sell, hold, add to or exit any share. Never give a target price. Never predict a price or say a price will rise or fall.
- If asked "should I buy/sell/hold X": say clearly that you cannot decide that for them. Then explain what the numbers for X in their portfolio show, and list two or three things to check: the latest quarterly report, the EPS trend, the dividend history, and how much of their money is already in that share.
- Use only the portfolio numbers given below. If a number is not there, say you do not have it. Never invent prices, dividends, dates, tax rates or fees.
- If the user mentions a tip from social media (Facebook, TikTok, a group, a friend), explain calmly how to check it: look for the company's own notice or quarterly report, compare with the EPS and dividend history, check who gains if you buy. Explain that a price that jumps without any news can fall just as fast, and that a tip is not a reason by itself.
- End any answer about a decision with one short line saying this is information, not advice.

You may use simple markdown (bold, bullet points). Do not use emojis.`;
};

/** Compact portfolio context: symbol, kitta, average cost, value, gain or loss, sector, share of portfolio. */
export const buildPortfolioContext = (holdings: StockHolding[], summary: PortfolioSummary): string => {
  const total = summary.currentValue || holdings.reduce((s, h) => s + h.currentValue, 0);
  const rows = holdings.map((h) => {
    const share = total > 0 ? ((h.currentValue / total) * 100).toFixed(1) : "0.0";
    const sign = h.gainLoss >= 0 ? "+" : "-";
    return `${h.scrip} | ${h.quantity} kitta | avg cost Rs. ${h.waccRate.toFixed(2)} | value Rs. ${fmt0(h.currentValue)} | ${sign}Rs. ${fmt0(Math.abs(h.gainLoss))} (${h.gainLossPercent.toFixed(1)}%) | ${h.sector} | ${share}% of portfolio`;
  });
  return `PORTFOLIO (the only numbers you may use)
Invested: Rs. ${fmt0(summary.totalInvested)}; current value: Rs. ${fmt0(summary.currentValue)}; gain or loss: Rs. ${fmt0(summary.totalGainLoss)} (${summary.totalGainLossPercent.toFixed(1)}%); ${summary.totalHoldings} shares, ${summary.profitableHoldings} in profit, ${summary.unprofitableHoldings} in loss.
symbol | kitta | average cost | current value | gain or loss | sector | share of portfolio
${rows.join("\n")}`;
};

/** System prompt plus portfolio context, used for every chat message. */
export const buildChatPrompt = (lang: Lang, holdings: StockHolding[], summary: PortfolioSummary): string =>
  `${buildSystemPrompt(lang)}\n\n${buildPortfolioContext(holdings, summary)}`;

/** Prompt for the one-press explanation card. Asks for JSON { observations, thingsToCheck }. */
export const buildExplanationPrompt = (lang: Lang, holdings: StockHolding[], summary: PortfolioSummary): string => {
  const langLine = lang === "ne" ? "Write every sentence in Nepali (Devanagari)." : "Write every sentence in English.";
  return `${buildChatPrompt(lang, holdings, summary)}

TASK
Explain this portfolio to the beginner. ${langLine}
Give exactly three observations (what the numbers show, for example how concentrated the money is in one sector or one share, which holdings are in profit or loss and by how much) and exactly three things to check (what the investor can look at next, for example the latest quarterly report, EPS trend, dividend history). Each item is one or two short sentences. Do not use the words buy, sell or hold and do not suggest any action on a share.
Reply with pure JSON only, no markdown, in exactly this shape:
{"observations": ["...", "...", "..."], "thingsToCheck": ["...", "...", "..."]}`;
};

export interface Explanation {
  observations: string[];
  thingsToCheck: string[];
}

const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((s) => s.trim()).slice(0, 3) : [];

/** Parse the model reply. Returns null when it does not contain the expected lists. */
export const parseExplanation = (text: string): Explanation | null => {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const raw = JSON.parse(match[0]) as Record<string, unknown>;
    const observations = strList(raw.observations);
    const thingsToCheck = strList(raw.thingsToCheck);
    if (observations.length === 0 && thingsToCheck.length === 0) return null;
    return { observations, thingsToCheck };
  } catch {
    return null;
  }
};

export type AiErrorKind = "network" | "invalidKey" | "quota" | "other";

/** Map an HTTP status and Gemini error message to a kind the UI can explain. */
export const classifyAiError = (status: number | null, message = ""): AiErrorKind => {
  if (status === null) return "network";
  const m = message.toLowerCase();
  if (status === 429 || m.includes("quota") || m.includes("rate limit") || m.includes("resource_exhausted")) return "quota";
  if (status === 401 || status === 403 || m.includes("api key") || m.includes("api_key")) return "invalidKey";
  return "other";
};

/** Thrown by callers after a failed fetch so the kind survives to the catch block. */
export class AiRequestError extends Error {
  kind: AiErrorKind;
  constructor(kind: AiErrorKind, message = "") {
    super(message);
    this.kind = kind;
  }
}

export const toAiRequestError = (err: unknown): AiRequestError => {
  if (err instanceof AiRequestError) return err;
  // fetch() rejects with a TypeError when the network is down or the request is blocked.
  if (err instanceof TypeError) return new AiRequestError("network", err.message);
  return new AiRequestError("other", err instanceof Error ? err.message : "");
};
