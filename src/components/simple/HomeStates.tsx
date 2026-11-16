import { DatabaseZap, Loader2, RefreshCw } from "lucide-react";
import { useT } from "@/i18n";
import { Button } from "@/components/ui/button";
import { PortfolioImportZone } from "@/components/PortfolioImportZone";
import type { ImportCsvResult } from "@/services/portfolioDb";

/** Shown when the local portfolio database does not answer and nothing has loaded yet. */
export const DatabaseDownState = ({ onRetry, retrying }: { onRetry: () => void; retrying?: boolean }) => {
  const { t } = useT();
  return (
    <div className="surface mx-auto max-w-xl space-y-4 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <DatabaseZap className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
        <div className="space-y-2">
          <h2 className="text-lg font-semibold tracking-tight">{t("home.dbDownTitle")}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("home.dbDownBody")}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("home.dbDownFix")}</p>
        </div>
      </div>
      <div className="flex flex-col gap-3 border-t border-border pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-1.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          {t("home.dbDownChecking")}
        </span>
        <Button variant="outline" className="h-11 sm:h-9" onClick={onRetry} disabled={retrying}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t("home.retryNow")}
        </Button>
      </div>
    </div>
  );
};

/** First visit: no holdings yet. Three steps to get the file from Meroshare, then the drop box. */
export const NoPortfolioState = ({ onImported }: { onImported: (result: ImportCsvResult) => void }) => {
  const { t } = useT();
  const steps = [t("home.emptyStep1"), t("home.emptyStep2"), t("home.emptyStep3")];
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("home.emptyTitle")}</h2>
        <p className="mt-2 leading-relaxed text-muted-foreground">{t("home.emptyBody")}</p>
      </div>
      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <span className="pt-0.5 text-sm leading-relaxed">{step}</span>
          </li>
        ))}
      </ol>
      <PortfolioImportZone onImported={onImported} showHelp={false} />
      <p className="text-xs leading-relaxed text-muted-foreground">{t("home.emptyPrivacy")}</p>
    </div>
  );
};
