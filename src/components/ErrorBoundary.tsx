/**
 * ErrorBoundary
 * =============
 * Catches unhandled React render errors (e.g. null.toFixed crash in chart)
 * and shows a friendly recovery card instead of a blank screen.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

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

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[260px] rounded-xl border border-destructive/40 bg-destructive/5 p-8 gap-4 text-center">
          <AlertCircle className="w-10 h-10 text-destructive/70" />
          <div>
            <p className="font-semibold text-destructive">
              {this.props.label ? `${this.props.label} crashed` : 'Something went wrong'}
            </p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {this.state.error?.message ?? 'An unexpected error occurred while rendering this component.'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={this.handleReset}>
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
