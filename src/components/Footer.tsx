import { useState } from 'react';
import { ShieldCheck, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { STORAGE_KEYS } from '@/lib/constants';
import { useT } from '@/i18n';

interface FooterProps {
  apiKey?: string;
  onApiKeyChange?: (key: string) => void;
}

export const Footer = ({ apiKey, onApiKeyChange }: FooterProps) => {
  const { t } = useT();
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
      title: t("nav.aiSavedTitle"),
      description: t("nav.aiSavedBody"),
    });
  };

  return (
    <footer className="w-full border-t border-border/40 bg-background/30 py-8 mt-12 text-sm">
      <div className="container px-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 font-semibold text-foreground mb-1">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>{t('common.appName')}</span>
          </div>
          <div className="max-w-md space-y-1 text-xs leading-relaxed text-muted-foreground">
            <p>{t('nav.footerAbout')}</p>
            <p>
              {t('common.notAdvice')} {t('nav.footerVerify')}
            </p>
          </div>
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
                  "min-h-[44px] gap-2 lg:min-h-0",
                  effectiveApiKey && "border-success/50 text-success hover:bg-success/10 hover:text-success"
                )}
              >
                <Key className="h-4 w-4" />
                <span>{effectiveApiKey ? t('nav.aiActive') : t('nav.aiConfigure')}</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-card border-border">
              <DialogHeader>
                <DialogTitle>{t('nav.aiDialogTitle')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="apiKey">{t('nav.aiKeyLabel')}</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder={t('nav.aiKeyPlaceholder')}
                    value={tempApiKey}
                    onChange={(e) => setTempApiKey(e.target.value)}
                  />
                  <p className="text-xs leading-relaxed text-muted-foreground">{t('nav.aiKeyHelp')}</p>
                </div>
                <Button onClick={handleSaveApiKey} className="w-full">
                  {t('nav.aiSave')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </footer>
  );
};
