import { Link, useLocation } from "react-router-dom";
import {
  BarChart3,
  RefreshCw,
  Gift,
  FileBarChart,
  Brain,
  ShieldAlert,
  ClipboardCheck,
  Menu,
  Briefcase,
  Keyboard,
  Sun,
  Moon,
  Monitor,
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Keys } from "@/components/Kbd";
import { useTheme, type ThemePreference } from "@/hooks/useTheme";
import { EVENT_OPEN_HELP, findShortcut } from "@/lib/shortcuts";
import { StockSearch } from "./StockSearch";
import { PortfolioManager } from "./PortfolioManager";
import { NewsTicker } from "./NewsTicker";

interface HeaderProps {
  onRefresh: () => void;
  isRefreshing: boolean;
}

// Primary destinations, always visible in the bar.
const navItems = [
  { path: "/", label: "Overview", icon: BarChart3 },
  { path: "/", to: "/#holdings", section: "holdings", label: "Holdings", icon: Briefcase },
  { path: "/risk", label: "Risk", icon: ShieldAlert },
  { path: "/research", label: "Research", icon: ClipboardCheck },
  { path: "/dividends", label: "Dividends", icon: Gift },
  { path: "/quarterly", label: "Quarterly", icon: FileBarChart },
];

// Secondary destinations, grouped under "More" on desktop and listed inline on mobile.
const moreItems = [
  { path: "/fundamentals", label: "Valuation", icon: TrendingUp },
  { path: "/market", label: "Market", icon: Activity },
  { path: "/intelligence", label: "Sector screen", icon: Brain },
  { path: "/misc", label: "Tools", icon: MoreHorizontal },
];

const ThemeMenu = () => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const Icon = resolvedTheme === "dark" ? Moon : Sun;
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Theme">
              <Icon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent className="flex items-center gap-2">
          Theme <Keys keys={["t"]} />
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as ThemePreference)}>
          <DropdownMenuRadioItem value="light" className="gap-2">
            <Sun className="h-4 w-4" /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" className="gap-2">
            <Moon className="h-4 w-4" /> Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system" className="gap-2">
            <Monitor className="h-4 w-4" /> System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const Header = ({ onRefresh, isRefreshing }: HeaderProps) => {
  const location = useLocation();
  const isMoreActive = moreItems.some((item) => item.path === location.pathname);

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-card">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3">
              <img src="/favicon.svg" alt="" className="h-7 w-7" />
              <div>
                <h1 className="hidden whitespace-nowrap text-base font-semibold tracking-tight min-[1400px]:block">NEPSE Portfolio Insight</h1>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path && !item.section && !(item.path === "/" && location.hash);
                const sc = findShortcut(item.path, item.section);
                return (
                  <Tooltip key={item.label}>
                    <TooltipTrigger asChild>
                      <Link to={item.to ?? item.path}>
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
                    </TooltipTrigger>
                    {sc && (
                      <TooltipContent className="flex items-center gap-2">
                        {item.label} <Keys keys={sc.keys} />
                      </TooltipContent>
                    )}
                  </Tooltip>
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
              className="hidden md:inline-flex"
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (?)"
              onClick={() => window.dispatchEvent(new CustomEvent(EVENT_OPEN_HELP))}
            >
              <Keyboard className="h-4 w-4" />
            </Button>

            <ThemeMenu />

            <Button
              variant="ghost"
              size="icon"
              aria-label="Refresh data"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="hover:bg-primary/10 "
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>

            {/* Mobile Drawer Trigger */}
            <div className="lg:hidden flex items-center">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Open menu">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[280px] bg-card border-r border-border p-0 flex flex-col">
                  <div className="p-5 border-b border-border flex items-center gap-3">
                    <img src="/favicon.svg" alt="" className="h-7 w-7" />
                    <h2 className="text-base font-semibold tracking-tight">NEPSE Portfolio Insight</h2>
                  </div>
                  <nav className="flex-1 py-4 px-2 space-y-1">
                    {[...navItems, ...moreItems].map((item) => {
                      const Icon = item.icon;
                      const isActive = location.pathname === item.path && !("section" in item);
                      return (
                        <SheetClose asChild key={item.label}>
                          <Link to={"to" in item && item.to ? item.to : item.path} className="block">
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
