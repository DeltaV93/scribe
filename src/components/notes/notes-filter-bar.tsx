"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Search,
  Calendar as CalendarIcon,
  Tag,
  X,
  ChevronDown,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

interface NoteTag {
  id: string;
  name: string;
  colorHash: string;
}

interface NotesFilterBarProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  dateRange: { from: Date | null; to: Date | null };
  onDateRangeChange: (range: { from: Date | null; to: Date | null }) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClearFilters: () => void;
  className?: string;
}

// Generate a consistent color based on tag name hash
function getTagColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  // Use predefined colors for better consistency
  const colors = [
    "bg-blue-100 text-blue-800 border-blue-200",
    "bg-green-100 text-green-800 border-green-200",
    "bg-yellow-100 text-yellow-800 border-yellow-200",
    "bg-purple-100 text-purple-800 border-purple-200",
    "bg-pink-100 text-pink-800 border-pink-200",
    "bg-indigo-100 text-indigo-800 border-indigo-200",
    "bg-orange-100 text-orange-800 border-orange-200",
    "bg-teal-100 text-teal-800 border-teal-200",
    "bg-red-100 text-red-800 border-red-200",
    "bg-cyan-100 text-cyan-800 border-cyan-200",
  ];

  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

export function NotesFilterBar({
  selectedTags,
  onTagsChange,
  dateRange,
  onDateRangeChange,
  searchQuery,
  onSearchChange,
  onClearFilters,
  className,
}: NotesFilterBarProps) {
  const [availableTags, setAvailableTags] = useState<NoteTag[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(true);
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(debouncedSearch);
    }, 300);

    return () => clearTimeout(timer);
  }, [debouncedSearch, onSearchChange]);

  // Fetch available tags
  useEffect(() => {
    async function fetchTags() {
      try {
        const response = await fetch("/api/note-tags");
        if (response.ok) {
          const data = await response.json();
          setAvailableTags(data.data || []);
        }
      } catch (error) {
        console.error("Error fetching note tags:", error);
      } finally {
        setIsLoadingTags(false);
      }
    }

    fetchTags();
  }, []);

  const handleTagToggle = useCallback((tagName: string) => {
    if (selectedTags.includes(tagName)) {
      onTagsChange(selectedTags.filter((t) => t !== tagName));
    } else {
      onTagsChange([...selectedTags, tagName]);
    }
  }, [selectedTags, onTagsChange]);

  const handleDateSelect = useCallback((range: DateRange | undefined) => {
    onDateRangeChange({
      from: range?.from || null,
      to: range?.to || null,
    });
  }, [onDateRangeChange]);

  const hasFilters = selectedTags.length > 0 || dateRange.from || dateRange.to || searchQuery.trim();

  const formatDateRange = () => {
    if (dateRange.from && dateRange.to) {
      return `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d")}`;
    }
    if (dateRange.from) {
      return `From ${format(dateRange.from, "MMM d")}`;
    }
    if (dateRange.to) {
      return `Until ${format(dateRange.to, "MMM d")}`;
    }
    return "Date Range";
  };

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center", className)}>
      {/* Search Input */}
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search notes..."
          value={debouncedSearch}
          onChange={(e) => setDebouncedSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tag Filter */}
      <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "justify-between gap-2",
              selectedTags.length > 0 && "border-primary"
            )}
          >
            <Tag className="h-4 w-4" />
            <span>
              {selectedTags.length > 0
                ? `${selectedTags.length} tag${selectedTags.length > 1 ? "s" : ""}`
                : "Tags"}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground mb-2">
              Filter by tags
            </p>
            {isLoadingTags ? (
              <p className="text-sm text-muted-foreground">Loading tags...</p>
            ) : availableTags.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tags available</p>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2">
                {availableTags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center space-x-2"
                  >
                    <Checkbox
                      id={`tag-${tag.id}`}
                      checked={selectedTags.includes(tag.name)}
                      onCheckedChange={() => handleTagToggle(tag.name)}
                    />
                    <Label
                      htmlFor={`tag-${tag.id}`}
                      className="flex items-center gap-2 cursor-pointer text-sm"
                    >
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
                          getTagColor(tag.name)
                        )}
                      >
                        {tag.name}
                      </span>
                    </Label>
                  </div>
                ))}
              </div>
            )}
            {selectedTags.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onTagsChange([])}
                className="w-full mt-2"
              >
                Clear tags
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Date Range Filter */}
      <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "justify-between gap-2",
              (dateRange.from || dateRange.to) && "border-primary"
            )}
          >
            <CalendarIcon className="h-4 w-4" />
            <span>{formatDateRange()}</span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={{
              from: dateRange.from || undefined,
              to: dateRange.to || undefined,
            }}
            onSelect={handleDateSelect}
            numberOfMonths={2}
            defaultMonth={dateRange.from || new Date()}
          />
          {(dateRange.from || dateRange.to) && (
            <div className="p-3 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDateRangeChange({ from: null, to: null })}
                className="w-full"
              >
                Clear date range
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Selected Filters Display & Clear All */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4 mr-1" />
          Clear all
        </Button>
      )}

      {/* Display selected tags as badges (visible on larger screens) */}
      <div className="hidden lg:flex flex-wrap gap-1">
        {selectedTags.slice(0, 3).map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className={cn("cursor-pointer", getTagColor(tag))}
            onClick={() => handleTagToggle(tag)}
          >
            {tag}
            <X className="h-3 w-3 ml-1" />
          </Badge>
        ))}
        {selectedTags.length > 3 && (
          <Badge variant="secondary">
            +{selectedTags.length - 3} more
          </Badge>
        )}
      </div>
    </div>
  );
}

// Export the color function for use in other components
export { getTagColor };
