import { Link, useLocation } from "react-router-dom";
import {
  BarChart3,
  RefreshCw,
  Gift,
  FileBarChart,
  Brain,
  Menu,
  TrendingUp,
  Activity,
  MoreHorizontal,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { StockSearch } from "./StockSearch";
import { PortfolioManager } from "./PortfolioManager";
import { NewsTicker } from "./NewsTicker";

interface HeaderProps {
  onRefresh: () => void;
  isRefreshing: boolean;
}

// Primary destinations — always visible in the bar.
const navItems = [
  { path: "/", label: "Home", icon: BarChart3 },
  { path: "/quarterly", label: "Quarterly", icon: FileBarChart },
  { path: "/dividends", label: "Dividends", icon: Gift },
  { path: "/intelligence", label: "Intelligence", icon: Brain },
];

// Secondary destinations — grouped under "More" on desktop, listed inline on mobile.
const moreItems = [
  { path: "/fundamentals", label: "Fundamentals", icon: TrendingUp },
  { path: "/market", label: "Market", icon: Activity },
  { path: "/misc", label: "Misc", icon: MoreHorizontal },
];

export const Header = ({ onRefresh, isRefreshing }: HeaderProps) => {
  const location = useLocation();
  const isMoreActive = moreItems.some((item) => item.path === location.pathname);

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

              {/* Secondary destinations grouped under one menu to keep the bar lean */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={isMoreActive ? "secondary" : "ghost"}
                    size="sm"
                    className={cn("gap-1", isMoreActive && "bg-primary/10 text-primary")}
                  >
                    More
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  {moreItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <DropdownMenuItem key={item.path} asChild>
                        <Link
                          to={item.path}
                          className={cn("gap-2 cursor-pointer", isActive && "text-primary")}
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
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
                    {[...navItems, ...moreItems].map((item) => {
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
