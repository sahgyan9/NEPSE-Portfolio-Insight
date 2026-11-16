import { useMemo, type ReactNode } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartNoAxesCombined, Gift, TriangleAlert } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AIChatbot } from "@/components/AIChatbot";
import { Explain } from "@/components/Explain";
import { SectionHeading } from "@/components/SectionHeading";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartCard, CHART, TooltipBox, axisLine, axisTick, gridProps } from "@/components/charts";
import { usePortfolioAnalytics } from "@/hooks/usePortfolio";
import { useApiKey } from "@/hooks/useApiKey";
import { useViewMode } from "@/hooks/useViewMode";
import { useSipData, type SipFund, type SipRow } from "@/services/sipApi";
import { currencyPrefix, fmtDate, fmtMoney, fmtMonthYear, fmtPercent } from "@/i18n/format";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

const RECENT_ROWS = 5;

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const fmtNav = (v: number | null | undefined) => (isNum(v) ? `${currencyPrefix()} ${v.toFixed(2)}` : "-");
const fmtUnits = (v: number | null | undefined) =>
  isNum(v) ? v.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "-";
const fmtFracSigned = (v: number | null | undefined) => (isNum(v) ? fmtPercent(v * 100, 1) : "-");
const toneOf = (v: number | null | undefined) =>
  !isNum(v) || v === 0 ? "" : v > 0 ? "text-success" : "text-destructive";
const signedMoney = (v: number) => `${v > 0 ? "+" : ""}${fmtMoney(v)}`;

const Stat = ({ label, value, note, tone, children }: { label: string; value: string; note?: string; tone?: string; children?: ReactNode }) => (
  <div className="rounded-md border border-border p-3">
    <p className="flex items-center gap-1 text-sm text-muted-foreground">
      {label}
      {children}
    </p>
    <p className={cn("mt-1 font-mono text-xl font-semibold", tone)}>{value}</p>
    {note && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{note}</p>}
  </div>
);

/** Instalments as stacked rows: used on phones and for the short list in the simple view. */
const RowList = ({ rows }: { rows: SipRow[] }) => {
  const { t } = useT();
  return (
    <ul className="divide-y divide-border">
      {rows.map((r, i) => (
        <li key={`${r.date}-${i}`} className="flex items-start justify-between gap-3 py-2.5 text-sm">
          <div className="min-w-0">
            <p className="font-medium">{fmtDate(r.date)}</p>
            <p className="text-xs text-muted-foreground">
              {t(`sip.kind_${r.kind}`)}
              {isNum(r.navPaid) && ` · ${t("sip.rowNav", { nav: fmtNav(r.navPaid) })}`}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono">{r.kind === "dividend_units" ? t("sip.noCash") : fmtMoney(r.amount)}</p>
            <p className="text-xs text-muted-foreground">{t("sip.rowUnits", { units: fmtUnits(r.units) })}</p>
          </div>
        </li>
      ))}
    </ul>
  );
};

const RowTable = ({ rows }: { rows: SipRow[] }) => {
  const { t } = useT();
  return (
    <div className="max-h-[520px] overflow-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-muted text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-medium">{t("sip.colDate")}</th>
            <th scope="col" className="px-3 py-2 text-left font-medium">{t("sip.colKind")}</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">{t("sip.colAmount")}</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">{t("sip.colNavPaid")}</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">{t("sip.colUnits")}</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">{t("sip.colSince")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => (
            <tr key={`${r.date}-${i}`}>
              <td className="whitespace-nowrap px-3 py-2">{fmtDate(r.date)}</td>
              <td className="px-3 py-2 text-muted-foreground">{t(`sip.kind_${r.kind}`)}</td>
              <td className="px-3 py-2 text-right font-mono">
                {r.kind === "dividend_units" ? <span className="font-sans text-muted-foreground">{t("sip.noCash")}</span> : fmtMoney(r.amount)}
              </td>
              <td className="px-3 py-2 text-right font-mono">{isNum(r.navPaid) ? r.navPaid.toFixed(2) : "-"}</td>
              <td className="px-3 py-2 text-right font-mono">{fmtUnits(r.units)}</td>
              <td className={cn("px-3 py-2 text-right font-mono", toneOf(r.navChange))}>{fmtFracSigned(r.navChange)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const NavPaidChart = ({ fund }: { fund: SipFund }) => {
  const { t } = useT();
  const data = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const r of fund.rows) if (r.kind === "instalment" && isNum(r.navPaid)) byDate.set(r.date, r.navPaid);
    return [...byDate].map(([date, navPaid]) => ({ date, navPaid }));
  }, [fund]);

  return (
    <ChartCard
      title={t("sip.chartTitle")}
      subtitle={isNum(fund.nav) ? t("sip.chartSub", { nav: fmtNav(fund.nav) }) : undefined}
      empty={data.length < 2}
      emptyMessage={t("sip.chartEmpty")}
      height={260}
    >
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="date" tick={axisTick} axisLine={axisLine} tickLine={false} minTickGap={48} tickFormatter={(v) => fmtMonthYear(String(v))} />
            <YAxis width={44} tick={axisTick} axisLine={false} tickLine={false} domain={["auto", "auto"]} tickFormatter={(v) => Number(v).toFixed(1)} />
            <Tooltip
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={fmtDate(String(label))}
                    rows={[{ label: t("sip.chartNavPaid"), value: fmtNav(payload[0].value as number), color: CHART.accent }]}
                  />
                ) : null
              }
            />
            {isNum(fund.nav) && <ReferenceLine y={fund.nav} stroke={CHART.market} strokeDasharray="4 3" ifOverflow="extendDomain" />}
            <Line type="monotone" dataKey="navPaid" stroke={CHART.accent} strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};

const FundSection = ({ fund, isSimple, onShowFull }: { fund: SipFund; isSimple: boolean; onShowFull: () => void }) => {
  const { t } = useT();
  const hasValue = isNum(fund.value);
  const charge = fund.rows.find((r) => isNum(r.charge))?.charge;
  const newestFirst = useMemo(() => [...fund.rows].reverse(), [fund]);
  const sentenceVars = {
    paid: fmtMoney(fund.totalPaid),
    count: fund.instalmentCount,
    date: fmtMonthYear(fund.firstDate),
    value: fmtMoney(fund.value),
  };
  const showUnitsNote = isNum(fund.dematUnits) && Math.abs(fund.statementUnits - fund.dematUnits) >= 0.01;

  return (
    <div className="space-y-6">
      <section className="surface space-y-4 p-4 sm:p-5" aria-labelledby={`sip-${fund.symbol}`}>
        <div>
          <h2 id={`sip-${fund.symbol}`} className="text-base font-semibold">
            {fund.name} <span className="font-mono text-sm font-normal text-muted-foreground">{fund.symbol}</span>
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("sip.fundKind")}</p>
        </div>

        <p className="text-base leading-relaxed">{t(hasValue ? "sip.sentence" : "sip.sentenceNoNav", sentenceVars)}</p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label={t("sip.paid")}
            value={fmtMoney(fund.totalPaid)}
            note={
              isNum(fund.usualAmount)
                ? t(isNum(charge) ? "sip.paidNoteCharge" : "sip.paidNote", {
                    count: fund.instalmentCount,
                    amount: fmtMoney(fund.usualAmount),
                    charge: fmtMoney(charge),
                  })
                : undefined
            }
          />
          <Stat
            label={t("sip.value")}
            value={fmtMoney(fund.value)}
            note={hasValue ? t("sip.valueNote", { units: fmtUnits(fund.units), nav: fmtNav(fund.nav) }) : undefined}
          />
          <Stat
            label={t("sip.gain")}
            value={isNum(fund.gain) ? `${signedMoney(fund.gain)} (${fmtFracSigned(fund.gainPct)})` : "-"}
            tone={toneOf(fund.gain)}
            note={fund.dividendUnits > 0 ? t("sip.gainNoteDividend") : t("sip.gainNote")}
          />
          <Stat
            label={t("sip.yearly")}
            value={fmtFracSigned(fund.yearlyReturn)}
            tone={toneOf(fund.yearlyReturn)}
            note={isNum(fund.yearlyReturn) ? t("sip.yearlyNote") : t("sip.yearlyNA")}
          >
            <Explain text={t("sip.yearlyExplain")} title={t("sip.yearly")} />
          </Stat>
        </div>

        <ul className="space-y-1 text-sm leading-relaxed text-muted-foreground">
          {isNum(fund.nav) && <li>{t("sip.navLine", { nav: fmtNav(fund.nav), date: fmtDate(fund.navDate) })}</li>}
          {isNum(fund.avgCost) && <li>{t("sip.avgCost", { cost: fmtNav(fund.avgCost) })}</li>}
          {isNum(fund.lowestNavPaid) && isNum(fund.highestNavPaid) && (
            <li>{t("sip.navRange", { low: fmtNav(fund.lowestNavPaid), high: fmtNav(fund.highestNavPaid) })}</li>
          )}
          {showUnitsNote && (
            <li>{t("sip.unitsNote", { demat: fmtUnits(fund.dematUnits), statement: fmtUnits(fund.statementUnits) })}</li>
          )}
        </ul>
      </section>

      <section className="surface space-y-2 p-4 sm:p-5" aria-labelledby={`sip-div-${fund.symbol}`}>
        <h2 id={`sip-div-${fund.symbol}`} className="flex items-center gap-2 text-base font-semibold">
          <Gift className="h-4 w-4 text-primary" aria-hidden="true" />
          {t("sip.divTitle")}
        </h2>
        {fund.dividends.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{t("sip.divNone")}</p>
        ) : (
          <>
            <p className="font-mono text-xl font-semibold">
              {isNum(fund.dividendValue)
                ? t("sip.divTotal", { units: fmtUnits(fund.dividendUnits), value: fmtMoney(fund.dividendValue) })
                : t("sip.rowUnits", { units: fmtUnits(fund.dividendUnits) })}
            </p>
            <ul className="divide-y divide-border text-sm">
              {fund.dividends.map((d, i) => (
                <li key={`${d.date}-${i}`} className="flex items-start justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {d.fiscalYear ? t("sip.divFy", { fy: d.fiscalYear }) : fmtDate(d.date)}
                    </p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {t("sip.divCredited", { date: fmtDate(d.date) })}
                      {isNum(d.declaredPercent) && ` · ${t("sip.divDeclared", { pct: d.declaredPercent })}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono">{t("sip.rowUnits", { units: fmtUnits(d.units) })}</p>
                    {isNum(d.valueNow) && <p className="text-xs text-muted-foreground">{fmtMoney(d.valueNow)}</p>}
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-sm leading-relaxed text-muted-foreground">{t("sip.divNote")}</p>
          </>
        )}
      </section>

      {!isSimple && <NavPaidChart fund={fund} />}

      <section className="surface space-y-2 p-4 sm:p-5">
        <h2 className="text-base font-semibold">
          {isSimple ? t("sip.recentTitle") : t("sip.allTitle", { count: fund.rows.length })}
        </h2>
        {isSimple ? (
          <RowList rows={newestFirst.slice(0, RECENT_ROWS)} />
        ) : (
          <>
            <div className="md:hidden">
              <RowList rows={newestFirst} />
            </div>
            <div className="hidden md:block">
              <RowTable rows={newestFirst} />
            </div>
          </>
        )}
      </section>

      {isSimple && (
        <div className="flex justify-center">
          <Button variant="outline" className="h-11 gap-2" onClick={onShowFull}>
            <ChartNoAxesCombined className="h-4 w-4" aria-hidden="true" />
            {t("sip.showFull")}
          </Button>
        </div>
      )}
    </div>
  );
};

const SipPage = () => {
  const { t } = useT();
  const { isSimple, setMode } = useViewMode();
  const { apiKey, setApiKey } = useApiKey();
  const { holdings, summary, isLoading: portfolioLoading, refetch } = usePortfolioAnalytics();
  const q = useSipData();
  const funds = q.data?.funds ?? [];

  const handleRefresh = async () => {
    await refetch();
    q.refetch();
  };

  const showFull = () => {
    setMode("advanced");
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onRefresh={handleRefresh} isRefreshing={portfolioLoading || q.isFetching} />

      <main className="container space-y-6 px-4 py-6">
        <SectionHeading as="h1" title={t("sip.title")} route="/sip" hint={t("sip.hint")} />

        {q.isLoading && (
          <div className="surface space-y-4 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        )}

        {q.isError && (
          <div className="surface flex items-start gap-2 p-4 text-sm" role="alert">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <p className="font-medium">{t("sip.errTitle")}</p>
              <p className="leading-relaxed text-muted-foreground">
                {(q.error as Error)?.message}. {t("sip.errHelp")}
              </p>
              <Button size="sm" variant="outline" className="mt-2 h-10 sm:h-9" onClick={() => q.refetch()}>
                {t("common.retry")}
              </Button>
            </div>
          </div>
        )}

        {q.isSuccess && funds.length === 0 && (
          <div className="surface space-y-1 p-4 text-sm leading-relaxed">
            <p className="font-medium">{t("sip.emptyTitle")}</p>
            <p className="text-muted-foreground">{t("sip.emptyBody")}</p>
          </div>
        )}

        {funds.map((fund) => (
          <FundSection key={fund.symbol} fund={fund} isSimple={isSimple} onShowFull={showFull} />
        ))}

        {funds.length > 0 && (
          <section className="surface space-y-2 p-4 text-sm leading-relaxed sm:p-5">
            <h2 className="text-base font-semibold">{t("sip.knowTitle")}</h2>
            <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
              <li>{t("sip.know1")}</li>
              <li>{t("sip.know2")}</li>
              <li>{t("sip.know3")}</li>
            </ul>
            <p className="text-muted-foreground">{t("sip.disclaimer")}</p>
          </section>
        )}

        <Footer apiKey={apiKey} onApiKeyChange={setApiKey} />
      </main>

      <AIChatbot holdings={holdings} summary={summary} />
    </div>
  );
};

export default SipPage;
