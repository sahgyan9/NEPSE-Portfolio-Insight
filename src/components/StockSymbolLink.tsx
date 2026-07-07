/**
 * Stock Symbol Link Component
 * ===========================
 * 
 * A reusable component that renders a stock symbol as a clickable link
 * to an external research website (configured in constants.ts).
 * 
 * To change the external website, update EXTERNAL_LINKS in src/lib/constants.ts
 */

import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStockResearchUrl } from "@/lib/constants";

interface StockSymbolLinkProps {
    symbol: string;
    className?: string;
    showIcon?: boolean;
    iconSize?: number;
}

/**
 * Renders a stock symbol as a clickable external link
 * @param symbol - The stock symbol to display and link to
 * @param className - Additional CSS classes for styling
 * @param showIcon - Whether to show the external link icon (default: true)
 * @param iconSize - Size of the external link icon in pixels (default: 12)
 */
export const StockSymbolLink = ({
    symbol,
    className,
    showIcon = true,
    iconSize = 12,
}: StockSymbolLinkProps) => {
    const url = getStockResearchUrl(symbol);

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
                "inline-flex items-center gap-1 hover:underline hover:opacity-80 transition-all",
                className
            )}
            title={`View ${symbol} on NepseAlpha`}
        >
            {symbol}
            {showIcon && (
                <ExternalLink
                    className="opacity-60 hover:opacity-100"
                    style={{ width: iconSize, height: iconSize }}
                />
            )}
        </a>
    );
};

export default StockSymbolLink;
