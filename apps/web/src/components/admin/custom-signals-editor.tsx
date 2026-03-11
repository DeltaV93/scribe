"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Plus, X, Hash, Regex, Scale } from "lucide-react";
import type { CustomSignals } from "@/lib/ml-services/types";

interface CustomSignalsEditorProps {
  signals: CustomSignals;
  onChange: (signals: CustomSignals) => void;
}

export function CustomSignalsEditor({ signals, onChange }: CustomSignalsEditorProps) {
  const [newKeyword, setNewKeyword] = useState("");
  const [newPattern, setNewPattern] = useState("");
  const [newWeightKeyword, setNewWeightKeyword] = useState("");
  const [newWeightValue, setNewWeightValue] = useState("1.0");

  const addKeyword = () => {
    const keyword = newKeyword.trim().toLowerCase();
    if (keyword && !signals.keywords.includes(keyword)) {
      onChange({
        ...signals,
        keywords: [...signals.keywords, keyword],
      });
      setNewKeyword("");
    }
  };

  const removeKeyword = (keyword: string) => {
    onChange({
      ...signals,
      keywords: signals.keywords.filter((k) => k !== keyword),
      // Also remove weight if exists
      weights: Object.fromEntries(
        Object.entries(signals.weights).filter(([k]) => k !== keyword)
      ),
    });
  };

  const addPattern = () => {
    const pattern = newPattern.trim();
    if (pattern && !signals.patterns.includes(pattern)) {
      // Validate regex
      try {
        new RegExp(pattern);
        onChange({
          ...signals,
          patterns: [...signals.patterns, pattern],
        });
        setNewPattern("");
      } catch {
        // Invalid regex, don't add
      }
    }
  };

  const removePattern = (pattern: string) => {
    onChange({
      ...signals,
      patterns: signals.patterns.filter((p) => p !== pattern),
    });
  };

  const addWeight = () => {
    const keyword = newWeightKeyword.trim().toLowerCase();
    const weight = parseFloat(newWeightValue);
    if (keyword && !isNaN(weight) && weight > 0) {
      onChange({
        ...signals,
        weights: { ...signals.weights, [keyword]: weight },
      });
      setNewWeightKeyword("");
      setNewWeightValue("1.0");
    }
  };

  const removeWeight = (keyword: string) => {
    onChange({
      ...signals,
      weights: Object.fromEntries(
        Object.entries(signals.weights).filter(([k]) => k !== keyword)
      ),
    });
  };

  const isValidRegex = (pattern: string): boolean => {
    try {
      new RegExp(pattern);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Custom Detection Signals</CardTitle>
        <CardDescription>
          Configure keywords, patterns, and weights for conversation analysis
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" defaultValue={["keywords"]} className="space-y-2">
          {/* Keywords Section */}
          <AccordionItem value="keywords" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4" />
                <span>Keywords</span>
                <Badge variant="secondary" className="ml-2">
                  {signals.keywords.length}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4">
              <p className="text-sm text-muted-foreground">
                Words and phrases to detect in conversations. Include relevant terms
                in multiple languages if needed.
              </p>

              <div className="flex flex-wrap gap-2">
                {signals.keywords.map((keyword) => (
                  <Badge key={keyword} variant="secondary" className="pr-1">
                    {keyword}
                    <button
                      onClick={() => removeKeyword(keyword)}
                      className="ml-1 hover:bg-muted rounded p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Add keyword..."
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addKeyword()}
                  className="max-w-xs"
                />
                <Button variant="outline" size="icon" onClick={addKeyword}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Patterns Section */}
          <AccordionItem value="patterns" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Regex className="h-4 w-4" />
                <span>Regex Patterns</span>
                <Badge variant="secondary" className="ml-2">
                  {signals.patterns.length}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4">
              <p className="text-sm text-muted-foreground">
                Regular expressions for detecting structured data like case numbers,
                MRNs, or IDs. Patterns are case-insensitive.
              </p>

              <div className="space-y-2">
                {signals.patterns.map((pattern) => (
                  <div
                    key={pattern}
                    className="flex items-center gap-2 p-2 bg-muted rounded font-mono text-sm"
                  >
                    <span className="flex-1 truncate">{pattern}</span>
                    <button
                      onClick={() => removePattern(pattern)}
                      className="hover:bg-background rounded p-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="case\s+#?\d+  (e.g., case #123)"
                  value={newPattern}
                  onChange={(e) => setNewPattern(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addPattern()}
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={addPattern}
                  disabled={!newPattern || !isValidRegex(newPattern)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {newPattern && !isValidRegex(newPattern) && (
                <p className="text-sm text-destructive">Invalid regex pattern</p>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Weights Section */}
          <AccordionItem value="weights" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4" />
                <span>Keyword Weights</span>
                <Badge variant="secondary" className="ml-2">
                  {Object.keys(signals.weights).length}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4">
              <p className="text-sm text-muted-foreground">
                Adjust the importance of specific keywords. Higher weights (e.g., 1.5)
                increase significance, lower weights (e.g., 0.5) decrease it.
              </p>

              <div className="space-y-2">
                {Object.entries(signals.weights).map(([keyword, weight]) => (
                  <div
                    key={keyword}
                    className="flex items-center gap-2 p-2 bg-muted rounded"
                  >
                    <span className="flex-1">{keyword}</span>
                    <Badge variant="outline">{weight.toFixed(1)}x</Badge>
                    <button
                      onClick={() => removeWeight(keyword)}
                      className="hover:bg-background rounded p-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Keyword"
                  value={newWeightKeyword}
                  onChange={(e) => setNewWeightKeyword(e.target.value)}
                  className="max-w-[200px]"
                />
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="5"
                  placeholder="Weight"
                  value={newWeightValue}
                  onChange={(e) => setNewWeightValue(e.target.value)}
                  className="w-24"
                />
                <Button variant="outline" size="icon" onClick={addWeight}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
