"use client";

/**
 * ML Error Boundary
 *
 * Error boundary component for ML-related components.
 * Provides user-friendly error display with retry functionality.
 */

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Props {
  children: ReactNode;
  /** Custom fallback component to render on error */
  fallback?: ReactNode;
  /** Callback when error occurs */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Callback when retry is clicked */
  onRetry?: () => void;
  /** Custom title for error card */
  title?: string;
  /** Custom description for error card */
  description?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class MLErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error for debugging
    console.error("[MLErrorBoundary] Caught error:", error);
    console.error("[MLErrorBoundary] Component stack:", errorInfo.componentStack);

    // Call optional error callback
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {this.props.title || "Something went wrong"}
            </CardTitle>
            <CardDescription>
              {this.props.description ||
                "An error occurred while loading this component. Please try again."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Show error message in development */}
            {process.env.NODE_ENV === "development" && this.state.error && (
              <div className="p-3 rounded-md bg-muted text-sm font-mono text-muted-foreground overflow-auto">
                <p className="font-semibold text-destructive mb-1">
                  {this.state.error.name}
                </p>
                <p>{this.state.error.message}</p>
              </div>
            )}

            <Button
              onClick={this.handleRetry}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook-style error boundary wrapper for functional components
 */
interface MLErrorBoundaryWrapperProps {
  children: ReactNode;
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function withMLErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, "children">
): React.FC<P> {
  return function WithMLErrorBoundary(props: P) {
    return (
      <MLErrorBoundary {...errorBoundaryProps}>
        <WrappedComponent {...props} />
      </MLErrorBoundary>
    );
  };
}
