import {
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  CircleDot,
  OctagonAlert,
  TriangleAlert,
  PieChart,
  Gem,
  Coins,
  Scale,
  Building2,
  type LucideIcon,
} from "lucide-react";

/**
 * Maps the plain icon keys used in valuationScoring (health / valuation status, health pillars)
 * to lucide icons chosen at render time.
 */
const ICONS: Record<string, LucideIcon> = {
  excellent: CheckCircle2,
  good: CheckCircle2,
  fair: CircleDot,
  poor: TriangleAlert,
  overvalued: TriangleAlert,
  "highly-overvalued": OctagonAlert,
  critical: OctagonAlert,
  unknown: CircleDashed,
  diversification: PieChart,
  valuation: Gem,
  dividend: Coins,
  concentration: Scale,
  sector: Building2,
};

export const StatusIcon = ({ name, className }: { name: string; className?: string }) => {
  const Icon = ICONS[name] ?? CircleAlert;
  return <Icon className={className ?? "h-3.5 w-3.5"} aria-hidden="true" />;
};
