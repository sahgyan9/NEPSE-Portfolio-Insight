// src/components/PortfolioImportZone.tsx
// Drag-and-drop CSV upload that imports a Meroshare portfolio (WACC Report or
// My Purchase Source export) into the local database in one step.

import { useState, useRef, useCallback } from 'react';
import { Upload, CheckCircle2, XCircle, Loader2, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { importHoldingsCsv, ImportCsvResult } from '@/services/portfolioDb';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

interface PortfolioImportZoneProps {
  /** Called after a successful import so the parent can refresh portfolio data. */
  onImported?: (result: ImportCsvResult) => void;
  /** "replace" (default) treats the CSV as the full portfolio; "merge" keeps untouched holdings. */
  mode?: 'replace' | 'merge';
  /** Show the "how to get the file" steps under the box. Off when the page already shows them. */
  showHelp?: boolean;
}

type ImportState =
  | { phase: 'idle' }
  | { phase: 'dragging' }
  | { phase: 'parsing'; filename: string }
  | { phase: 'success'; result: ImportCsvResult }
  | { phase: 'error'; message: string };

export const PortfolioImportZone = ({ onImported, mode = 'replace', showHelp = true }: PortfolioImportZoneProps) => {
  const { t } = useT();
  const [state, setState] = useState<ImportState>({ phase: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setState({ phase: 'error', message: t('home.importNotCsv') });
      return;
    }

    setState({ phase: 'parsing', filename: file.name });

    try {
      const text = await file.text();
      const result = await importHoldingsCsv(text, mode);
      setState({ phase: 'success', result });
      onImported?.(result);
    } catch (err) {
      // Server messages are English and technical; map the known ones to plain text.
      const raw = err instanceof Error ? err.message : '';
      const message = raw.includes('Failed to fetch')
        ? t('home.importNoServer')
        : raw.toLowerCase().includes('column') || raw.toLowerCase().includes('wacc')
          ? t('home.importWrongFile')
          : t('home.importUnknown');
      setState({ phase: 'error', message });
    }
  }, [mode, onImported, t]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const reset = () => setState({ phase: 'idle' });

  const isIdle = state.phase === 'idle';
  const isDragging = state.phase === 'dragging';
  const isParsing = state.phase === 'parsing';
  const openPicker = () => (isIdle || isDragging) && fileInputRef.current?.click();

  return (
    <div className="w-full">
      <div
        role={isIdle || isDragging ? 'button' : undefined}
        tabIndex={isIdle || isDragging ? 0 : undefined}
        aria-label={isIdle || isDragging ? t('home.importChoose') : undefined}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); } }}
        onDragOver={(e) => { e.preventDefault(); if (isIdle || isDragging) setState({ phase: 'dragging' }); }}
        onDragLeave={() => isDragging && setState({ phase: 'idle' })}
        onDrop={handleDrop}
        onClick={openPicker}
        className={cn(
          'relative flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 transition-colors sm:p-8',
          isDragging && 'border-primary bg-primary/10',
          isIdle && 'border-border hover:border-primary/60 hover:bg-primary/5',
          isParsing && 'cursor-wait border-primary/50 bg-primary/5',
          state.phase === 'success' && 'cursor-default border-success/50 bg-success/5',
          state.phase === 'error' && 'cursor-default border-destructive/50 bg-destructive/5',
        )}
      >
        {(isIdle || isDragging) && (
          <>
            <div className={cn('rounded-full p-4 transition-colors', isDragging ? 'bg-primary/20' : 'bg-muted')}>
              <Upload className={cn('h-8 w-8', isDragging ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">
                {isDragging ? t('home.importDropNow') : t('home.importDrop')}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="text-primary underline underline-offset-2">{t('home.importBrowse')}</span>
              </p>
              <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
                {t('home.importAuto')}
              </p>
            </div>
          </>
        )}

        {isParsing && (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden="true" />
            <div className="text-center">
              <p className="font-semibold">{t('home.importing')}</p>
              <p className="mt-1 max-w-xs truncate text-sm text-muted-foreground">{state.filename}</p>
            </div>
          </>
        )}

        {state.phase === 'success' && (
          <>
            <CheckCircle2 className="h-10 w-10 text-success" aria-hidden="true" />
            <div className="text-center">
              <p className="font-semibold text-success">
                {t('home.importDone', { count: state.result.imported })}
              </p>
              {state.result.skipped > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('home.importSkipped', { count: state.result.skipped })}
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">{t('home.importReady')}</p>
            </div>
            <Button variant="outline" onClick={reset} className="mt-2 h-11 sm:h-9">
              {t('home.importAnother')}
            </Button>
          </>
        )}

        {state.phase === 'error' && (
          <>
            <XCircle className="h-10 w-10 text-destructive" aria-hidden="true" />
            <div className="text-center">
              <p className="font-semibold text-destructive">{t('home.importFailed')}</p>
              <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted-foreground">{state.message}</p>
            </div>
            <Button variant="outline" onClick={reset} className="mt-2 h-11 sm:h-9">
              {t('home.importTryAgain')}
            </Button>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {showHelp && (
        <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <FileSpreadsheet className="h-4 w-4 text-primary" aria-hidden="true" />
            {t('home.importHelpTitle')}
          </div>
          <ol className="list-inside list-decimal space-y-1.5 text-sm leading-relaxed text-muted-foreground">
            <li>{t('home.emptyStep1')}</li>
            <li>{t('home.emptyStep2')}</li>
            <li>{t('home.emptyStep3')}</li>
          </ol>
        </div>
      )}
    </div>
  );
};
