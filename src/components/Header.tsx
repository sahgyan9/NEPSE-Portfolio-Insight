import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BarChart3, Settings, RefreshCw, Key, TrendingUp, Activity, PieChart, Coins, MoreHorizontal, Gift, FileBarChart, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { StockSearch } from "./StockSearch";
import { PortfolioManager } from "./PortfolioManager";
import { NewsTicker } from "./NewsTicker";

interface HeaderProps {
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Header = ({ apiKey, onApiKeyChange, onRefresh, isRefreshing }: HeaderProps) => {
  const [tempApiKey, setTempApiKey] = useState(apiKey);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const location = useLocation();

  const handleSaveApiKey = () => {
    onApiKeyChange(tempApiKey);
    setIsDialogOpen(false);
    toast({
      title: "API Key Saved",
      description: "Your Gemini API key has been saved.",
    });
  };

  const navItems = [
    { path: "/", label: "Home", icon: BarChart3 },
    { path: "/fundamentals", label: "Funda", icon: TrendingUp },
    { path: "/quarterly", label: "Qtly", icon: FileBarChart },
    { path: "/market", label: "Market", icon: Activity },
    { path: "/dividends", label: "Divs", icon: Gift },
    { path: "/intelligence", label: "Intel", icon: Brain },
    { path: "/misc", label: "Misc", icon: MoreHorizontal },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                <span className="text-primary">NEPSE</span> Portfolio
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Intelligent Investment Analysis</p>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="hidden xl:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    className={cn(
                      "gap-2",
                      isActive && "bg-primary/10 text-primary"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {/* Stock Search */}
          <StockSearch />

          {/* Portfolio Manager */}
          <PortfolioManager onPortfolioChange={onRefresh} />

          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="hover:bg-primary/10"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant={apiKey ? "outline" : "default"}
                size="sm"
                className={cn(
                  "gap-2",
                  !apiKey && "animate-pulse bg-yellow-500 hover:bg-yellow-600 text-black",
                  apiKey && "border-green-500/50 hover:bg-green-500/10 text-green-500 hover:text-green-600"
                )}
              >
                <Key className="h-4 w-4" />
                <span className="hidden xl:inline">{apiKey ? "API Active" : "Configure API"}</span>
                {apiKey && <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Configure Gemini API Key</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="apiKey">Gemini API Key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="Enter your Gemini API key"
                    value={tempApiKey}
                    onChange={(e) => setTempApiKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Used for AI-powered investment recommendations. Your key is stored locally.
                  </p>
                </div>
                <Button onClick={handleSaveApiKey} className="w-full">
                  Save API Key
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="xl:hidden border-t border-border/40 overflow-x-auto scrollbar-hide">
        <nav className="flex items-center justify-start sm:justify-around p-2 min-w-max gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "flex-col gap-1 h-auto py-2 px-4",
                    isActive && "text-primary"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs">{item.label}</span>
                </Button>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* News Ticker rendered below navbar */}
      <NewsTicker />
    </header>
  );
};
