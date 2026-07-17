// src/components/PortfolioImportZone.tsx
// Drag-and-drop CSV upload that imports a Meroshare portfolio (WACC Report or
// My Purchase Source export) into the local database in one step.

import { useState, useRef, useCallback } from 'react';
import { Upload, CheckCircle2, XCircle, Loader2, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { importHoldingsCsv, ImportCsvResult } from '@/services/portfolioDb';

interface PortfolioImportZoneProps {
  /** Called after a successful import so the parent can refresh portfolio data. */
  onImported?: (result: ImportCsvResult) => void;
  /** "replace" (default) treats the CSV as the full portfolio; "merge" keeps untouched holdings. */
  mode?: 'replace' | 'merge';
}

type ImportState =
  | { phase: 'idle' }
  | { phase: 'dragging' }
  | { phase: 'parsing'; filename: string }
  | { phase: 'success'; result: ImportCsvResult }
  | { phase: 'error'; message: string };

export const PortfolioImportZone = ({ onImported, mode = 'replace' }: PortfolioImportZoneProps) => {
  const [state, setState] = useState<ImportState>({ phase: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setState({ phase: 'error', message: 'Please upload a .csv file exported from Meroshare.' });
      return;
    }

    setState({ phase: 'parsing', filename: file.name });

    try {
      const text = await file.text();
      const result = await importHoldingsCsv(text, mode);
      setState({ phase: 'success', result });
      onImported?.(result);
    } catch (err) {
      const message =
        err instanceof Error && err.message.includes('Failed to fetch')
          ? 'Could not reach the database server. Make sure the app was started with its launcher.'
          : err instanceof Error
            ? err.message
            : 'Something went wrong while importing.';
      setState({ phase: 'error', message });
    }
  }, [mode, onImported]);

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

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => { e.preventDefault(); if (isIdle || isDragging) setState({ phase: 'dragging' }); }}
        onDragLeave={() => isDragging && setState({ phase: 'idle' })}
        onDrop={handleDrop}
        onClick={() => (isIdle || isDragging) && fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 cursor-pointer
          flex flex-col items-center justify-center gap-3 min-h-[180px]
          ${isDragging ? 'border-primary bg-primary/10 scale-[1.01]' : ''}
          ${isIdle ? 'border-border hover:border-primary/60 hover:bg-primary/5' : ''}
          ${isParsing ? 'border-blue-500/50 bg-blue-500/5 cursor-wait' : ''}
          ${state.phase === 'success' ? 'border-green-500/50 bg-green-500/5 cursor-default' : ''}
          ${state.phase === 'error' ? 'border-red-500/50 bg-red-500/5 cursor-default' : ''}
        `}
      >
        {(isIdle || isDragging) && (
          <>
            <div className={`p-4 rounded-full ${isDragging ? 'bg-primary/20' : 'bg-muted'} transition-colors`}>
              <Upload className={`w-8 h-8 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">
                {isDragging ? 'Drop your CSV here' : 'Drop your Meroshare portfolio CSV'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                or <span className="text-primary underline underline-offset-2">browse files</span>
              </p>
              <p className="text-xs text-muted-foreground mt-2 max-w-sm">
                Symbols, quantities &amp; cost are detected automatically.
              </p>
            </div>
          </>
        )}

        {isParsing && (
          <>
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            <div className="text-center">
              <p className="font-semibold">Importing…</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs truncate">{state.filename}</p>
            </div>
          </>
        )}

        {state.phase === 'success' && (
          <>
            <CheckCircle2 className="w-10 h-10 text-green-500" />
            <div className="text-center">
              <p className="font-semibold text-green-600">
                Imported {state.result.imported} holding{state.result.imported === 1 ? '' : 's'}
              </p>
              {state.result.skipped > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Skipped {state.result.skipped} with zero balance
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Your dashboard is ready.</p>
            </div>
            <Button size="sm" variant="outline" onClick={reset} className="mt-2">
              Import another file
            </Button>
          </>
        )}

        {state.phase === 'error' && (
          <>
            <XCircle className="w-10 h-10 text-red-500" />
            <div className="text-center">
              <p className="font-semibold text-red-600">Import failed</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">{state.message}</p>
            </div>
            <Button size="sm" variant="outline" onClick={reset} className="mt-2">
              Try again
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

      {/* How to get the file — always visible so a first-time user knows exactly what to do */}
      <div className="mt-4 rounded-lg border border-border/60 bg-muted/20 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
          <FileSpreadsheet className="w-4 h-4 text-primary" />
          How to get your CSV from Meroshare
        </div>
        <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Log in to <span className="font-medium text-foreground">Meroshare</span>.</li>
          <li>Open <span className="font-medium text-foreground">My Purchase Source</span> (Portfolio).</li>
          <li>Click <span className="font-medium text-foreground">CSV</span> — on mobile, tap the <span className="font-medium text-foreground">⋮</span> menu, then <span className="font-medium text-foreground">CSV</span>.</li>
          <li>Drag the downloaded file into the box above.</li>
        </ol>
      </div>
    </div>
  );
};
