/**
 * ErrorBoundary
 * =============
 * Catches unhandled React render errors (e.g. null.toFixed crash in chart)
 * and shows a friendly recovery card instead of a blank screen.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { translate } from '@/i18n';

interface State {
  hasError: boolean;
  error: Error | null;
}

interface Props {
  children: React.ReactNode;
  /** Optional label shown in the card, e.g. "Quarterly Chart" */
  label?: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught render error:', error, info.componentStack);
  }

  handleRefresh = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="flex flex-col items-center justify-center min-h-[260px] rounded-xl border border-destructive/40 bg-destructive/5 p-6 sm:p-8 gap-4 text-center">
          <AlertCircle className="w-10 h-10 text-destructive/70" aria-hidden="true" />
          <div>
            <p className="font-semibold text-destructive">
              {this.props.label ? translate('tools.errorTitleLabel', { label: this.props.label }) : translate('tools.errorTitle')}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground mt-1 max-w-sm">
              {translate('tools.errorBody')}
            </p>
          </div>
          <Button variant="outline" onClick={this.handleRefresh} className="min-h-[44px]">
            {translate('tools.errorRefresh')}
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
