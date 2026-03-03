"use client";

/**
 * Model Table
 *
 * Displays a table of ML models with filtering and search.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  ChevronRight,
  Brain,
  FileText,
  Tags,
  Globe,
  Building2,
} from "lucide-react";
import type { Model, ModelType } from "@/lib/ml-services";

interface ModelTableProps {
  models: Model[];
  isLoading?: boolean;
  onFilterChange?: (filters: { modelType?: ModelType; search?: string }) => void;
}

const MODEL_TYPE_ICONS: Record<ModelType, React.ReactNode> = {
  llm: <Brain className="h-4 w-4" />,
  extraction: <FileText className="h-4 w-4" />,
  classification: <Tags className="h-4 w-4" />,
};

const MODEL_TYPE_LABELS: Record<ModelType, string> = {
  llm: "LLM",
  extraction: "Extraction",
  classification: "Classification",
};

export function ModelTable({ models, isLoading, onFilterChange }: ModelTableProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    onFilterChange?.({
      modelType: typeFilter !== "all" ? (typeFilter as ModelType) : undefined,
      search: value || undefined,
    });
  };

  const handleTypeChange = (value: string) => {
    setTypeFilter(value);
    onFilterChange?.({
      modelType: value !== "all" ? (value as ModelType) : undefined,
      search: searchQuery || undefined,
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  // Client-side filtering for search (API may not support it)
  const filteredModels = models.filter((model) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      model.name.toLowerCase().includes(query) ||
      model.description?.toLowerCase().includes(query)
    );
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3].map((i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-8" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search models..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="llm">LLM</SelectItem>
            <SelectItem value="extraction">Extraction</SelectItem>
            <SelectItem value="classification">Classification</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredModels.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <p className="text-muted-foreground">No models found</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredModels.map((model) => (
                <TableRow
                  key={model.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/settings/ml/models/${model.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {MODEL_TYPE_ICONS[model.model_type]}
                      <span className="font-medium">{model.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {MODEL_TYPE_LABELS[model.model_type]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {model.is_global ? (
                      <Badge variant="secondary" className="gap-1">
                        <Globe className="h-3 w-3" />
                        Global
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <Building2 className="h-3 w-3" />
                        Organization
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {model.description || "No description"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(model.created_at)}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
