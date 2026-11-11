import { Link } from "react-router-dom";
import { ChartCard, CHART } from "@/components/charts";
import type { ValuationWarning } from "@/services/riskApi";

const GROUPS: { type: ValuationWarning["type"]; title: string; note: string }[] = [
  { type: "OVERVALUED", title: "Priced above peers", note: "P/E well above the sector median. The price assumes faster profit growth than peers deliver." },
  { type: "UNDERVALUED", title: "Priced below peers", note: "P/E well below the sector median. Check whether profits are expected to fall before reading this as cheap." },
  { type: "LOSS_MAKING", title: "Loss-making", note: "No P/E can be formed because earnings are negative." },
];

/** Bullet bar: filled bar is the stock's P/E, vertical tick is the sector median. */
const Bullet = ({ pe, median, tone }: { pe: number; median: number; tone: string }) => {
  const max = Math.max(pe, median) * 1.15;
  return (
    <div className="relative h-3 w-full rounded-sm bg-muted" role="img" aria-label={`P/E ${pe.toFixed(1)} against sector median ${median.toFixed(1)}`}>
      <div className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${(pe / max) * 100}%`, background: tone }} />
      <div className="absolute -inset-y-0.5 w-0.5 bg-foreground" style={{ left: `${(median / max) * 100}%` }} />
    </div>
  );
};

export const ValuationPeers = ({ warnings, loading }: { warnings?: ValuationWarning[]; loading?: boolean }) => (
  <ChartCard
    title="Which holdings are priced very differently from their peers?"
    subtitle="Price-to-earnings (P/E) compared with the median of the same sector"
    explain="pe"
    loading={loading}
    empty={!warnings || warnings.length === 0}
    emptyMessage="No holding is priced far from its sector."
    height={160}
    footer={
      <span>
        Bar is the stock's P/E; the black tick is its sector median. A P/E gap describes pricing today, not whether the company is a good or bad purchase.
      </span>
    }
  >
    <div id="valuation-chart" className="space-y-5">
      {GROUPS.map((g) => {
        const items = (warnings ?? []).filter((w) => w.type === g.type);
        if (items.length === 0) return null;
        const tone = g.type === "OVERVALUED" ? CHART.caution : g.type === "UNDERVALUED" ? CHART.accent : CHART.loss;
        return (
          <div key={g.type}>
            <h4 className="text-sm font-semibold">
              {g.title} <span className="font-normal text-muted-foreground">({items.length})</span>
            </h4>
            <p className="mb-2 text-xs text-muted-foreground">{g.note}</p>
            <ul className="divide-y divide-border rounded-md border border-border">
              {items.map((w) => (
                <li key={w.symbol} className="grid grid-cols-[64px_1fr] items-center gap-3 px-3 py-2 sm:grid-cols-[64px_220px_1fr]">
                  <Link to={`/quarterly?symbol=${w.symbol}`} className="text-sm font-semibold hover:underline">
                    {w.symbol}
                  </Link>
                  {g.type !== "LOSS_MAKING" && w.pe && w.sectorMedianPe ? (
                    <div className="space-y-1">
                      <Bullet pe={w.pe} median={w.sectorMedianPe} tone={tone} />
                      <p className="font-mono text-[11px] text-muted-foreground">
                        P/E {w.pe.toFixed(1)} vs median {w.sectorMedianPe.toFixed(1)}
                      </p>
                    </div>
                  ) : (
                    <p className="font-mono text-[11px] text-muted-foreground">No P/E (loss)</p>
                  )}
                  <p className="col-span-2 text-xs leading-relaxed text-muted-foreground sm:col-span-1">{w.message}</p>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  </ChartCard>
);
