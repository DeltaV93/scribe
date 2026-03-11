"use client";

/**
 * Model Table
 *
 * Displays a table of ML models with filtering, search, and responsive design.
 * Includes proper loading states, empty states, and accessibility features.
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Search,
  ChevronRight,
  Brain,
  FileText,
  Tags,
  Globe,
  Building2,
  Plus,
  Package,
  Calendar,
} from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { Model, ModelType } from "@/lib/ml-services";

interface ModelTableProps {
  models: Model[];
  isLoading?: boolean;
  onFilterChange?: (filters: { modelType?: ModelType; search?: string }) => void;
  onCreateClick?: () => void;
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

/**
 * Skeleton loader for the table view
 */
function TableSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading models">
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
              <TableHead>Scope</TableHead>
              <TableHead className="hidden md:table-cell">Description</TableHead>
              <TableHead className="hidden sm:table-cell">Created</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3].map((i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-5 w-28" />
                  </div>
                </TableCell>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                <TableCell className="hidden md:table-cell">
                  <Skeleton className="h-5 w-40" />
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Skeleton className="h-5 w-24" />
                </TableCell>
                <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <span className="sr-only">Loading model data...</span>
    </div>
  );
}

/**
 * Skeleton loader for the card view (mobile)
 */
function CardSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading models">
      <div className="flex gap-4">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-32" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
      <span className="sr-only">Loading model data...</span>
    </div>
  );
}

/**
 * Empty state when no models exist
 */
function EmptyState({ onCreateClick }: { onCreateClick?: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed rounded-lg"
      role="status"
      aria-label="No models"
    >
      <div className="p-4 rounded-full bg-muted mb-4">
        <Package className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-1">No models yet</h3>
      <p className="text-muted-foreground text-center max-w-sm mb-4">
        Create your first ML model to start managing versions, deployments, and
        training jobs.
      </p>
      {onCreateClick && (
        <Button onClick={onCreateClick}>
          <Plus className="h-4 w-4 mr-2" />
          Create Your First Model
        </Button>
      )}
    </div>
  );
}

/**
 * Empty state when search returns no results
 */
function NoResultsState({ searchQuery, onClear }: { searchQuery: string; onClear: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-12 px-4"
      role="status"
      aria-label="No search results"
    >
      <div className="p-4 rounded-full bg-muted mb-4">
        <Search className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-1">No results found</h3>
      <p className="text-muted-foreground text-center max-w-sm mb-4">
        No models match &quot;{searchQuery}&quot;. Try a different search term.
      </p>
      <Button variant="outline" onClick={onClear}>
        Clear Search
      </Button>
    </div>
  );
}

/**
 * Mobile card view for a single model
 */
function ModelCard({ model, onClick }: { model: Model; onClick: () => void }) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow focus-within:ring-2 focus-within:ring-ring"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`View ${model.name} model details`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg bg-muted"
              aria-hidden="true"
            >
              {MODEL_TYPE_ICONS[model.model_type]}
            </div>
            <div>
              <CardTitle className="text-base">{model.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {MODEL_TYPE_LABELS[model.model_type]}
                </Badge>
                {model.is_global ? (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Globe className="h-3 w-3" aria-hidden="true" />
                    <span>Global</span>
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Building2 className="h-3 w-3" aria-hidden="true" />
                    <span>Org</span>
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="line-clamp-2 mb-3">
          {model.description || "No description provided"}
        </CardDescription>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" aria-hidden="true" />
          <span>Created {formatDate(model.created_at)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function ModelTable({
  models,
  isLoading,
  onFilterChange,
  onCreateClick,
}: ModelTableProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const isMobile = useMediaQuery("(max-width: 640px)");

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

  const clearSearch = () => {
    setSearchQuery("");
    onFilterChange?.({
      modelType: typeFilter !== "all" ? (typeFilter as ModelType) : undefined,
      search: undefined,
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

  const navigateToModel = (modelId: string) => {
    router.push(`/settings/ml/models/${modelId}`);
  };

  // Loading state
  if (isLoading) {
    return isMobile ? <CardSkeleton /> : <TableSkeleton />;
  }

  // Empty state (no models at all)
  if (models.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
              disabled
              aria-label="Search models"
            />
          </div>
          <Select value={typeFilter} onValueChange={handleTypeChange} disabled>
            <SelectTrigger className="w-40" aria-label="Filter by model type">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <EmptyState onCreateClick={onCreateClick} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            placeholder="Search models..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
            aria-label="Search models by name or description"
          />
        </div>
        <Select value={typeFilter} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-40" aria-label="Filter by model type">
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

      {/* No results state */}
      {filteredModels.length === 0 && searchQuery && (
        <NoResultsState searchQuery={searchQuery} onClear={clearSearch} />
      )}

      {/* Mobile Card View */}
      {isMobile && filteredModels.length > 0 && (
        <div className="grid gap-4" role="list" aria-label="Model list">
          {filteredModels.map((model) => (
            <div key={model.id} role="listitem">
              <ModelCard
                model={model}
                onClick={() => navigateToModel(model.id)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Desktop Table View */}
      {!isMobile && filteredModels.length > 0 && (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead className="hidden md:table-cell">Description</TableHead>
                <TableHead className="hidden sm:table-cell">Created</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">View details</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredModels.map((model) => (
                <TableRow
                  key={model.id}
                  className="cursor-pointer hover:bg-muted/50 focus-within:bg-muted/50"
                  onClick={() => navigateToModel(model.id)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigateToModel(model.id);
                    }
                  }}
                  role="link"
                  aria-label={`View ${model.name} model details`}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span aria-hidden="true">{MODEL_TYPE_ICONS[model.model_type]}</span>
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
                        <Globe className="h-3 w-3" aria-hidden="true" />
                        <span>Global</span>
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <Building2 className="h-3 w-3" aria-hidden="true" />
                        <span>Organization</span>
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground hidden md:table-cell">
                    {model.description || "No description"}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden sm:table-cell">
                    {formatDate(model.created_at)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`View ${model.name} details`}
                      tabIndex={-1}
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Results count */}
      {filteredModels.length > 0 && (
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          Showing {filteredModels.length} of {models.length} models
        </p>
      )}
    </div>
  );
}
