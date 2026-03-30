"use client";

/**
 * Destination Selector Component (PX-1004)
 *
 * Multi-select dropdown for choosing which integrations to push outputs to.
 * Shows user's connected integrations and allows selecting multiple destinations.
 */

import { useState, useEffect } from "react";
import { Check, ChevronDown, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { IntegrationPlatform, WorkflowOutputType } from "@prisma/client";

// ============================================
// Types
// ============================================

export interface IntegrationDestination {
  platform: IntegrationPlatform;
  displayName: string;
  accountName?: string | null;
  iconUrl?: string | null;
  isConnected: boolean;
  supportsOutputType: boolean;
  defaultDestination?: {
    id: string;
    name: string;
  } | null;
}

interface DestinationSelectorProps {
  /** Available integrations the user can push to */
  destinations: IntegrationDestination[];
  /** Currently selected platforms */
  selected: IntegrationPlatform[];
  /** Called when selection changes */
  onSelectionChange: (platforms: IntegrationPlatform[]) => void;
  /** The output type being pushed (filters compatible integrations) */
  outputType?: WorkflowOutputType;
  /** Whether outputs can be pushed (false for RESTRICTED/REDACTED) */
  canPush?: boolean;
  /** Reason push is disabled */
  disabledReason?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Compact mode (single line) */
  compact?: boolean;
  className?: string;
}

// ============================================
// Platform Icons
// ============================================

const PLATFORM_ICONS: Record<IntegrationPlatform, React.ReactNode> = {
  NOTION: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.886l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
    </svg>
  ),
  LINEAR: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3.01 12.315a9 9 0 0 1 8.69-8.685v2.014a7 7 0 0 0-6.674 6.67zm0 .37a9 9 0 0 0 8.317 8.685v-2.013a7 7 0 0 1-6.305-6.672zm8.686 8.685a9 9 0 0 0 8.69-8.684h-2.014a7 7 0 0 1-6.676 6.67zm8.69-9.055a9 9 0 0 0-8.69-8.685v2.014a7 7 0 0 1 6.675 6.67zm-8.376-8.69A9 9 0 0 0 3.325 12h2.013a7 7 0 0 1 6.672-6.305zm0 17.75A9 9 0 0 0 20.695 12h-2.013a7 7 0 0 1-6.672 6.305z" />
    </svg>
  ),
  JIRA: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.005 1.005 0 0 0 23.013 0z" />
    </svg>
  ),
  SLACK: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
    </svg>
  ),
  GOOGLE_CALENDAR: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.316 5.684H24v12.632h-5.684V5.684zM5.684 24h12.632v-5.684H5.684V24zM18.316 5.684V0H5.684v5.684h12.632zM5.684 18.316H0V5.684h5.684v12.632zM5.684 5.684H0V0h5.684v5.684zM18.316 24H24v-5.684h-5.684V24z" />
    </svg>
  ),
  OUTLOOK_CALENDAR: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7.88 12.04q0 .45-.11.87-.1.41-.33.74-.22.33-.58.52-.37.2-.87.2t-.85-.2q-.35-.21-.57-.55-.22-.33-.33-.75-.1-.42-.1-.86t.1-.87q.1-.43.34-.76.22-.34.59-.54.36-.2.87-.2t.86.2q.35.21.57.55.22.34.31.77.1.43.1.88zM24 12v9.38q0 .46-.33.8-.33.32-.8.32H7.13q-.46 0-.8-.33-.32-.33-.32-.8V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h6.5V2.55q0-.44.3-.75.3-.3.75-.3h12.9q.44 0 .75.3.3.3.3.75V12z" />
    </svg>
  ),
  GOOGLE_DOCS: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14.727 6.727H14V0H4.91c-.906 0-1.637.732-1.637 1.636v20.728c0 .904.731 1.636 1.636 1.636h14.182c.904 0 1.636-.732 1.636-1.636V6.727h-6zm-.545 10.455H7.09v-1.364h7.09v1.364zm2.727-2.727H7.091v-1.364h9.818v1.364zm0-2.728H7.091V10.364h9.818v1.363zM14.727 6h6l-6-6v6z" />
    </svg>
  ),
};

// ============================================
// Main Component
// ============================================

export function DestinationSelector({
  destinations,
  selected,
  onSelectionChange,
  canPush = true,
  disabledReason,
  isLoading = false,
  compact = false,
  className,
}: DestinationSelectorProps) {
  const [open, setOpen] = useState(false);

  // Filter to only compatible and connected integrations
  const availableDestinations = destinations.filter(
    (d) => d.isConnected && d.supportsOutputType
  );
  const unavailableDestinations = destinations.filter(
    (d) => !d.isConnected || !d.supportsOutputType
  );

  const toggleDestination = (platform: IntegrationPlatform) => {
    if (selected.includes(platform)) {
      onSelectionChange(selected.filter((p) => p !== platform));
    } else {
      onSelectionChange([...selected, platform]);
    }
  };

  const selectAll = () => {
    onSelectionChange(availableDestinations.map((d) => d.platform));
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  // Cannot push - show disabled state
  if (!canPush) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <AlertCircle className="h-4 w-4 text-amber-500" />
        <span>{disabledReason || "Cannot push to external integrations"}</span>
      </div>
    );
  }

  // No available destinations
  if (availableDestinations.length === 0) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <AlertCircle className="h-4 w-4" />
        <span>No integrations available for this output type</span>
      </div>
    );
  }

  // Selected destinations display
  const selectedDestinations = destinations.filter((d) => selected.includes(d.platform));

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "justify-between",
              compact ? "h-8 text-xs" : "h-9"
            )}
            disabled={isLoading}
          >
            <span className="flex items-center gap-2 truncate">
              {selected.length === 0 ? (
                "Select destinations..."
              ) : selected.length === 1 ? (
                <>
                  {PLATFORM_ICONS[selected[0]] || null}
                  <span>{selectedDestinations[0]?.displayName || selected[0]}</span>
                </>
              ) : (
                `${selected.length} destinations selected`
              )}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <div className="p-2">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Select destinations
            </p>

            {/* Available destinations */}
            <div className="space-y-2">
              {availableDestinations.map((dest) => (
                <div
                  key={dest.platform}
                  className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                  onClick={() => toggleDestination(dest.platform)}
                >
                  <Checkbox
                    checked={selected.includes(dest.platform)}
                    onCheckedChange={() => toggleDestination(dest.platform)}
                    id={`dest-${dest.platform}`}
                  />
                  <div className="flex items-center gap-2 flex-1">
                    {PLATFORM_ICONS[dest.platform]}
                    <Label
                      htmlFor={`dest-${dest.platform}`}
                      className="cursor-pointer flex-1"
                    >
                      {dest.displayName}
                    </Label>
                  </div>
                  {dest.accountName && (
                    <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                      {dest.accountName}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Unavailable destinations */}
            {unavailableDestinations.length > 0 && (
              <>
                <Separator className="my-2" />
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Unavailable
                </p>
                <div className="space-y-2">
                  {unavailableDestinations.map((dest) => (
                    <div
                      key={dest.platform}
                      className="flex items-center gap-2 p-2 rounded-md opacity-50"
                    >
                      <Checkbox disabled checked={false} />
                      <div className="flex items-center gap-2 flex-1">
                        {PLATFORM_ICONS[dest.platform]}
                        <span className="text-sm">{dest.displayName}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {!dest.isConnected
                          ? "Not connected"
                          : "Incompatible"}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Quick actions */}
            {availableDestinations.length > 1 && (
              <>
                <Separator className="my-2" />
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={selectAll}
                  >
                    Select all
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={clearAll}
                    disabled={selected.length === 0}
                  >
                    Clear
                  </Button>
                </div>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Show selected destinations as badges (non-compact mode) */}
      {!compact && selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedDestinations.map((dest) => (
            <Badge
              key={dest.platform}
              variant="secondary"
              className="flex items-center gap-1 pl-1.5"
            >
              {PLATFORM_ICONS[dest.platform]}
              <span>{dest.displayName}</span>
              {dest.defaultDestination && (
                <span className="text-xs opacity-70">
                  → {dest.defaultDestination.name}
                </span>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// Hook for fetching available destinations
// ============================================

export function useAvailableDestinations(outputType?: WorkflowOutputType) {
  const [destinations, setDestinations] = useState<IntegrationDestination[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDestinations() {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (outputType) {
          params.set("outputType", outputType);
        }

        const response = await fetch(`/api/integrations/destinations?${params}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.message || "Failed to fetch destinations");
        }

        setDestinations(data.destinations || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    }

    fetchDestinations();
  }, [outputType]);

  return { destinations, isLoading, error };
}
