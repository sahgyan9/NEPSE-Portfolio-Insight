/**
 * Fundamentals Archive Card
 * =========================
 * Shows the state of the growing all-company fundamentals archive
 * (db/fundamentals_archive/) and lets the user trigger a collection on demand.
 *
 * The archive accumulates one snapshot per company per published quarter, so
 * that after several quarters it can be mined to find consistently-improving
 * companies. Collection also runs automatically once a quarter (backend
 * scheduler in portfolio_db.py); this card is the manual trigger + status view.
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Database, Loader2, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useT } from "@/i18n";
import { fmtDate, fmtNumber } from "@/i18n/format";
import { useViewMode } from "@/hooks/useViewMode";

interface ArchiveStatus {
    last_run: string | null;
    days_since: number | null;
    running: boolean;
    last_stats?: {
        new?: number;
        updated?: number;
        skipped_funds?: number;
        failed?: number;
    } | null;
}

const statusUrl = () =>
    import.meta.env.DEV
        ? "/api/portfolio-db/api/fundamentals/archive/status"
        : "http://localhost:5001/api/fundamentals/archive/status";

const triggerUrl = () =>
    import.meta.env.DEV
        ? "/api/portfolio-db/api/fundamentals/archive"
        : "http://localhost:5001/api/fundamentals/archive";

/** Advanced-mode tool: it is hidden in simple mode. */
export const FundamentalsArchiveCard = () => {
    const { t } = useT();
    const { isSimple } = useViewMode();
    const [status, setStatus] = useState<ArchiveStatus | null>(null);
    const [starting, setStarting] = useState(false);
    const [reachable, setReachable] = useState(true);

    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch(statusUrl());
            if (res.ok) {
                setStatus(await res.json());
                setReachable(true);
            } else {
                setReachable(false);
            }
        } catch {
            setReachable(false);
        }
    }, []);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    // While a collection is running, poll every 15s until it finishes.
    useEffect(() => {
        if (!status?.running) return;
        const id = setInterval(fetchStatus, 15000);
        return () => clearInterval(id);
    }, [status?.running, fetchStatus]);

    const handleCollect = async () => {
        setStarting(true);
        try {
            const res = await fetch(triggerUrl(), { method: "POST" });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.success) {
                toast({
                    title: t("valuation.arToastStartedTitle"),
                    description: t("valuation.arToastStartedDesc"),
                });
                setTimeout(fetchStatus, 1500);
            } else if (data.status === "running") {
                toast({ title: t("valuation.arToastRunningTitle"), description: t("valuation.arToastRunningDesc") });
            } else {
                toast({ title: t("valuation.arToastFailTitle"), description: t("valuation.arToastFailDesc"), variant: "destructive" });
            }
        } catch {
            toast({ title: t("valuation.arToastFailTitle"), description: t("valuation.arToastNoServer"), variant: "destructive" });
        } finally {
            setStarting(false);
        }
    };

    const lastRunText = () => {
        if (!status?.last_run) return t("valuation.arNever");
        const d = status.days_since;
        const when = fmtDate(status.last_run);
        if (d === 0) return t("valuation.arToday", { date: when });
        if (d === 1) return t("valuation.arYesterday", { date: when });
        return t("valuation.arDaysAgo", { days: fmtNumber(d), date: when });
    };

    const isRunning = status?.running || false;

    if (isSimple) return null;

    return (
        <div className="mt-8 p-4 rounded-lg bg-muted/50 border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                    <Database className="w-5 h-5 mt-0.5 text-primary shrink-0" />
                    <div>
                        <h4 className="font-semibold">{t("valuation.arTitle")}</h4>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                            {t("valuation.arDesc")}
                        </p>
                        <p className="text-sm leading-relaxed text-muted-foreground mt-1">
                            {!reachable ? t("valuation.arOffline") : lastRunText()}
                            {status?.last_stats?.new != null && reachable && (
                                <span> · {t("valuation.arStats", { added: fmtNumber(status.last_stats.new), updated: fmtNumber(status.last_stats.updated ?? 0) })}</span>
                            )}
                        </p>
                    </div>
                </div>
                <Button
                    onClick={handleCollect}
                    disabled={starting || isRunning || !reachable}
                    className="h-11 w-full shrink-0 sm:w-auto"
                >
                    {isRunning ? (
                        <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> {t("valuation.arCollecting")}</>
                    ) : starting ? (
                        <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> {t("valuation.arStarting")}</>
                    ) : (
                        <><RefreshCw className="h-4 w-4 mr-1" /> {t("valuation.arCollect")}</>
                    )}
                </Button>
            </div>
        </div>
    );
};
