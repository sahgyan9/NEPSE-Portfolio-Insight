import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  BarChart3, 
  RefreshCw, 
  Key, 
  TrendingUp, 
  Activity, 
  MoreHorizontal, 
  Gift, 
  FileBarChart, 
  Brain, 
  Menu 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
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
    { path: "/quarterly", label: "Quarterly", icon: FileBarChart },
    { path: "/dividends", label: "Dividends", icon: Gift },
    { path: "/intelligence", label: "Intelligence", icon: Brain },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 flex items-center justify-center">
                <img src="/favicon.svg" alt="NEPSE Portfolio Insight" className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">
                  <span className="text-primary">NEPSE</span> Portfolio
                </h1>
                <p className="text-xs text-muted-foreground hidden sm:block">Intelligent Investment Analysis</p>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1">
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
              className="hover:bg-primary/10 animate-fade-in"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>

            {/* Gemini configuration */}
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
                  <span className="hidden lg:inline">{apiKey ? "API Active" : "Configure API"}</span>
                  {apiKey && <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md bg-card border-border">
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

            {/* Mobile Drawer Trigger */}
            <div className="lg:hidden flex items-center">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="hover:bg-primary/10">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[280px] bg-card border-r border-border/40 p-0 flex flex-col">
                  <div className="p-6 border-b border-border/40 flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10 flex items-center justify-center">
                      <img src="/favicon.svg" alt="Logo" className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold tracking-tight">NEPSE Portfolio</h2>
                      <p className="text-xs text-muted-foreground">Investment Analysis</p>
                    </div>
                  </div>
                  <nav className="flex-1 py-4 px-2 space-y-1">
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = location.pathname === item.path;
                      return (
                        <SheetClose asChild key={item.path}>
                          <Link to={item.path} className="block">
                            <Button
                              variant={isActive ? "secondary" : "ghost"}
                              className={cn(
                                "w-full justify-start gap-3 h-10 px-4",
                                isActive && "bg-primary/10 text-primary"
                              )}
                            >
                              <Icon className="h-4 w-4" />
                              {item.label}
                            </Button>
                          </Link>
                        </SheetClose>
                      );
                    })}
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>
      {/* News Ticker rendered below header outside header block */}
      <NewsTicker />
    </>
  );
};
