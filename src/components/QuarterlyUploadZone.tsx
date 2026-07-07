// src/components/QuarterlyUploadZone.tsx
// Drag-and-drop PDF upload with status feedback, duplicate warning, and unknown-company dialog

import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, CheckCircle2, AlertTriangle, XCircle, Loader2, X, HelpCircle } from 'lucide-react';
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
  const [state, setState] = useState<UploadState>({ phase: 'idle' });
  const [confirmSymbol, setConfirmSymbol] = useState('');
  const [confirmSector, setConfirmSector] = useState('hydro');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File, opts?: { overrideSymbol?: string; overrideSector?: string }) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setState({ phase: 'error', message: 'Only PDF files are accepted.' });
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
        setState({ phase: 'error', message: (response as { error: string }).error || 'Unknown error.' });
      }
    } catch (err) {
      setState({ phase: 'error', message: 'Could not connect to the server. Is nepse_server.py running?' });
    }
  }, [onUploadSuccess]);

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
          relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 cursor-pointer
          flex flex-col items-center justify-center gap-3 min-h-[160px]
          ${isDragging ? 'border-primary bg-primary/10 scale-[1.01]' : ''}
          ${isIdle ? 'border-border hover:border-primary/60 hover:bg-primary/5' : ''}
          ${isParsing ? 'border-blue-500/50 bg-blue-500/5 cursor-wait' : ''}
          ${state.phase === 'success' ? 'border-green-500/50 bg-green-500/5 cursor-default' : ''}
          ${state.phase === 'duplicate' ? 'border-yellow-500/50 bg-yellow-500/5 cursor-default' : ''}
          ${state.phase === 'error' ? 'border-red-500/50 bg-red-500/5 cursor-default' : ''}
        `}
      >
        {/* Idle / Dragging */}
        {(isIdle || isDragging) && (
          <>
            <div className={`p-4 rounded-full ${isDragging ? 'bg-primary/20' : 'bg-muted'} transition-colors`}>
              <Upload className={`w-8 h-8 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">
                {isDragging ? 'Drop the PDF here' : 'Drop quarterly report PDF'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                or <span className="text-primary underline underline-offset-2">browse files</span>
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Any filename works — company, year &amp; quarter auto-detected from PDF content
              </p>
            </div>
          </>
        )}

        {/* Parsing */}
        {isParsing && (
          <>
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            <div className="text-center">
              <p className="font-semibold">Parsing PDF…</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs truncate">{(state as { filename: string }).filename}</p>
              <p className="text-xs text-muted-foreground mt-1">Detecting company, quarter &amp; extracting financials</p>
            </div>
          </>
        )}

        {/* Success */}
        {state.phase === 'success' && (
          <>
            <CheckCircle2 className="w-10 h-10 text-green-500" />
            <div className="text-center">
              <p className="font-semibold text-green-600">Saved successfully!</p>
              <p className="text-sm font-mono font-bold mt-1">
                {state.result.symbol} – {state.result.quarter_label}
              </p>
              <p className="text-xs text-muted-foreground">{state.result.company_name}</p>
            </div>
            <Button size="sm" variant="outline" onClick={reset} className="mt-2">
              Upload another
            </Button>
          </>
        )}

        {/* Duplicate */}
        {state.phase === 'duplicate' && (
          <>
            <AlertTriangle className="w-10 h-10 text-yellow-500" />
            <div className="text-center">
              <p className="font-semibold text-yellow-600">Already exists</p>
              <p className="text-sm mt-1">
                <span className="font-mono font-bold">{state.symbol}</span> – {state.quarter_label}
              </p>
              <p className="text-xs text-muted-foreground mt-1">This quarter is already in the database.</p>
            </div>
            <Button size="sm" variant="outline" onClick={reset} className="mt-2">
              OK
            </Button>
          </>
        )}

        {/* Error */}
        {state.phase === 'error' && (
          <>
            <XCircle className="w-10 h-10 text-red-500" />
            <div className="text-center">
              <p className="font-semibold text-red-600">Error</p>
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
              <HelpCircle className="w-5 h-5 text-yellow-500" />
              Company Not Recognized
            </DialogTitle>
          </DialogHeader>

          {state.phase === 'needs_confirmation' && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                <p><span className="text-muted-foreground">Detected name:</span> <span className="font-medium">{state.partialResult.detected_company_name}</span></p>
                <p><span className="text-muted-foreground">FY:</span> <span className="font-mono">{state.partialResult.detected_fy}</span></p>
                <p><span className="text-muted-foreground">Quarter:</span> <span className="font-mono">Q{state.partialResult.detected_quarter}</span></p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-symbol">NEPSE Symbol <span className="text-red-500">*</span></Label>
                <Input
                  id="confirm-symbol"
                  placeholder="e.g. SAHAS, UPPER, CHCL"
                  value={confirmSymbol}
                  onChange={(e) => setConfirmSymbol(e.target.value.toUpperCase())}
                  className="font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label>Sector</Label>
                <Select value={confirmSector} onValueChange={setConfirmSector}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hydro">Hydro Power</SelectItem>
                    <SelectItem value="bank">Commercial Bank</SelectItem>
                    <SelectItem value="microfinance">Microfinance</SelectItem>
                    <SelectItem value="manufacturing">Manufacturing</SelectItem>
                    <SelectItem value="insurance">Insurance</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  This symbol will be added automatically for future PDFs.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  className="flex-1"
                  disabled={!confirmSymbol.trim()}
                  onClick={handleConfirmSubmit}
                >
                  Save as {confirmSymbol || '…'}
                </Button>
                <Button variant="outline" onClick={reset}>
                  <X className="w-4 h-4" />
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
          <Badge variant="outline" className="text-xs text-muted-foreground">+ any hydro PDF</Badge>
        </div>
      )}
    </div>
  );
};
