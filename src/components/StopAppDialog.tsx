import { useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Power } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";

const shutdownUrl = () =>
  import.meta.env.DEV ? "/api/portfolio-db/api/app/shutdown" : "http://localhost:5001/api/app/shutdown";

type Phase = "confirm" | "requesting" | "waiting" | "stopped" | "unconfirmed";

/** Resolves once the dashboard server stops answering, or false after `timeoutMs`. */
const waitUntilDown = async (timeoutMs: number): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 800));
    try {
      await fetch(`/favicon.svg?alive=${Date.now()}`, { cache: "no-store" });
    } catch {
      return true;
    }
  }
  return false;
};

interface StopAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const StopAppDialog = ({ open, onOpenChange }: StopAppDialogProps) => {
  const { t } = useT();
  const [phase, setPhase] = useState<Phase>("confirm");
  const [error, setError] = useState<string | null>(null);

  const stop = async () => {
    setError(null);
    setPhase("requesting");
    try {
      const res = await fetch(shutdownUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Portfolio-Action": "shutdown" },
        body: "{}",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
    } catch (e) {
      setError(t("nav.stopFailed", { reason: e instanceof Error ? e.message : String(e) }));
      setPhase("confirm");
      return;
    }
    setPhase("waiting");
    setPhase((await waitUntilDown(20000)) ? "stopped" : "unconfirmed");
  };

  const finished = phase === "waiting" || phase === "stopped" || phase === "unconfirmed";

  return (
    <>
      <AlertDialog open={open && !finished} onOpenChange={(o) => phase === "confirm" && onOpenChange(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("nav.stopConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("nav.stopConfirmBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={phase === "requesting"}>{t("common.cancel")}</AlertDialogCancel>
            <Button variant="destructive" onClick={stop} disabled={phase === "requesting"} className="gap-2">
              {phase === "requesting" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Power className="h-4 w-4" aria-hidden="true" />
              )}
              {t("nav.stopApp")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {finished && createPortal(<StoppedScreen phase={phase} />, document.body)}
    </>
  );
};

/** Covers the whole page once the app is stopping: nothing behind it works any more. */
const StoppedScreen = ({ phase }: { phase: Phase }) => {
  const { t } = useT();
  const title =
    phase === "waiting" ? t("nav.stoppingTitle") : phase === "stopped" ? t("nav.stoppedTitle") : t("nav.stopUnconfirmedTitle");

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="stopped-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background px-4"
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
            {phase === "waiting" ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
            ) : (
              <Power className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            )}
          </span>
          <h1 id="stopped-title" className="text-lg font-semibold" aria-live="polite">
            {title}
          </h1>
        </div>

        {phase === "stopped" && (
          <>
            <p className="mt-4 text-sm text-muted-foreground">{t("nav.stoppedBody")}</p>
            <ol className="mt-4 space-y-3 text-sm">
              <li className="flex gap-3">
                <StepNumber n={1} />
                <span>{t("nav.stoppedStep1")}</span>
              </li>
              <li className="flex gap-3">
                <StepNumber n={2} />
                <span>{t("nav.stoppedStep2")}</span>
              </li>
            </ol>
          </>
        )}

        {phase === "waiting" && <p className="mt-4 text-sm text-muted-foreground">{t("nav.stoppingBody")}</p>}

        {phase === "unconfirmed" && <p className="mt-4 text-sm text-muted-foreground">{t("nav.stopUnconfirmedBody")}</p>}
      </div>
    </div>
  );
};

const StepNumber = ({ n }: { n: number }) => (
  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-xs font-medium">
    {n}
  </span>
);
