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
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Plus, X, Sliders, Ban } from "lucide-react";

interface MatchingRulesProps {
  rules: {
    overrides: Record<string, unknown>[];
    weights: Record<string, number>;
    disabled_rules: string[];
  };
  onChange: (rules: MatchingRulesProps["rules"]) => void;
}

// Common matching rules that can be disabled
const AVAILABLE_RULES = [
  { id: "keyword_exact_match", name: "Keyword Exact Match", description: "Match keywords exactly" },
  { id: "keyword_fuzzy_match", name: "Keyword Fuzzy Match", description: "Match similar keywords" },
  { id: "pattern_detection", name: "Pattern Detection", description: "Detect regex patterns" },
  { id: "context_analysis", name: "Context Analysis", description: "Analyze surrounding context" },
  { id: "entity_extraction", name: "Entity Extraction", description: "Extract named entities" },
  { id: "sentiment_scoring", name: "Sentiment Scoring", description: "Score sentiment of content" },
];

export function MatchingRulesEditor({ rules, onChange }: MatchingRulesProps) {
  const [newWeightRule, setNewWeightRule] = useState("");
  const [newWeightValue, setNewWeightValue] = useState("1.0");

  const toggleRule = (ruleId: string) => {
    const isDisabled = rules.disabled_rules.includes(ruleId);
    onChange({
      ...rules,
      disabled_rules: isDisabled
        ? rules.disabled_rules.filter((r) => r !== ruleId)
        : [...rules.disabled_rules, ruleId],
    });
  };

  const addWeight = () => {
    const rule = newWeightRule.trim();
    const weight = parseFloat(newWeightValue);
    if (rule && !isNaN(weight) && weight > 0) {
      onChange({
        ...rules,
        weights: { ...rules.weights, [rule]: weight },
      });
      setNewWeightRule("");
      setNewWeightValue("1.0");
    }
  };

  const removeWeight = (rule: string) => {
    onChange({
      ...rules,
      weights: Object.fromEntries(
        Object.entries(rules.weights).filter(([k]) => k !== rule)
      ),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Form Matching Rules</CardTitle>
        <CardDescription>
          Configure how conversations are matched to forms
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" defaultValue={["rules"]} className="space-y-2">
          {/* Enable/Disable Rules */}
          <AccordionItem value="rules" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Ban className="h-4 w-4" />
                <span>Rule Configuration</span>
                <Badge variant="secondary" className="ml-2">
                  {AVAILABLE_RULES.length - rules.disabled_rules.length} active
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4">
              <p className="text-sm text-muted-foreground">
                Enable or disable matching rules. Disabled rules won't be used when
                matching conversations to forms.
              </p>

              <div className="space-y-3">
                {AVAILABLE_RULES.map((rule) => {
                  const isEnabled = !rules.disabled_rules.includes(rule.id);
                  return (
                    <div
                      key={rule.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="space-y-0.5">
                        <Label
                          htmlFor={`rule-${rule.id}`}
                          className="cursor-pointer font-medium"
                        >
                          {rule.name}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {rule.description}
                        </p>
                      </div>
                      <Switch
                        id={`rule-${rule.id}`}
                        checked={isEnabled}
                        onCheckedChange={() => toggleRule(rule.id)}
                      />
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Rule Weights */}
          <AccordionItem value="weights" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4" />
                <span>Rule Weights</span>
                <Badge variant="secondary" className="ml-2">
                  {Object.keys(rules.weights).length}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4">
              <p className="text-sm text-muted-foreground">
                Adjust the importance of specific matching rules. Higher weights
                increase influence on form matching decisions.
              </p>

              <div className="space-y-2">
                {Object.entries(rules.weights).map(([rule, weight]) => (
                  <div
                    key={rule}
                    className="flex items-center gap-2 p-2 bg-muted rounded"
                  >
                    <span className="flex-1">{rule}</span>
                    <Badge variant="outline">{weight.toFixed(1)}x</Badge>
                    <button
                      onClick={() => removeWeight(rule)}
                      className="hover:bg-background rounded p-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Rule name"
                  value={newWeightRule}
                  onChange={(e) => setNewWeightRule(e.target.value)}
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
