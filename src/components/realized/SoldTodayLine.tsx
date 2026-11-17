import { ArrowRight } from "lucide-react";
import { useT } from "@/i18n";
import { fmtMoney } from "@/i18n/format";
import { useRealizedGains } from "@/services/realizedApi";
import { cn } from "@/lib/utils";

interface Props {
  /** Show a link to the sold-shares table (it exists only on the advanced home page). */
  showLink?: boolean;
  className?: string;
}

/**
 * On a day with sales: "Sold today: HBL, NTC. Profit +Rs. 3,539 (before fees)".
 * Profit is against the average buy price, from tools/realized_gains.py, so it agrees with
 * the "Profit from shares you sold" figures. Hidden on days without a sale.
 * "Today" is the server's date (asOf), the same clock that dated the sales.
 */
export const SoldTodayLine = ({ showLink = false, className }: Props) => {
  const { t } = useT();
  const { data } = useRealizedGains();
  if (!data) return null;

  const sales = data.sales.filter((s) => s.date === data.asOf);
  if (sales.length === 0) return null;

  const symbols = [...new Set(sales.map((s) => s.symbol))].join(", ");
  const known = sales.filter((s) => s.profit !== null);
  const profit = known.reduce((sum, s) => sum + (s.profit ?? 0), 0);
  const feesMissing = known.some((s) => s.fees === "not_included");

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border px-3 py-2 text-sm",
        className
      )}
    >
      <span className="font-medium">{t("realized.soldToday", { symbols })}</span>
      {known.length > 0 && (
        <span>
          {t(profit >= 0 ? "realized.soldTodayProfit" : "realized.soldTodayLoss")}{" "}
          <span className={cn("whitespace-nowrap font-mono font-semibold", profit >= 0 ? "text-success" : "text-destructive")}>
            {profit > 0 ? "+" : profit < 0 ? "-" : ""}
            {fmtMoney(Math.abs(profit))}
          </span>
          {feesMissing && <span className="text-muted-foreground"> {t("realized.soldTodayBeforeFees")}</span>}
        </span>
      )}
      {showLink && (
        <a href="#sold" className="ml-auto inline-flex min-h-[44px] items-center gap-1 font-medium text-primary hover:underline sm:min-h-0">
          {t("realized.stripSee")} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      )}
    </div>
  );
};
