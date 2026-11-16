/**
 * Plain-language text for structured news events (namespace "news").
 * Sentences are built only from fields the extractor found in the source;
 * a missing number picks a template variant that does not mention it.
 */
import type { LucideIcon } from "lucide-react";
import {
  BadgePercent,
  Building2,
  CalendarCheck,
  CalendarClock,
  ChartColumn,
  Coins,
  FileText,
  Gavel,
  HeartHandshake,
  Landmark,
  LockOpen,
  Merge,
  Newspaper,
  Receipt,
  Scale,
  Ticket,
  TrendingUp,
  TriangleAlert,
  UserCog,
  Users,
  ListOrdered,
  Briefcase,
} from "lucide-react";
import type { ActionKind, NewsEvent, NewsEventType } from "@/services/newsEventsApi";
import { fmtDate } from "@/i18n/format";
import type { TVars } from "@/i18n";

type T = (key: string, vars?: TVars) => string;

export const EVENT_ICON: Record<NewsEventType, LucideIcon> = {
  dividend_proposed: Coins,
  dividend_approved: Coins,
  book_closure: CalendarClock,
  bonus_listed: BadgePercent,
  price_adjustment: Scale,
  right_share: Ticket,
  agm: Users,
  quarterly_result: ChartColumn,
  rating_change: TrendingUp,
  ipo_fpo: FileText,
  debenture: Receipt,
  auction: Gavel,
  promoter_sale: Landmark,
  merger_acquisition: Merge,
  lock_in_expiry: LockOpen,
  incident: TriangleAlert,
  csr: HeartHandshake,
  management_change: UserCog,
  investment_or_expansion: Building2,
  business_update: Briefcase,
  market_roundup: ListOrdered,
  other: Newspaper,
};

/** Shown when an event is trusted enough to interpret; otherwise the neutral "News" label. */
export const isInterpreted = (ev: NewsEvent): boolean =>
  ev.confidence === "high" && ev.event_type !== "other" && !ev.is_roundup;

export const eventLabel = (t: T, ev: Pick<NewsEvent, "event_type">): string => t(`news.type_${ev.event_type}`);

/** 15.8 -> "15.8", 1.10530 -> "1.1053" */
const pct = (n: number): string => String(Number(n.toFixed(4)));

const amountPhrase = (t: T, ev: NewsEvent): string | null => {
  const { bonus_pct: b, cash_pct: c, total_pct: tot, fiscal_year: fy } = ev.fields;
  let amount: string | null = null;
  if (b != null && c != null) amount = t("news.amtBonusCash", { bonus: pct(b), cash: pct(c) });
  else if (b != null) amount = t("news.amtBonus", { bonus: pct(b) });
  else if (c != null) amount = t("news.amtCash", { cash: pct(c) });
  else if (tot != null) amount = t("news.amtTotal", { total: pct(tot) });
  if (!amount) return null;
  return fy ? t("news.amtWithFy", { amount, fy }) : amount;
};

/** One plain sentence about what happened, or null when only the headline should be shown. */
export const eventSentence = (t: T, ev: NewsEvent): string | null => {
  if (!isInterpreted(ev)) return null;
  const f = ev.fields;
  const symbol = ev.symbol;
  const amount = amountPhrase(t, ev);

  switch (ev.event_type) {
    case "dividend_proposed":
      return amount ? t("news.sDivProposed", { symbol, amount }) : t("news.sDivProposedNoAmt", { symbol });
    case "dividend_approved":
      return amount ? t("news.sDivApproved", { symbol, amount }) : t("news.sDivApprovedNoAmt", { symbol });
    case "book_closure": {
      const parts: string[] = [];
      if (f.book_close_date) {
        const date = fmtDate(f.book_close_date);
        parts.push(amount ? t("news.sBookCloseFor", { symbol, amount, date }) : t("news.sBookClose", { symbol, date }));
      } else {
        parts.push(amount ? t("news.sBookCloseNoDateFor", { symbol, amount }) : t("news.sBookCloseNoDate", { symbol }));
      }
      if (f.last_buy_date) parts.push(t("news.sLastBuy", { date: fmtDate(f.last_buy_date) }));
      return parts.join(" ");
    }
    case "bonus_listed":
      return f.bonus_pct != null
        ? t("news.sBonusListed", { symbol, bonus: pct(f.bonus_pct) })
        : t("news.sBonusListedNoPct", { symbol });
    case "price_adjustment":
      return t("news.sPriceAdjust", { symbol });
    case "right_share": {
      const ratio =
        f.ratio_pct != null
          ? t("news.ratioPct", { pct: pct(f.ratio_pct) })
          : f.ratio
            ? t("news.ratioText", { ratio: f.ratio })
            : "";
      const stage = f.stage ?? "unknown";
      const key = {
        proposed: "news.sRightProposed",
        approved: "news.sRightApproved",
        issue_open: "news.sRightOpen",
        allotted: "news.sRightAllotted",
        listed: "news.sRightListed",
      }[stage] ?? "news.sRightGeneric";
      return t(key, { symbol, ratio }).replace(/\s{2,}/g, " ");
    }
    case "agm":
      return f.agm_date
        ? t("news.sAgm", { symbol, date: fmtDate(f.agm_date) })
        : t("news.sAgmNoDate", { symbol });
    case "quarterly_result": {
      const q = f.quarter ? t("news.quarterN", { n: f.quarter }) : t("news.quarterAny");
      let s: string;
      if (f.profit_direction === "loss") s = t("news.sQLoss", { symbol, q });
      else if (f.profit_direction && f.profit_change_pct != null)
        s = t(f.profit_direction === "up" ? "news.sQUpPct" : "news.sQDownPct", { symbol, q, pct: pct(f.profit_change_pct) });
      else if (f.profit_direction) s = t(f.profit_direction === "up" ? "news.sQUp" : "news.sQDown", { symbol, q });
      else s = t("news.sQPublished", { symbol, q });
      if (f.eps != null) s += " " + t("news.sQEps", { eps: pct(f.eps) });
      return s;
    }
    case "rating_change": {
      const agency = (f.agency as string | null) ?? t("news.ratingAgency");
      const key = {
        upgrade: "news.sRatingUp",
        downgrade: "news.sRatingDown",
        reaffirm: "news.sRatingSame",
        assigned: "news.sRatingAssigned",
      }[f.direction ?? ""] ?? "news.sRatingGeneric";
      let s = t(key, { symbol, agency });
      if (f.rating) s += " " + t("news.sRatingGrade", { rating: f.rating });
      return s;
    }
    case "ipo_fpo": {
      const key = {
        open: "news.sIpoOpen",
        closing: "news.sIpoClosing",
        listed: "news.sIpoListed",
        approved: "news.sIpoApproved",
        planned: "news.sIpoPlanned",
      }[f.stage ?? ""] ?? "news.sIpoGeneric";
      return t(key, { symbol });
    }
    case "debenture": {
      if (f.stage === "maturity" && f.maturity_date) return t("news.sDebMature", { symbol, date: fmtDate(f.maturity_date as string) });
      const key = { delisted: "news.sDebDelisted", issue: "news.sDebIssue", maturity: "news.sDebMatureNoDate" }[f.stage ?? ""] ?? "news.sDebGeneric";
      return t(key, { symbol });
    }
    case "auction":
      return t(f.share_kind === "promoter" ? "news.sAuctionPromoter" : "news.sAuction", { symbol });
    case "lock_in_expiry":
      return f.expiry_date
        ? t("news.sLockIn", { symbol, date: fmtDate(f.expiry_date) })
        : t("news.sLockInNoDate", { symbol });
    case "incident":
      return f.denied ? t("news.sIncidentDenied", { symbol }) : null;
    default:
      // Event types without numbers: the headline itself says what happened.
      return null;
  }
};

/** One "what this means for you" line, or null when the event is not interpreted. */
export const eventMeaning = (t: T, ev: NewsEvent): string | null => {
  if (!isInterpreted(ev)) return null;
  const f = ev.fields;
  switch (ev.event_type) {
    case "dividend_proposed":
      return t("news.mDivProposed") + (f.bonus_pct ? " " + t("news.mBonusAdjust") : "");
    case "dividend_approved":
      return t("news.mDivApproved");
    case "book_closure":
      return t("news.mBookClose") + (f.bonus_pct ? " " + t("news.mBonusAdjust") : "");
    case "quarterly_result":
      return t("news.mQuarterly") + (f.profit_change_pct != null && f.profit_change_pct >= 200 ? " " + t("news.mQuarterlyBigPct") : "");
    case "incident":
      return t(f.denied ? "news.mIncidentDenied" : "news.mIncident");
    default:
      return t(`news.m_${ev.event_type}`);
  }
};

export const actionKindLabel = (t: T, kind: ActionKind | null): string =>
  kind ? t(`news.action_${kind}`) : t("news.action_generic");

/** Whole days from today (local) to an ISO date. */
export const daysUntil = (iso: string, now = new Date()): number => {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(y, m - 1, d).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target - today) / 86_400_000);
};

export const daysWords = (t: T, n: number): string =>
  n <= 0 ? t("news.daysToday") : n === 1 ? t("news.daysTomorrow") : t("news.daysLeft", { n });

const POPULAR_RE = /most bought|most sold|most traded|heavy (accumulation|buying)|top gainers?|top losers?|highest (volume|turnover)|bought most/i;

/** Lists of heavily bought or top-gaining stocks that name a held symbol. */
export const isPopularityItem = (ev: NewsEvent): boolean =>
  Boolean(ev.fields?.popularity_list) || POPULAR_RE.test(ev.headline);
