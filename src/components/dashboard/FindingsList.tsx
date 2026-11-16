import { Link } from "react-router-dom";
import { CircleAlert, Info, OctagonAlert, TriangleAlert, ArrowRight, type LucideIcon } from "lucide-react";
import type { FindingSeverity, RiskFinding } from "@/services/riskApi";
import { useT } from "@/i18n";
import { findingText } from "@/lib/findingText";
import { cn } from "@/lib/utils";

const STYLE: Record<FindingSeverity, { rule: string; icon: LucideIcon; tone: string; label: string }> = {
  high: { rule: "border-l-destructive", icon: OctagonAlert, tone: "text-destructive", label: "findings.sevHigh" },
  medium: { rule: "border-l-warning", icon: TriangleAlert, tone: "text-warning", label: "findings.sevMedium" },
  low: { rule: "border-l-primary", icon: CircleAlert, tone: "text-primary", label: "findings.sevLow" },
  info: { rule: "border-l-border", icon: Info, tone: "text-muted-foreground", label: "findings.sevInfo" },
};

/** Where each finding's detail lives on the risk page. */
const DETAIL_ANCHOR: Record<string, string> = {
  concentration: "#holdings-risk",
  fund_concentration: "#holdings-risk",
  risk_heavy: "#money-vs-risk",
  sector_risk: "#money-vs-risk",
  correlated_pair: "#correlation",
  above_market_risk: "#growth",
  few_effective_holdings: "#correlation",
  coverage: "#coverage",
  vs_benchmark: "#growth",
};

interface FindingsListProps {
  findings: RiskFinding[];
  limit?: number;
}

/** Prioritised list: severity is shown by the left rule, the icon and a text label. */
export const FindingsList = ({ findings, limit = 5 }: FindingsListProps) => {
  const { t } = useT();
  const shown = findings.slice(0, limit);
  if (shown.length === 0) {
    return <p className="py-6 text-center text-sm leading-relaxed text-muted-foreground">{t("findings.empty")}</p>;
  }
  return (
    <ul className="space-y-2">
      {shown.map((f, i) => {
        const st = STYLE[f.severity] ?? STYLE.info;
        const Icon = st.icon;
        const label = t(st.label);
        const text = findingText(f);
        return (
          <li key={`${f.code}-${i}`} className={cn("rounded-md border border-l-4 border-border bg-card p-3", st.rule)}>
            <div className="flex items-start gap-2.5">
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", st.tone)} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <span className={cn("text-[11px] font-semibold uppercase tracking-wide", st.tone)}>
                  {label}
                  <span className="sr-only">: </span>
                </span>
                <p className="text-sm font-semibold leading-relaxed">{text.title}</p>
                {text.detail && <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{text.detail}</p>}
                <Link
                  to={`/risk${DETAIL_ANCHOR[f.code] ?? ""}`}
                  className="mt-1 inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-primary hover:underline sm:min-h-0 sm:text-xs"
                >
                  {t("findings.seeDetail")} <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
};
