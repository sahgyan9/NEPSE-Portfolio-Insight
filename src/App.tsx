import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import FundamentalsPage from "./pages/FundamentalsPage";
import MarketPage from "./pages/MarketPage";
import MiscPage from "./pages/MiscPage";
import DividendsPage from "./pages/DividendsPage";
import QuarterlyPage from "./pages/QuarterlyPage";
import IntelligencePage from "./pages/Intelligence";
import RiskPage from "./pages/RiskPage";
import ResearchPage from "./pages/ResearchPage";
import { ShortcutsProvider } from "./components/ShortcutsProvider";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ShortcutsProvider />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/fundamentals" element={<FundamentalsPage />} />
          <Route path="/market" element={<MarketPage />} />
          <Route path="/dividends" element={<DividendsPage />} />
          <Route path="/quarterly" element={<QuarterlyPage />} />
          <Route path="/intelligence" element={<IntelligencePage />} />
          <Route path="/risk" element={<RiskPage />} />
          <Route path="/research" element={<ResearchPage />} />
          <Route path="/misc" element={<MiscPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
