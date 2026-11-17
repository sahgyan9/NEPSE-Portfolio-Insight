import { Explain } from "@/components/Explain";
import { useT } from "@/i18n";
import { fmtMoney } from "@/i18n/format";
import { useRealizedGains } from "@/services/realizedApi";
import { cn } from "@/lib/utils";

/** Simple view: one plain sentence about profit already taken by selling. Hidden when nothing was sold. */
export const RealizedLine = () => {
  const { t } = useT();
  const { data } = useRealizedGains();
  if (!data || data.allTime.sales === 0) return null;

  const year = data.thisYear;
  const all = data.allTime;
  const amount = (v: number) => (
    <span className={cn("whitespace-nowrap font-mono font-semibold", v >= 0 ? "text-success" : "text-destructive")}>
      {fmtMoney(Math.abs(v))}
    </span>
  );
  const [before, after] = t(year.profit >= 0 ? "realized.simpleSentence" : "realized.simpleSentenceLoss").split("{amount}");
  const [allBefore, allAfter] = t("realized.simpleAllTime").split("{amount}");

  return (
    <div className="surface space-y-1 p-4 text-base leading-relaxed">
      {year.sales > 0 && (
        <p>
          {before}
          {amount(year.profit)}
          {after}{" "}
          <Explain title={t("realized.stripTitle")} text={t("realized.explain")} className="h-6 w-6" />
        </p>
      )}
      <p className={cn(year.sales > 0 && "text-sm text-muted-foreground")}>
        {allBefore}
        <span className={cn("whitespace-nowrap font-mono font-semibold", all.profit >= 0 ? "text-success" : "text-destructive")}>
          {all.profit >= 0 ? "+" : "-"}
          {fmtMoney(Math.abs(all.profit))}
        </span>
        {allAfter}
      </p>
      {all.feesMissing > 0 && <p className="text-xs text-muted-foreground">{t("realized.feesNote", { count: all.feesMissing })}</p>}
    </div>
  );
};
