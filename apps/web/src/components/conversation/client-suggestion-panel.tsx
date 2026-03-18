"use client";

import { useState } from "react";
import {
  User,
  UserPlus,
  Check,
  Phone,
  Mail,
  Loader2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

export interface MatchedIdentifier {
  type: "name" | "phone" | "email";
  extractedValue: string;
  matchedValue: string;
  similarity: number;
}

export interface ClientSuggestion {
  clientId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  overallConfidence: number;
  matchedIdentifiers: MatchedIdentifier[];
}

export interface ExtractedPII {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  dob?: string;
  address?: string;
}

interface ClientSuggestionPanelProps {
  conversationId: string;
  suggestions?: ClientSuggestion[];
  extractedPII?: ExtractedPII;
  isLoading?: boolean;
  error?: string | null;
  onSuggest?: () => Promise<void>;
  onSelect: (clientId: string) => void;
  onCreateNew: () => void;
  className?: string;
}

// ============================================
// HELPER COMPONENTS
// ============================================

const IDENTIFIER_ICONS: Record<MatchedIdentifier["type"], React.ReactNode> = {
  name: <User className="h-3 w-3" />,
  phone: <Phone className="h-3 w-3" />,
  email: <Mail className="h-3 w-3" />,
};

const IDENTIFIER_LABELS: Record<MatchedIdentifier["type"], string> = {
  name: "Name",
  phone: "Phone",
  email: "Email",
};

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const percent = Math.round(confidence * 100);
  const colorClass =
    percent >= 90
      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      : percent >= 75
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
        : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";

  return (
    <Badge variant="outline" className={cn("font-mono text-xs", colorClass)}>
      {percent}%
    </Badge>
  );
}

function IdentifierMatch({ identifier }: { identifier: MatchedIdentifier }) {
  const percent = Math.round(identifier.similarity * 100);

  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="flex items-center gap-1 text-muted-foreground w-16">
        {IDENTIFIER_ICONS[identifier.type]}
        <span>{IDENTIFIER_LABELS[identifier.type]}</span>
      </div>
      <div className="flex-1 flex items-center gap-2">
        <span className="text-green-600 dark:text-green-400" title="Matched">
          {identifier.matchedValue}
        </span>
        {percent < 100 && (
          <span className="text-muted-foreground">({percent}%)</span>
        )}
      </div>
    </div>
  );
}

function SuggestionCard({
  suggestion,
  onSelect,
}: {
  suggestion: ClientSuggestion;
  onSelect: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Client info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h4 className="font-medium truncate">
                  {suggestion.firstName} {suggestion.lastName}
                </h4>
                <p className="text-xs text-muted-foreground truncate">
                  {suggestion.phone}
                  {suggestion.email && ` • ${suggestion.email}`}
                </p>
              </div>
            </div>

            {/* Matched identifiers */}
            <div className="mt-3 space-y-1">
              {suggestion.matchedIdentifiers.map((identifier, idx) => (
                <IdentifierMatch key={idx} identifier={identifier} />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col items-end gap-2">
            <ConfidenceBadge confidence={suggestion.overallConfidence} />
            <Button size="sm" onClick={onSelect} className="gap-1">
              <Check className="h-3 w-3" />
              Select
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ExtractedPIIDisplay({ pii }: { pii: ExtractedPII }) {
  const fields = [
    { label: "Name", value: pii.fullName || [pii.firstName, pii.lastName].filter(Boolean).join(" ") },
    { label: "Phone", value: pii.phone },
    { label: "Email", value: pii.email },
    { label: "DOB", value: pii.dob },
    { label: "Address", value: pii.address },
  ].filter((f) => f.value);

  if (fields.length === 0) return null;

  return (
    <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Sparkles className="h-3 w-3" />
        Extracted from transcript
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {fields.map((field) => (
          <div key={field.label} className="text-xs">
            <span className="text-muted-foreground">{field.label}:</span>{" "}
            <span className="font-medium">{field.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ClientSuggestionPanel({
  conversationId,
  suggestions,
  extractedPII,
  isLoading = false,
  error = null,
  onSuggest,
  onSelect,
  onCreateNew,
  className,
}: ClientSuggestionPanelProps) {
  const hasSuggestions = suggestions && suggestions.length > 0;
  const hasExtractedPII = extractedPII && Object.keys(extractedPII).length > 0;
  const showInitialState = !isLoading && !error && !hasSuggestions && !hasExtractedPII;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="h-4 w-4" />
          Client Matching
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Initial state - prompt to run suggestion */}
        {showInitialState && onSuggest && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">
              Find matching clients based on the conversation transcript.
            </p>
            <Button onClick={onSuggest} variant="outline" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Suggest Clients
            </Button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-6 gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Analyzing transcript...
            </p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium">Failed to suggest clients</p>
              <p className="text-red-600 dark:text-red-300">{error}</p>
            </div>
          </div>
        )}

        {/* Extracted PII display */}
        {!isLoading && hasExtractedPII && (
          <ExtractedPIIDisplay pii={extractedPII} />
        )}

        {/* Suggestions list */}
        {!isLoading && hasSuggestions && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {suggestions.length} potential match{suggestions.length !== 1 ? "es" : ""} found
            </p>
            {suggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.clientId}
                suggestion={suggestion}
                onSelect={() => onSelect(suggestion.clientId)}
              />
            ))}
          </div>
        )}

        {/* No matches found */}
        {!isLoading && !error && hasExtractedPII && !hasSuggestions && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              No matching clients found above the confidence threshold.
            </p>
          </div>
        )}

        {/* Create new client option */}
        {!isLoading && (hasExtractedPII || hasSuggestions) && (
          <div className="pt-2 border-t">
            <Button
              variant="outline"
              onClick={onCreateNew}
              className="w-full gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Create New Client
            </Button>
          </div>
        )}

        {/* Re-analyze option */}
        {!isLoading && hasExtractedPII && onSuggest && (
          <div className="text-center">
            <button
              onClick={onSuggest}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Re-analyze transcript
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// HOOK FOR DATA FETCHING
// ============================================

export function useClientSuggestions(conversationId: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ClientSuggestion[]>();
  const [extractedPII, setExtractedPII] = useState<ExtractedPII>();

  const fetchSuggestions = async (minConfidence: number = 0.70) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/suggest-clients`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ minConfidence }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to fetch suggestions");
      }

      setSuggestions(data.suggestions);
      setExtractedPII(data.extractedPII);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    error,
    suggestions,
    extractedPII,
    fetchSuggestions,
  };
}
