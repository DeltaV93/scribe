"use client";

/**
 * Field Mapper Component
 *
 * Map source columns from imported file to target Scrybe fields.
 */

import { useState, useMemo } from "react";
import { Wand2, Check, X, ChevronDown, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export interface FieldMapping {
  sourceColumn: string;
  targetField: string;
  confidence?: number;
  aiSuggested?: boolean;
}

export interface TargetField {
  value: string;
  label: string;
  required?: boolean;
  type?: string;
}

interface FieldMapperProps {
  columns: string[];
  sampleData: Record<string, unknown>[];
  mappings: FieldMapping[];
  targetFields: TargetField[];
  onMappingsChange: (mappings: FieldMapping[]) => void;
  className?: string;
}

export function FieldMapper({
  columns,
  sampleData,
  mappings,
  targetFields,
  onMappingsChange,
  className,
}: FieldMapperProps) {
  const [expandedColumns, setExpandedColumns] = useState<Set<string>>(new Set());

  // Group target fields by category
  const groupedTargetFields = useMemo(() => {
    const groups: Record<string, TargetField[]> = {};

    for (const field of targetFields) {
      const category = field.value.split(".")[0];
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(field);
    }

    return groups;
  }, [targetFields]);

  const getMappingForColumn = (column: string): FieldMapping | undefined => {
    return mappings.find((m) => m.sourceColumn === column);
  };

  const getTargetFieldLabel = (targetField: string): string => {
    const field = targetFields.find((f) => f.value === targetField);
    return field?.label || targetField;
  };

  const isFieldMapped = (targetField: string): boolean => {
    return mappings.some((m) => m.targetField === targetField);
  };

  const updateMapping = (column: string, targetField: string) => {
    const newMappings = mappings.filter((m) => m.sourceColumn !== column);

    if (targetField) {
      // Remove any existing mapping to this target field
      const filtered = newMappings.filter((m) => m.targetField !== targetField);
      filtered.push({
        sourceColumn: column,
        targetField,
        aiSuggested: false,
      });
      onMappingsChange(filtered);
    } else {
      onMappingsChange(newMappings);
    }
  };

  const clearMapping = (column: string) => {
    onMappingsChange(mappings.filter((m) => m.sourceColumn !== column));
  };

  const acceptSuggestion = (column: string) => {
    const mapping = getMappingForColumn(column);
    if (mapping) {
      onMappingsChange(
        mappings.map((m) =>
          m.sourceColumn === column ? { ...m, aiSuggested: false } : m
        )
      );
    }
  };

  const getSampleValue = (column: string): string => {
    if (sampleData.length === 0) return "";
    const value = sampleData[0][column];
    if (value === undefined || value === null) return "";
    const strValue = String(value);
    return strValue.length > 50 ? strValue.substring(0, 50) + "..." : strValue;
  };

  const toggleColumnExpand = (column: string) => {
    const newExpanded = new Set(expandedColumns);
    if (newExpanded.has(column)) {
      newExpanded.delete(column);
    } else {
      newExpanded.add(column);
    }
    setExpandedColumns(newExpanded);
  };

  const getConfidenceBadge = (confidence?: number) => {
    if (confidence === undefined) return null;

    const percentage = Math.round(confidence * 100);
    const color = confidence >= 0.8 ? "bg-green-100 text-green-700" :
                  confidence >= 0.5 ? "bg-yellow-100 text-yellow-700" :
                  "bg-red-100 text-red-700";

    return (
      <Badge variant="secondary" className={cn("text-xs", color)}>
        {percentage}% match
      </Badge>
    );
  };

  // Check which required fields are missing
  const missingRequiredFields = useMemo(() => {
    return targetFields
      .filter((f) => f.required && !isFieldMapped(f.value))
      .map((f) => f.label);
  }, [targetFields, mappings]);

  return (
    <TooltipProvider>
      <div className={cn("space-y-4", className)}>
        {/* Status Summary */}
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span className="font-medium">{mappings.length}</span>
              <span className="text-muted-foreground"> of {columns.length} columns mapped</span>
            </div>
            {mappings.filter((m) => m.aiSuggested).length > 0 && (
              <Badge variant="secondary" className="gap-1">
                <Wand2 className="h-3 w-3" />
                {mappings.filter((m) => m.aiSuggested).length} AI suggestions
              </Badge>
            )}
          </div>
          {missingRequiredFields.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-sm text-amber-600">
                  <Info className="h-4 w-4" />
                  {missingRequiredFields.length} required field(s) unmapped
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium mb-1">Missing required fields:</p>
                <ul className="text-sm">
                  {missingRequiredFields.map((field) => (
                    <li key={field}>- {field}</li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Mapping Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[250px]">Source Column</TableHead>
                <TableHead className="w-[200px]">Sample Value</TableHead>
                <TableHead>Map To</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {columns.map((column) => {
                const mapping = getMappingForColumn(column);
                const sampleValue = getSampleValue(column);
                const isExpanded = expandedColumns.has(column);

                return (
                  <Collapsible key={column} asChild open={isExpanded}>
                    <>
                      <TableRow className={cn(mapping?.aiSuggested && "bg-purple-50")}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{column}</span>
                            {mapping?.aiSuggested && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Wand2 className="h-3 w-3 text-purple-500" />
                                </TooltipTrigger>
                                <TooltipContent>AI-suggested mapping</TooltipContent>
                              </Tooltip>
                            )}
                            {mapping?.confidence && getConfidenceBadge(mapping.confidence)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <CollapsibleTrigger asChild>
                            <button
                              onClick={() => toggleColumnExpand(column)}
                              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground max-w-full"
                            >
                              <span className="truncate">{sampleValue || <em>empty</em>}</span>
                              {sampleData.length > 1 && (
                                <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", isExpanded && "rotate-180")} />
                              )}
                            </button>
                          </CollapsibleTrigger>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={mapping?.targetField || ""}
                            onValueChange={(value) => updateMapping(column, value)}
                          >
                            <SelectTrigger className="w-[250px]">
                              <SelectValue placeholder="Select target field..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">-- Skip this column --</SelectItem>
                              {Object.entries(groupedTargetFields).map(([category, fields]) => (
                                <div key={category}>
                                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
                                    {category}
                                  </div>
                                  {fields.map((field) => (
                                    <SelectItem
                                      key={field.value}
                                      value={field.value}
                                      disabled={isFieldMapped(field.value) && mapping?.targetField !== field.value}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span>{field.label}</span>
                                        {field.required && (
                                          <span className="text-red-500">*</span>
                                        )}
                                        {isFieldMapped(field.value) && mapping?.targetField !== field.value && (
                                          <Badge variant="secondary" className="text-xs">mapped</Badge>
                                        )}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </div>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {mapping?.aiSuggested && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100"
                                    onClick={() => acceptSuggestion(column)}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Accept suggestion</TooltipContent>
                              </Tooltip>
                            )}
                            {mapping && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={() => clearMapping(column)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Clear mapping</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={4}>
                            <div className="py-2">
                              <p className="text-xs font-medium text-muted-foreground mb-2">
                                Sample values from this column:
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {sampleData.slice(0, 5).map((row, idx) => {
                                  const value = row[column];
                                  return (
                                    <Badge key={idx} variant="outline" className="font-mono text-xs">
                                      {value === undefined || value === null || value === ""
                                        ? <em className="text-muted-foreground">empty</em>
                                        : String(value).substring(0, 40)}
                                    </Badge>
                                  );
                                })}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  );
}
