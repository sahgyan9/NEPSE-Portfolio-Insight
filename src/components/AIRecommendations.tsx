import { useState } from "react";
import { Brain, TrendingUp, TrendingDown, Pause, Plus, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { StockHolding, PortfolioSummary } from "@/data/portfolioData";
import { toast } from "@/hooks/use-toast";

interface AIRecommendationsProps {
  holdings: StockHolding[];
  summary: PortfolioSummary;
  apiKey: string;
}

interface Recommendation {
  scrip: string;
  action: "BUY" | "SELL" | "HOLD" | "ADD MORE";
  reason: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

interface AIAnalysis {
  overallAssessment: string;
  recommendations: Recommendation[];
  riskWarnings: string[];
  longTermOutlook: string;
}

const getActionIcon = (action: string) => {
  switch (action) {
    case "BUY":
      return <TrendingUp className="h-4 w-4" />;
    case "SELL":
      return <TrendingDown className="h-4 w-4" />;
    case "HOLD":
      return <Pause className="h-4 w-4" />;
    case "ADD MORE":
      return <Plus className="h-4 w-4" />;
    default:
      return null;
  }
};

const getActionClass = (action: string) => {
  switch (action) {
    case "BUY":
      return "recommendation-buy";
    case "SELL":
      return "recommendation-sell";
    case "HOLD":
      return "recommendation-hold";
    case "ADD MORE":
      return "recommendation-add";
    default:
      return "";
  }
};

export const AIRecommendations = ({ holdings, summary, apiKey }: AIRecommendationsProps) => {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const generateAnalysis = async () => {
    if (!apiKey) {
      toast({
        title: "API Key Required",
        description: "Please enter your Gemini API key to get AI recommendations.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    const portfolioContext = holdings
      .map(
        (h) =>
          `${h.scrip} (${h.fullName}): Qty=${h.quantity}, Cost=Rs.${h.waccRate.toFixed(2)}, Current=Rs.${h.currentPrice}, Gain=${h.gainLossPercent.toFixed(2)}%, P/B=${h.pbRatio || "N/A"}, P/E=${h.peRatio || "N/A"}, Div Yield=${h.dividendYield || 0}%, Sector=${h.sector}`
      )
      .join("\n");

    const prompt = `You are an expert investment advisor inspired by Benjamin Graham's "The Intelligent Investor" principles. Analyze this NEPSE (Nepal Stock Exchange) portfolio for a 20-year long-term investment horizon.

Portfolio Summary:
- Total Invested: Rs. ${summary.totalInvested.toLocaleString()}
- Current Value: Rs. ${summary.currentValue.toLocaleString()}
- Overall Gain/Loss: ${summary.totalGainLossPercent.toFixed(2)}%
- Total Holdings: ${summary.totalHoldings}

Individual Holdings:
${portfolioContext}

Provide analysis in this EXACT JSON format (no markdown, just pure JSON):
{
  "overallAssessment": "2-3 sentence overall portfolio health assessment",
  "recommendations": [
    {
      "scrip": "STOCK_SYMBOL",
      "action": "BUY|SELL|HOLD|ADD MORE",
      "reason": "Specific reason based on fundamentals, P/B ratio, sector outlook, dividend yield for long-term",
      "confidence": "HIGH|MEDIUM|LOW"
    }
  ],
  "riskWarnings": ["Warning 1", "Warning 2"],
  "longTermOutlook": "2-3 sentences about 20-year portfolio potential"
}

Focus on:
1. Value investing principles (low P/B, consistent dividends, margin of safety)
2. Sector diversification
3. Blue-chip vs speculative holdings
4. Dividend income for compounding
5. Avoid market timing, focus on fundamentals`;

    try {
      const response = await fetch(
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

      if (!response.ok) {
        throw new Error("Failed to get AI response");
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error("Empty response from AI");
      }

      // Parse JSON from response (handle potential markdown wrapping)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Could not parse AI response");
      }

      const analysisData = JSON.parse(jsonMatch[0]) as AIAnalysis;
      setAnalysis(analysisData);

      toast({
        title: "Analysis Complete",
        description: "AI recommendations have been generated based on Intelligent Investor principles.",
      });
    } catch (error) {
      console.error("AI Analysis error:", error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to generate AI analysis",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-card p-4 opacity-0 animate-fade-in" style={{ animationDelay: "900ms" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">AI Investment Advisor</h3>
            <p className="text-xs text-muted-foreground">Powered by Intelligent Investor principles</p>
          </div>
        </div>
        <Button
          onClick={generateAnalysis}
          disabled={isLoading}
          className="gap-2"
          variant={analysis ? "outline" : "default"}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : analysis ? (
            <>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate Analysis
            </>
          )}
        </Button>
      </div>

      {!analysis && !isLoading && (
        <div className="text-center py-8 text-muted-foreground">
          <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Click "Generate Analysis" to get AI-powered investment recommendations</p>
          <p className="text-xs mt-2">Based on Benjamin Graham's value investing principles</p>
        </div>
      )}

      {analysis && (
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-6">
            {/* Overall Assessment */}
            <div className="p-4 rounded-lg bg-secondary/50 border border-border">
              <h4 className="font-semibold text-primary mb-2">Portfolio Assessment</h4>
              <p className="text-sm text-foreground/90">{analysis.overallAssessment}</p>
            </div>

            {/* Recommendations */}
            <div>
              <h4 className="font-semibold mb-3">Stock Recommendations</h4>
              <div className="space-y-3">
                {analysis.recommendations.map((rec, index) => (
                  <div
                    key={index}
                    className={cn(
                      "p-3 rounded-lg border transition-all duration-200 hover:scale-[1.01]",
                      getActionClass(rec.action)
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getActionIcon(rec.action)}
                        <span className="font-bold">{rec.scrip}</span>
                        <Badge variant="outline" className="text-xs">
                          {rec.action}
                        </Badge>
                      </div>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs",
                          rec.confidence === "HIGH" && "bg-success/20 text-success",
                          rec.confidence === "MEDIUM" && "bg-accent/20 text-accent",
                          rec.confidence === "LOW" && "bg-muted text-muted-foreground"
                        )}
                      >
                        {rec.confidence} confidence
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground/80">{rec.reason}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk Warnings */}
            {analysis.riskWarnings.length > 0 && (
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30">
                <h4 className="font-semibold text-destructive mb-2">⚠️ Risk Warnings</h4>
                <ul className="space-y-1">
                  {analysis.riskWarnings.map((warning, index) => (
                    <li key={index} className="text-sm text-foreground/80 flex items-start gap-2">
                      <span className="text-destructive">•</span>
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Long Term Outlook */}
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
              <h4 className="font-semibold text-primary mb-2">🎯 20-Year Outlook</h4>
              <p className="text-sm text-foreground/90">{analysis.longTermOutlook}</p>
            </div>
          </div>
        </ScrollArea>
      )}
    </div>
  );
};
