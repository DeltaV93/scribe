"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Choose how Inkra looks to you. Select a theme preference.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-24 animate-pulse bg-muted rounded-md" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Choose how Inkra looks to you. Select a theme preference.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={theme}
          onValueChange={setTheme}
          className="grid grid-cols-3 gap-4"
        >
          <div>
            <RadioGroupItem
              value="light"
              id="theme-light"
              className="peer sr-only"
            />
            <Label
              htmlFor="theme-light"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-paper-warm p-4 hover:bg-paper-dim hover:text-accent-foreground peer-data-[state=checked]:border-ink-blue-accent [&:has([data-state=checked])]:border-ink-blue-accent cursor-pointer"
            >
              <Sun className="mb-3 h-6 w-6" />
              <span className="text-sm font-medium">Light</span>
            </Label>
          </div>
          <div>
            <RadioGroupItem
              value="dark"
              id="theme-dark"
              className="peer sr-only"
            />
            <Label
              htmlFor="theme-dark"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-paper-warm p-4 hover:bg-paper-dim hover:text-accent-foreground peer-data-[state=checked]:border-ink-blue-accent [&:has([data-state=checked])]:border-ink-blue-accent cursor-pointer"
            >
              <Moon className="mb-3 h-6 w-6" />
              <span className="text-sm font-medium">Dark</span>
            </Label>
          </div>
          <div>
            <RadioGroupItem
              value="system"
              id="theme-system"
              className="peer sr-only"
            />
            <Label
              htmlFor="theme-system"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-paper-warm p-4 hover:bg-paper-dim hover:text-accent-foreground peer-data-[state=checked]:border-ink-blue-accent [&:has([data-state=checked])]:border-ink-blue-accent cursor-pointer"
            >
              <Monitor className="mb-3 h-6 w-6" />
              <span className="text-sm font-medium">System</span>
            </Label>
          </div>
        </RadioGroup>
        <p className="text-sm text-muted-foreground mt-4">
          {theme === "system"
            ? "Inkra will automatically match your device's appearance settings."
            : theme === "dark"
            ? "Dark theme is enabled. Easier on the eyes in low-light environments."
            : "Light theme is enabled. Best for well-lit environments."}
        </p>
      </CardContent>
    </Card>
  );
}
