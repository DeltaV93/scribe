"use client";

import { AlertTriangle, Lock, RefreshCw, X, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDistanceToNow } from "date-fns";

interface LockBannerProps {
  /** Name of the user holding the lock */
  lockedByName: string;
  /** When the lock expires */
  expiresAt?: Date;
  /** Callback to retry acquiring the lock */
  onRetry?: () => void;
  /** Callback to dismiss the banner (view in read-only mode) */
  onDismiss?: () => void;
  /** Whether retry is in progress */
  isRetrying?: boolean;
  /** Resource type for display */
  resourceType?: string;
}

export function LockBanner({
  lockedByName,
  expiresAt,
  onRetry,
  onDismiss,
  isRetrying = false,
  resourceType = "resource",
}: LockBannerProps) {
  const expiresIn = expiresAt
    ? formatDistanceToNow(expiresAt, { addSuffix: true })
    : null;

  return (
    <Alert variant="destructive" className="mb-4 border-amber-500 bg-amber-50 text-amber-900">
      <Lock className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        <span>This {resourceType} is currently being edited</span>
      </AlertTitle>
      <AlertDescription className="mt-2">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4" />
            <span className="font-medium">{lockedByName}</span>
            <span className="text-amber-700">is currently editing this {resourceType}.</span>
          </div>

          {expiresIn && (
            <div className="text-sm text-amber-700">
              The lock expires {expiresIn}. You can wait or try again later.
            </div>
          )}

          <div className="flex items-center gap-2 mt-1">
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                disabled={isRetrying}
                className="bg-white hover:bg-amber-100 border-amber-300"
              >
                {isRetrying ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Try Again
              </Button>
            )}
            {onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                className="text-amber-700 hover:text-amber-900 hover:bg-amber-100"
              >
                View in Read-Only Mode
              </Button>
            )}
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}

interface LockAcquiredBannerProps {
  /** When the lock expires */
  expiresAt?: Date;
  /** Resource type for display */
  resourceType?: string;
}

export function LockAcquiredBanner({
  expiresAt,
  resourceType = "resource",
}: LockAcquiredBannerProps) {
  const expiresIn = expiresAt
    ? formatDistanceToNow(expiresAt, { addSuffix: true })
    : null;

  return (
    <Alert className="mb-4 border-green-500 bg-green-50 text-green-900">
      <Lock className="h-4 w-4" />
      <AlertTitle>Editing {resourceType}</AlertTitle>
      <AlertDescription className="text-sm text-green-700">
        You have exclusive editing access.
        {expiresIn && ` Lock expires ${expiresIn}.`}
      </AlertDescription>
    </Alert>
  );
}

interface ReadOnlyBannerProps {
  /** Callback to try acquiring the lock */
  onTryEdit?: () => void;
  /** Whether trying to acquire lock */
  isTrying?: boolean;
  /** Resource type for display */
  resourceType?: string;
}

export function ReadOnlyBanner({
  onTryEdit,
  isTrying = false,
  resourceType = "resource",
}: ReadOnlyBannerProps) {
  return (
    <Alert className="mb-4 border-blue-500 bg-blue-50 text-blue-900">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Read-Only Mode</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span className="text-sm text-blue-700">
          You are viewing this {resourceType} in read-only mode. Changes will not be saved.
        </span>
        {onTryEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={onTryEdit}
            disabled={isTrying}
            className="ml-4 bg-white hover:bg-blue-100 border-blue-300"
          >
            {isTrying ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Lock className="h-4 w-4 mr-2" />
            )}
            Try to Edit
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
