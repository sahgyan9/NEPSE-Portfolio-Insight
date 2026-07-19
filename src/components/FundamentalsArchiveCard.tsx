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

export const FundamentalsArchiveCard = () => {
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
                    title: "Collection started",
                    description: "Fetching fundamentals for every listed company. This takes a few minutes — the status below will update automatically.",
                });
                setTimeout(fetchStatus, 1500);
            } else if (data.status === "running") {
                toast({ title: "Already running", description: "A collection is already in progress." });
            } else {
                toast({ title: "Could not start", description: data.message || "Is the database server running?", variant: "destructive" });
            }
        } catch {
            toast({ title: "Could not start", description: "Could not reach the database server.", variant: "destructive" });
        } finally {
            setStarting(false);
        }
    };

    const lastRunText = () => {
        if (!status?.last_run) return "Never collected yet";
        const d = status.days_since;
        const when = new Date(status.last_run).toLocaleDateString();
        if (d === 0) return `Last collected today (${when})`;
        if (d === 1) return `Last collected yesterday (${when})`;
        return `Last collected ${d} days ago (${when})`;
    };

    const isRunning = status?.running || false;

    return (
        <div className="mt-8 p-4 rounded-lg bg-muted/50 border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                    <Database className="w-5 h-5 mt-0.5 text-primary shrink-0" />
                    <div>
                        <h4 className="font-semibold">Fundamentals Archive</h4>
                        <p className="text-sm text-muted-foreground">
                            A growing quarterly record of every listed company's fundamentals — build history now to spot the best performers later.
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {!reachable ? "Database server offline — start it to enable collection." : lastRunText()}
                            {status?.last_stats?.new != null && reachable && (
                                <span> · {status.last_stats.new} new + {status.last_stats.updated ?? 0} refreshed last run</span>
                            )}
                        </p>
                    </div>
                </div>
                <Button
                    onClick={handleCollect}
                    disabled={starting || isRunning || !reachable}
                    size="sm"
                    className="shrink-0"
                >
                    {isRunning ? (
                        <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Collecting…</>
                    ) : starting ? (
                        <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Starting…</>
                    ) : (
                        <><RefreshCw className="h-4 w-4 mr-1" /> Collect now</>
                    )}
                </Button>
            </div>
        </div>
    );
};
