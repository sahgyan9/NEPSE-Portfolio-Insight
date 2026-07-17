import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CompoundingProjector } from "@/components/CompoundingProjector";
import { PortfolioValueTrendChart } from "@/components/PortfolioValueTrendChart";
import { PortfolioHealthScore } from "@/components/PortfolioHealthScore";
import { SectorAllocationChart } from "@/components/SectorAllocationChart";
import { AIChatbot } from "@/components/AIChatbot";
import { usePortfolioAnalytics } from "@/hooks/usePortfolio";
import { useApiKey } from "@/hooks/useApiKey";
import { useEffect } from "react";
import { toast } from "@/hooks/use-toast";

const MiscPage = () => {
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
            title: "Data Refreshed",
            description: lastUpdated
                ? `Portfolio data updated at ${lastUpdated.toLocaleTimeString()}`
                : "Portfolio data has been updated.",
        });
    };

    useEffect(() => {
        if (error) {
            toast({
                title: "Live Data Notice",
                description: error,
                variant: "default",
            });
        }
    }, [error]);

    return (
        <div className="min-h-screen bg-background">
            <Header
                onRefresh={handleRefresh}
                isRefreshing={isLoading}
            />

            <main className="container px-4 py-6 space-y-6">
                {/* Live Data Status */}
                {lastUpdated && (
                    <div className="text-xs text-muted-foreground text-right">
                        Last updated: {lastUpdated.toLocaleTimeString()} • Data from ShareBazaar API
                    </div>
                )}

                <h1 className="text-2xl font-bold">Miscellaneous Tools</h1>

                {/* Portfolio Health Score */}
                <section>
                    <PortfolioHealthScore holdings={holdings} />
                </section>

                {/* Portfolio Value Trend Chart */}
                <section>
                    <PortfolioValueTrendChart summary={summary} />
                </section>

                {/* Compounding Growth Projector */}
                <section>
                    <CompoundingProjector />
                </section>

                {/* Sector Allocation Chart */}
                <section>
                    <SectorAllocationChart data={sectorData} />
                </section>

                {/* Footer */}
                <Footer apiKey={apiKey} onApiKeyChange={handleApiKeyChange} />
            </main>

            {/* AI Chatbot - Floating */}
            <AIChatbot holdings={holdings} summary={summary} />
        </div>
    );
};

export default MiscPage;
