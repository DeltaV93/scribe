"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Check,
  ChevronsUpDown,
  FileText,
  X,
  Loader2,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

export interface FormOption {
  id: string;
  name: string;
  type: string;
  fieldCount: number;
}

interface FormSelectorProps {
  selectedFormIds: string[];
  onFormsChange: (formIds: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function FormSelector({
  selectedFormIds,
  onFormsChange,
  disabled = false,
  placeholder = "Select forms...",
  className,
}: FormSelectorProps) {
  const [open, setOpen] = useState(false);
  const [forms, setForms] = useState<FormOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch published forms
  useEffect(() => {
    const fetchForms = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/forms?status=PUBLISHED&pageSize=100");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.message || "Failed to fetch forms");
        }

        // Map to FormOption
        const formOptions: FormOption[] = data.data.map((form: {
          id: string;
          name: string;
          type: string;
          _count?: { fields: number };
          fields?: unknown[];
        }) => ({
          id: form.id,
          name: form.name,
          type: form.type,
          fieldCount: form._count?.fields || form.fields?.length || 0,
        }));

        setForms(formOptions);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchForms();
  }, []);

  // Filter forms by search query
  const filteredForms = useMemo(() => {
    if (!searchQuery.trim()) return forms;
    const query = searchQuery.toLowerCase();
    return forms.filter(
      (form) =>
        form.name.toLowerCase().includes(query) ||
        form.type.toLowerCase().includes(query)
    );
  }, [forms, searchQuery]);

  // Toggle form selection
  const toggleForm = useCallback(
    (formId: string) => {
      const isSelected = selectedFormIds.includes(formId);
      if (isSelected) {
        onFormsChange(selectedFormIds.filter((id) => id !== formId));
      } else {
        onFormsChange([...selectedFormIds, formId]);
      }
    },
    [selectedFormIds, onFormsChange]
  );

  // Remove a selected form
  const removeForm = useCallback(
    (formId: string) => {
      onFormsChange(selectedFormIds.filter((id) => id !== formId));
    },
    [selectedFormIds, onFormsChange]
  );

  // Get selected form objects
  const selectedForms = forms.filter((f) => selectedFormIds.includes(f.id));

  return (
    <div className={cn("space-y-2", className)}>
      {/* Selected forms badges */}
      {selectedForms.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedForms.map((form) => (
            <Badge
              key={form.id}
              variant="secondary"
              className="gap-1 pr-1"
            >
              <FileText className="h-3 w-3" />
              {form.name}
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeForm(form.id);
                  }}
                  className="ml-1 rounded-sm hover:bg-muted p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {/* Dropdown selector */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || isLoading}
            className={cn(
              "w-full justify-between",
              !selectedFormIds.length && "text-muted-foreground"
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading forms...
              </>
            ) : selectedFormIds.length > 0 ? (
              `${selectedFormIds.length} form${selectedFormIds.length !== 1 ? "s" : ""} selected`
            ) : (
              placeholder
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search forms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <ScrollArea className="h-[300px]">
            {error ? (
              <div className="py-6 text-center text-sm text-destructive">
                {error}
              </div>
            ) : filteredForms.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {searchQuery ? "No forms match your search." : "No published forms found."}
              </div>
            ) : (
              <div className="p-2">
                {filteredForms.map((form) => {
                  const isSelected = selectedFormIds.includes(form.id);
                  return (
                    <button
                      key={form.id}
                      onClick={() => toggleForm(form.id)}
                      className={cn(
                        "flex items-center gap-2 w-full text-left p-2 rounded-md hover:bg-muted transition-colors",
                        isSelected && "bg-muted"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded-sm border flex-shrink-0",
                          isSelected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-muted-foreground/30"
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{form.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {form.type} • {form.fieldCount} field{form.fieldCount !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ============================================
// HOOK FOR FETCHING FORMS
// ============================================

export function useForms() {
  const [forms, setForms] = useState<FormOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchForms = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/forms?status=PUBLISHED&pageSize=100");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.message || "Failed to fetch forms");
        }

        const formOptions: FormOption[] = data.data.map((form: {
          id: string;
          name: string;
          type: string;
          _count?: { fields: number };
          fields?: unknown[];
        }) => ({
          id: form.id,
          name: form.name,
          type: form.type,
          fieldCount: form._count?.fields || form.fields?.length || 0,
        }));

        setForms(formOptions);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchForms();
  }, []);

  return { forms, isLoading, error };
}
