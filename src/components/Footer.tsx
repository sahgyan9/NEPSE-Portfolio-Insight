import { useState } from 'react';
import { ShieldCheck, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { STORAGE_KEYS } from '@/lib/constants';

interface FooterProps {
  apiKey?: string;
  onApiKeyChange?: (key: string) => void;
}

export const Footer = ({ apiKey, onApiKeyChange }: FooterProps) => {
  // Fall back to localStorage when the page doesn't pass props
  const effectiveApiKey = apiKey ?? (localStorage.getItem(STORAGE_KEYS.apiKey) || '');
  const [tempApiKey, setTempApiKey] = useState(effectiveApiKey);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleSaveApiKey = () => {
    if (onApiKeyChange) {
      onApiKeyChange(tempApiKey);
    } else {
      localStorage.setItem(STORAGE_KEYS.apiKey, tempApiKey);
    }
    setIsDialogOpen(false);
    toast({
      title: "API Key Saved",
      description: "Your Gemini API key has been saved.",
    });
  };

  return (
    <footer className="w-full border-t border-border/40 bg-background/30 py-8 mt-12 text-sm">
      <div className="container px-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 font-semibold text-foreground mb-1">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>NEPSE Portfolio Insight</span>
          </div>
          <p className="text-xs text-muted-foreground max-w-md">
            Value investing and portfolio health metrics inspired by Benjamin Graham's <em>The Intelligent Investor</em>.
            Disclaimer: This is not official financial advice. Always verify with official sources.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
          {/* Gemini API configuration */}
          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (open) setTempApiKey(effectiveApiKey);
            }}
          >
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "gap-2",
                  effectiveApiKey && "border-green-500/50 hover:bg-green-500/10 text-green-500 hover:text-green-600"
                )}
              >
                <Key className="h-4 w-4" />
                <span>{effectiveApiKey ? "API Active" : "Configure AI (optional)"}</span>
                {effectiveApiKey && <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>}
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
        </div>
      </div>
    </footer>
  );
};
