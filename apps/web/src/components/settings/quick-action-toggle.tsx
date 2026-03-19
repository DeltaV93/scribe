"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Zap } from "lucide-react";
import { trackQuickActionEvent } from "@/lib/quick-actions/analytics";

interface QuickActionToggleProps {
  initialValue: boolean;
}

export function QuickActionToggle({ initialValue }: QuickActionToggleProps) {
  const [enabled, setEnabled] = useState(initialValue);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleToggle(checked: boolean) {
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/user/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ showQuickActionFab: checked }),
        });

        if (!response.ok) {
          throw new Error("Failed to update preference");
        }

        setEnabled(checked);
        trackQuickActionEvent("FAB_VISIBILITY_CHANGED", { visible: checked });
      } catch {
        setError("Failed to save preference. Please try again.");
        // Revert optimistic update
        setEnabled(!checked);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Quick Actions
        </CardTitle>
        <CardDescription>
          Control the floating action button that provides quick access to common tasks.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="quick-action-fab" className="text-base font-medium">
              Show Quick Actions Button
            </Label>
            <p className="text-sm text-muted-foreground">
              Display the floating + button in the bottom-right corner.
              {" "}
              <kbd className="rounded border border-muted-foreground/30 bg-muted px-1 py-0.5 font-mono text-xs">
                ⌘K
              </kbd>
              {" "}shortcut still works when hidden.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isPending && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            <Switch
              id="quick-action-fab"
              checked={enabled}
              onCheckedChange={handleToggle}
              disabled={isPending}
              aria-describedby="quick-action-fab-description"
            />
          </div>
        </div>
        {error && (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
