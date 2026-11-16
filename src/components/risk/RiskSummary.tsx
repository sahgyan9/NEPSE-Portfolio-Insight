import type { ReactNode } from "react";
import { CalendarRange, Layers, TrendingDown } from "lucide-react";
import { Explain } from "@/components/Explain";
import { Skeleton } from "@/components/ui/skeleton";
import type { GlossaryKey } from "@/lib/glossary";
import { fmtMoney } from "@/i18n/format";
import { useT } from "@/i18n";
import type { RiskData } from "@/services/riskApi";
import { pctNum, riskLevelKey } from "./riskText";

const Statement = ({ icon, term, children, note }: { icon: ReactNode; term: GlossaryKey; children: ReactNode; note?: ReactNode }) => (
  <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
    <span className="mt-0.5 shrink-0 text-primary" aria-hidden="true">
      {icon}
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-base leading-relaxed">
        {children} <Explain term={term} className="ml-0.5 h-6 w-6" />
      </p>
      {note && <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{note}</p>}
    </div>
  </li>
);

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Plain-language summary for the simple view: three statements with real numbers. */
export const RiskSummary = ({ risk, loading }: { risk?: RiskData; loading?: boolean }) => {
  const { t } = useT();
  if (loading || !risk) {
    return (
      <div className="surface space-y-4 p-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    );
  }
  const p = risk.portfolio;
  const value = p.value;

  // (a) A bad week: rupees when the server computed them, else from the percent and today's value, else percent.
  const varAmount = isNum(p.weeklyVar95Amount) && p.weeklyVar95Amount > 0
    ? p.weeklyVar95Amount
    : isNum(p.weeklyVar95) && isNum(value)
      ? p.weeklyVar95 * value
      : null;
  const badWeek =
    varAmount !== null
      ? t("risk.sumBadWeek", { amount: fmtMoney(varAmount) })
      : isNum(p.weeklyVar95)
        ? t("risk.sumBadWeekPct", { pct: pctNum(p.weeklyVar95) })
        : null;

  // (b) The biggest fall so far, with what that would be on today's value.
  const dd = isNum(p.maxDrawdown) ? Math.abs(p.maxDrawdown) : null;
  const ddNote = dd !== null && isNum(value) ? t("risk.sumDrawdownNote", { amount: fmtMoney(dd * value), weeks: risk.lookbackWeeks }) : undefined;

  // (c) Spread: holdings versus effective holdings.
  const n = p.holdingCount;
  const eff = isNum(p.effectiveHoldings) ? Math.max(1, Math.round(p.effectiveHoldings)) : null;

  return (
    <section className="surface p-4 sm:p-5" aria-labelledby="risk-summary-heading">
      <h2 id="risk-summary-heading" className="text-base font-semibold">
        {t("risk.sumHeading")}
      </h2>
      <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
        {t("risk.sumLevel", { level: t(riskLevelKey(risk.riskLevel)) })}
      </p>
      <ul className="divide-y divide-border">
        {badWeek && (
          <Statement icon={<CalendarRange className="h-5 w-5" />} term="var95" note={t("risk.sumBadWeekNote")}>
            {badWeek}
          </Statement>
        )}
        {dd !== null && (
          <Statement icon={<TrendingDown className="h-5 w-5" />} term="maxDrawdown" note={ddNote}>
            {t("risk.sumDrawdown", { pct: (dd * 100).toFixed(1) })}
          </Statement>
        )}
        {eff !== null && n > 0 && (
          <Statement icon={<Layers className="h-5 w-5" />} term="effectiveHoldings" note={eff < n ? t("risk.sumSpreadNote") : undefined}>
            {eff < n ? t("risk.sumSpread", { n, m: eff }) : t("risk.sumSpreadEven", { n })}
          </Statement>
        )}
      </ul>
    </section>
  );
};
