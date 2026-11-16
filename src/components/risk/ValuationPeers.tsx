import { Link } from "react-router-dom";
import { ChartCard, CHART } from "@/components/charts";
import { useT } from "@/i18n";
import type { ValuationWarning } from "@/services/riskApi";

const GROUPS: { type: ValuationWarning["type"]; title: string; note: string }[] = [
  { type: "OVERVALUED", title: "risk.valAboveTitle", note: "risk.valAboveNote" },
  { type: "UNDERVALUED", title: "risk.valBelowTitle", note: "risk.valBelowNote" },
  { type: "LOSS_MAKING", title: "risk.valLossTitle", note: "risk.valLossNote" },
];

/** Bullet bar: filled bar is the stock's P/E, vertical tick is the sector median. */
const Bullet = ({ pe, median, tone, label }: { pe: number; median: number; tone: string; label: string }) => {
  const max = Math.max(pe, median) * 1.15;
  return (
    <div className="relative h-3 w-full rounded-sm bg-muted" role="img" aria-label={label}>
      <div className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${(pe / max) * 100}%`, background: tone }} />
      <div className="absolute -inset-y-0.5 w-0.5 bg-foreground" style={{ left: `${(median / max) * 100}%` }} />
    </div>
  );
};

export const ValuationPeers = ({ warnings, loading }: { warnings?: ValuationWarning[]; loading?: boolean }) => {
  const { t } = useT();
  const list = warnings ?? [];
  const count = (type: ValuationWarning["type"]) => list.filter((w) => w.type === type).length;
  const summary = list.length
    ? t("risk.valSummary", { above: count("OVERVALUED"), below: count("UNDERVALUED"), loss: count("LOSS_MAKING") })
    : t("risk.valSubtitle");

  /** Sentence for one row, built here so it follows the selected language. */
  const message = (w: ValuationWarning) => {
    if (w.type === "LOSS_MAKING") return t("risk.valLossMsg", { symbol: w.symbol });
    if (!w.pe || !w.sectorMedianPe) return w.message;
    const vars = { symbol: w.symbol, pe: w.pe.toFixed(1), median: w.sectorMedianPe.toFixed(1), ratio: (w.pe / w.sectorMedianPe).toFixed(1) };
    return t(w.type === "OVERVALUED" ? "risk.valAboveMsg" : "risk.valBelowMsg", vars);
  };

  return (
    <ChartCard
      title={t("risk.valTitle")}
      subtitle={summary}
      explain="pe"
      loading={loading}
      empty={list.length === 0}
      emptyMessage={t("risk.valEmpty")}
      height={160}
      footer={<span>{t("risk.valFooter")}</span>}
    >
      <div id="valuation-chart" className="space-y-5">
        {GROUPS.map((g) => {
          const items = list.filter((w) => w.type === g.type);
          if (items.length === 0) return null;
          const tone = g.type === "OVERVALUED" ? CHART.caution : g.type === "UNDERVALUED" ? CHART.accent : CHART.loss;
          return (
            <div key={g.type}>
              <h4 className="text-sm font-semibold">
                {t(g.title)} <span className="font-normal text-muted-foreground">({items.length})</span>
              </h4>
              <p className="mb-2 text-xs leading-relaxed text-muted-foreground">{t(g.note)}</p>
              <ul className="divide-y divide-border rounded-md border border-border">
                {items.map((w) => (
                  <li key={w.symbol} className="grid grid-cols-[64px_1fr] items-center gap-3 px-3 py-2 sm:grid-cols-[64px_220px_1fr]">
                    <Link to={`/quarterly?symbol=${w.symbol}`} className="inline-flex min-h-[44px] items-center text-sm font-semibold hover:underline sm:min-h-0">
                      {w.symbol}
                    </Link>
                    {g.type !== "LOSS_MAKING" && w.pe && w.sectorMedianPe ? (
                      <div className="space-y-1">
                        <Bullet
                          pe={w.pe}
                          median={w.sectorMedianPe}
                          tone={tone}
                          label={t("risk.valBulletLabel", { pe: w.pe.toFixed(1), median: w.sectorMedianPe.toFixed(1) })}
                        />
                        <p className="font-mono text-[11px] text-muted-foreground">
                          {t("risk.valPeVs", { pe: w.pe.toFixed(1), median: w.sectorMedianPe.toFixed(1) })}
                        </p>
                      </div>
                    ) : (
                      <p className="font-mono text-[11px] text-muted-foreground">{t("risk.valNoPe")}</p>
                    )}
                    <p className="col-span-2 text-xs leading-relaxed text-muted-foreground sm:col-span-1">{message(w)}</p>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </ChartCard>
  );
};
