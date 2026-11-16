// src/components/QuarterlyUploadZone.tsx
// Drag-and-drop PDF upload with status feedback, duplicate warning, and unknown-company dialog

import { useState, useRef, useCallback } from 'react';
import { Upload, CheckCircle2, AlertTriangle, XCircle, Loader2, X, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useT } from '@/i18n';
import { uploadQuarterlyPdf } from '@/services/quarterlyApi';
import type { UploadResponse, UploadSuccessResponse, UploadNeedsConfirmationResponse } from '@/types/quarterly';

interface QuarterlyUploadZoneProps {
  onUploadSuccess: (result: UploadSuccessResponse) => void;
}

type UploadState =
  | { phase: 'idle' }
  | { phase: 'dragging' }
  | { phase: 'parsing'; filename: string }
  | { phase: 'success'; result: UploadSuccessResponse }
  | { phase: 'duplicate'; quarter_label: string; symbol: string }
  | { phase: 'needs_confirmation'; partialResult: UploadNeedsConfirmationResponse }
  | { phase: 'error'; message: string };

export const QuarterlyUploadZone = ({ onUploadSuccess }: QuarterlyUploadZoneProps) => {
  const { t } = useT();
  const [state, setState] = useState<UploadState>({ phase: 'idle' });
  const [confirmSymbol, setConfirmSymbol] = useState('');
  const [confirmSector, setConfirmSector] = useState('hydro');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File, opts?: { overrideSymbol?: string; overrideSector?: string }) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setState({ phase: 'error', message: t('quarterly.upOnlyPdf') });
      return;
    }

    setState({ phase: 'parsing', filename: file.name });

    try {
      const response: UploadResponse = await uploadQuarterlyPdf(file, opts);

      if (response.status === 'success') {
        setState({ phase: 'success', result: response as UploadSuccessResponse });
        onUploadSuccess(response as UploadSuccessResponse);
      } else if (response.status === 'duplicate') {
        setState({
          phase: 'duplicate',
          quarter_label: response.quarter_label,
          symbol: response.symbol,
        });
      } else if (response.status === 'needs_confirmation') {
        setPendingFile(file);
        setConfirmSymbol('');
        setState({ phase: 'needs_confirmation', partialResult: response as UploadNeedsConfirmationResponse });
      } else {
        setState({ phase: 'error', message: (response as { error: string }).error || t('quarterly.upUnknown') });
      }
    } catch (err) {
      setState({ phase: 'error', message: t('quarterly.upNoServer') });
    }
  }, [onUploadSuccess, t]);

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

  const handleConfirmSubmit = () => {
    if (!pendingFile || !confirmSymbol.trim()) return;
    processFile(pendingFile, {
      overrideSymbol: confirmSymbol.trim().toUpperCase(),
      overrideSector: confirmSector,
    });
    setState({ phase: 'parsing', filename: pendingFile.name });
  };

  const reset = () => {
    setState({ phase: 'idle' });
    setPendingFile(null);
  };

  // ── Zone appearance ────────────────────────────────────────────────────────
  const isIdle     = state.phase === 'idle';
  const isDragging = state.phase === 'dragging';
  const isParsing  = state.phase === 'parsing';

  return (
    <div className="w-full">
      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setState({ phase: 'dragging' }); }}
        onDragLeave={() => setState({ phase: 'idle' })}
        onDrop={handleDrop}
        onClick={() => (isIdle || isDragging) && fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-xl p-5 sm:p-8 transition-colors duration-200 cursor-pointer
          flex flex-col items-center justify-center gap-3 min-h-[160px]
          ${isDragging ? 'border-primary bg-primary/10' : ''}
          ${isIdle ? 'border-border hover:border-primary/60 hover:bg-primary/5' : ''}
          ${isParsing ? 'border-primary/50 bg-primary/5 cursor-wait' : ''}
          ${state.phase === 'success' ? 'border-success/50 bg-success/5 cursor-default' : ''}
          ${state.phase === 'duplicate' ? 'border-warning/50 bg-warning/5 cursor-default' : ''}
          ${state.phase === 'error' ? 'border-destructive/50 bg-destructive/5 cursor-default' : ''}
        `}
      >
        {/* Idle / Dragging */}
        {(isIdle || isDragging) && (
          <>
            <div className={`p-4 rounded-full ${isDragging ? 'bg-primary/20' : 'bg-muted'} transition-colors`}>
              <Upload className={`w-8 h-8 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} aria-hidden="true" />
            </div>
            <div className="text-center">
              <p className="font-semibold leading-relaxed text-foreground">
                {isDragging ? t('quarterly.upDropHere') : t('quarterly.upDrop')}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('quarterly.upOr')} <span className="text-primary underline underline-offset-2">{t('quarterly.upBrowse')}</span>
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground mt-2">
                {t('quarterly.upAnyName')}
              </p>
            </div>
          </>
        )}

        {/* Parsing */}
        {isParsing && (
          <>
            <Loader2 className="w-10 h-10 text-primary animate-spin" aria-hidden="true" />
            <div className="text-center" role="status">
              <p className="font-semibold">{t('quarterly.upParsing')}</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs truncate">{(state as { filename: string }).filename}</p>
              <p className="text-xs leading-relaxed text-muted-foreground mt-1">{t('quarterly.upParsingHelp')}</p>
            </div>
          </>
        )}

        {/* Success */}
        {state.phase === 'success' && (
          <>
            <CheckCircle2 className="w-10 h-10 text-success" aria-hidden="true" />
            <div className="text-center">
              <p className="font-semibold text-success">{t('quarterly.upSaved')}</p>
              <p className="text-sm font-mono font-bold mt-1">
                {state.result.symbol} - {state.result.quarter_label}
              </p>
              <p className="text-xs text-muted-foreground">{state.result.company_name}</p>
            </div>
            <Button size="sm" variant="outline" onClick={reset} className="mt-2 h-11 sm:h-9">
              {t('quarterly.upAnother')}
            </Button>
          </>
        )}

        {/* Duplicate */}
        {state.phase === 'duplicate' && (
          <>
            <AlertTriangle className="w-10 h-10 text-warning" aria-hidden="true" />
            <div className="text-center">
              <p className="font-semibold text-warning">{t('quarterly.upExists')}</p>
              <p className="text-sm mt-1">
                <span className="font-mono font-bold">{state.symbol}</span> - {state.quarter_label}
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground mt-1">{t('quarterly.upExistsHelp')}</p>
            </div>
            <Button size="sm" variant="outline" onClick={reset} className="mt-2 h-11 sm:h-9">
              {t('quarterly.upOk')}
            </Button>
          </>
        )}

        {/* Error */}
        {state.phase === 'error' && (
          <>
            <XCircle className="w-10 h-10 text-destructive" aria-hidden="true" />
            <div className="text-center" role="alert">
              <p className="font-semibold text-destructive">{t('quarterly.upError')}</p>
              <p className="text-sm leading-relaxed text-muted-foreground mt-1 max-w-xs">{state.message}</p>
            </div>
            <Button size="sm" variant="outline" onClick={reset} className="mt-2 h-11 sm:h-9">
              {t('quarterly.upTryAgain')}
            </Button>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* Unknown Company Confirmation Dialog */}
      <Dialog
        open={state.phase === 'needs_confirmation'}
        onOpenChange={(open) => { if (!open) reset(); }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-warning" aria-hidden="true" />
              {t('quarterly.upDialogTitle')}
            </DialogTitle>
          </DialogHeader>

          {state.phase === 'needs_confirmation' && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                <p><span className="text-muted-foreground">{t('quarterly.upDetectedName')}</span> <span className="font-medium">{state.partialResult.detected_company_name}</span></p>
                <p><span className="text-muted-foreground">{t('quarterly.upFy')}</span> <span className="font-mono">{state.partialResult.detected_fy}</span></p>
                <p><span className="text-muted-foreground">{t('quarterly.upQuarter')}</span> <span className="font-mono">Q{state.partialResult.detected_quarter}</span></p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-symbol">{t('quarterly.upSymbolLabel')} <span className="text-destructive">*</span></Label>
                <Input
                  id="confirm-symbol"
                  placeholder={t('quarterly.upSymbolPlaceholder')}
                  value={confirmSymbol}
                  onChange={(e) => setConfirmSymbol(e.target.value.toUpperCase())}
                  className="h-11 font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label>{t('quarterly.upSector')}</Label>
                <Select value={confirmSector} onValueChange={setConfirmSector}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hydro">{t('quarterly.upSecHydro')}</SelectItem>
                    <SelectItem value="bank">{t('quarterly.upSecBank')}</SelectItem>
                    <SelectItem value="microfinance">{t('quarterly.upSecMicrofinance')}</SelectItem>
                    <SelectItem value="manufacturing">{t('quarterly.upSecManufacturing')}</SelectItem>
                    <SelectItem value="insurance">{t('quarterly.upSecInsurance')}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t('quarterly.upSectorHelp')}
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  className="h-11 flex-1"
                  disabled={!confirmSymbol.trim()}
                  onClick={handleConfirmSubmit}
                >
                  {t('quarterly.upSaveAs', { symbol: confirmSymbol || '...' })}
                </Button>
                <Button variant="outline" className="h-11 w-11 p-0" onClick={reset} aria-label={t('quarterly.upCloseAria')}>
                  <X className="w-4 h-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Hints */}
      {(isIdle || isDragging) && (
        <div className="flex flex-wrap gap-2 mt-3">
          {['SAHAS', 'UPPER', 'CHCL', 'BHL', 'SGHC'].map(sym => (
            <Badge key={sym} variant="outline" className="text-xs font-mono text-muted-foreground">
              {sym}
            </Badge>
          ))}
          <Badge variant="outline" className="text-xs text-muted-foreground">{t('quarterly.upAnyHydro')}</Badge>
        </div>
      )}
    </div>
  );
};
