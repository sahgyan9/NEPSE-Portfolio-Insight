import { useState } from "react";
import { Brain, Loader2, RefreshCw, Eye, ListChecks, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StockHolding, PortfolioSummary } from "@/data/portfolioData";
import { toast } from "@/hooks/use-toast";
import { useT } from "@/i18n";
import {
  buildExplanationPrompt,
  parseExplanation,
  classifyAiError,
  AiRequestError,
  toAiRequestError,
  type Explanation,
} from "@/lib/aiPrompt";

interface AIRecommendationsProps {
  holdings: StockHolding[];
  summary: PortfolioSummary;
  apiKey: string;
}

export const AIRecommendations = ({ holdings, summary, apiKey }: AIRecommendationsProps) => {
  const { t, lang } = useT();
  const [analysis, setAnalysis] = useState<Explanation | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Runs only when the user presses the button
  const generateAnalysis = async () => {
    if (!apiKey) {
      toast({ title: t("ai.noKeyTitle"), description: t("ai.noKeyBody"), variant: "destructive" });
      return;
    }

    setIsLoading(true);
    const prompt = buildExplanationPrompt(lang, holdings, summary);

    try {
      let response: Response;
      try {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2048,
              },
            }),
          }
        );
      } catch {
        throw new AiRequestError("network");
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const msg: string = errorData?.error?.message || "";
        throw new AiRequestError(classifyAiError(response.status, msg), msg);
      }

      const data = await response.json();
      const text: string | undefined = data.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = text ? parseExplanation(text) : null;
      if (!parsed) throw new AiRequestError("other", "parse");

      setAnalysis(parsed);
      toast({ title: t("ai.doneTitle") });
    } catch (error) {
      console.error("AI explanation error:", error);
      const err = toAiRequestError(error);
      const description =
        err.kind === "network"
          ? t("ai.errNetwork")
          : err.kind === "invalidKey"
            ? t("ai.errInvalidKey")
            : err.kind === "quota"
              ? t("ai.errQuota")
              : err.message === "parse"
                ? t("ai.errParse")
                : t("ai.errOther");
      toast({ title: t("ai.failedTitle"), description, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="surface p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex items-start gap-2">
          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold leading-snug">{t("ai.cardTitle")}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{t("ai.cardSubtitle")}</p>
          </div>
        </div>
        <Button
          onClick={generateAnalysis}
          disabled={isLoading || !apiKey}
          className="gap-2 min-h-11"
          variant={analysis ? "outline" : "default"}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("ai.running")}
            </>
          ) : analysis ? (
            <>
              <RefreshCw className="h-4 w-4" />
              {t("ai.rerun")}
            </>
          ) : (
            t("ai.run")
          )}
        </Button>
      </div>

      {!apiKey && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 p-4">
          <KeyRound className="h-5 w-5 mt-0.5 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-medium text-sm leading-relaxed">{t("ai.noKeyTitle")}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{t("ai.noKeyBody")}</p>
          </div>
        </div>
      )}

      {apiKey && !analysis && !isLoading && (
        <div className="text-center py-6 text-muted-foreground">
          <Brain className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium leading-relaxed">{t("ai.emptyTitle")}</p>
          <p className="text-sm mt-1 leading-relaxed">{t("ai.emptyBody")}</p>
        </div>
      )}

      {analysis && (
        <div className="space-y-4">
          {analysis.observations.length > 0 && (
            <section className="rounded-lg border border-border bg-secondary/50 p-4">
              <h4 className="flex items-center gap-2 font-semibold text-primary mb-2">
                <Eye className="h-4 w-4" />
                {t("ai.observations")}
              </h4>
              <ul className="space-y-2">
                {analysis.observations.map((item, i) => (
                  <li key={i} className="text-sm leading-relaxed text-foreground/90 flex gap-2">
                    <span className="font-medium text-muted-foreground">{i + 1}.</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {analysis.thingsToCheck.length > 0 && (
            <section className="rounded-lg border border-border bg-card p-4">
              <h4 className="flex items-center gap-2 font-semibold text-primary mb-2">
                <ListChecks className="h-4 w-4" />
                {t("ai.thingsToCheck")}
              </h4>
              <ul className="space-y-2">
                {analysis.thingsToCheck.map((item, i) => (
                  <li key={i} className="text-sm leading-relaxed text-foreground/90 flex gap-2">
                    <span className="font-medium text-muted-foreground">{i + 1}.</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-4 leading-relaxed">{t("ai.notice")}</p>
    </div>
  );
};
