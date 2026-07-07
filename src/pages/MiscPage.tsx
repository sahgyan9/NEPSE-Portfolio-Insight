import { Header } from "@/components/Header";
import { CompoundingProjector } from "@/components/CompoundingProjector";
import { PortfolioValueTrendChart } from "@/components/PortfolioValueTrendChart";
import { PortfolioHealthScore } from "@/components/PortfolioHealthScore";
import { SectorAllocationChart } from "@/components/SectorAllocationChart";
import { AIChatbot } from "@/components/AIChatbot";
import { usePortfolioAnalytics } from "@/hooks/usePortfolio";
import { useState, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { STORAGE_KEYS } from "@/lib/constants";

const MiscPage = () => {
    const [apiKey, setApiKey] = useState("");

    const {
        holdings,
        summary,
        sectorData,
        isLoading,
        error,
        lastUpdated,
        refetch
    } = usePortfolioAnalytics();

    useEffect(() => {
        const savedKey = localStorage.getItem(STORAGE_KEYS.apiKey);
        if (savedKey) {
            setApiKey(savedKey);
        }

        const defaultKey = "AIzaSyCXEgV6ChL8LLkENETsJoSVIAKsgqSl8Tg";
        if (!savedKey) {
            setApiKey(defaultKey);
            localStorage.setItem(STORAGE_KEYS.apiKey, defaultKey);
        }
    }, []);

    const handleApiKeyChange = (key: string) => {
        setApiKey(key);
        localStorage.setItem(STORAGE_KEYS.apiKey, key);
    };

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
                apiKey={apiKey}
                onApiKeyChange={handleApiKeyChange}
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
                <footer className="text-center py-8 border-t border-border/40">
                    <p className="text-sm text-muted-foreground">
                        Data as of Nov 30, 2025 • Investment advice based on{" "}
                        <span className="text-primary">The Intelligent Investor</span> principles
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        Disclaimer: This is not financial advice. Always do your own research.
                    </p>
                </footer>
            </main>

            {/* AI Chatbot - Floating */}
            <AIChatbot holdings={holdings} summary={summary} />
        </div>
    );
};

export default MiscPage;
