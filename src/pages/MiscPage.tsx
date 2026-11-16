import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CompoundingProjector } from "@/components/CompoundingProjector";
import { PortfolioValueTrendChart } from "@/components/PortfolioValueTrendChart";
import { PortfolioHealthScore } from "@/components/PortfolioHealthScore";
import { SectorAllocationChart } from "@/components/SectorAllocationChart";
import { AIChatbot } from "@/components/AIChatbot";
import { usePortfolioAnalytics } from "@/hooks/usePortfolio";
import { useApiKey } from "@/hooks/useApiKey";
import { useT } from "@/i18n";
import { useEffect, type ReactNode } from "react";
import { toast } from "@/hooks/use-toast";

/** A tool with a one-sentence plain description above it. */
const Tool = ({ title, description, children }: { title: string; description: string; children: ReactNode }) => (
    <section>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mb-3 mt-0.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
        {children}
    </section>
);

const MiscPage = () => {
    const { t } = useT();
    const { apiKey, setApiKey: handleApiKeyChange } = useApiKey();

    const {
        holdings,
        summary,
        sectorData,
        isLoading,
        error,
        lastUpdated,
        refetch
    } = usePortfolioAnalytics();

    const handleRefresh = async () => {
        await refetch();
        toast({
            title: t("tools.refreshedTitle"),
            description: lastUpdated
                ? t("tools.refreshedAt", { time: lastUpdated.toLocaleTimeString() })
                : t("tools.refreshedBody"),
        });
    };

    useEffect(() => {
        if (error) {
            toast({
                title: t("tools.noticeTitle"),
                description: error,
                variant: "default",
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [error]);

    return (
        <div className="min-h-screen bg-background">
            <Header
                onRefresh={handleRefresh}
                isRefreshing={isLoading}
            />

            <main className="container space-y-6 px-4 py-6">
                <div>
                    <h1 className="text-2xl font-bold">{t("tools.pageTitle")}</h1>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t("tools.pageIntro")}</p>
                    {lastUpdated && (
                        <p className="mt-1 text-xs text-muted-foreground">
                            {t("tools.lastUpdated", { time: lastUpdated.toLocaleTimeString() })}
                        </p>
                    )}
                </div>

                <Tool title={t("tools.healthTitle")} description={t("tools.healthDesc")}>
                    <PortfolioHealthScore holdings={holdings} />
                </Tool>

                <Tool title={t("tools.trendTitle")} description={t("tools.trendDesc")}>
                    <PortfolioValueTrendChart summary={summary} ready={!isLoading} />
                </Tool>

                <Tool title={t("tools.projectorTitle")} description={t("tools.projectorDesc")}>
                    <CompoundingProjector />
                </Tool>

                <Tool title={t("tools.allocationTitle")} description={t("tools.allocationDesc")}>
                    <SectorAllocationChart data={sectorData} />
                </Tool>

                <Footer apiKey={apiKey} onApiKeyChange={handleApiKeyChange} />
            </main>

            <AIChatbot holdings={holdings} summary={summary} />
        </div>
    );
};

export default MiscPage;
