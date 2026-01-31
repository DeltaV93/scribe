"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Plus,
  Search,
  Book,
  Sparkles,
  FileText,
  Video,
  PenLine,
  Tag,
} from "lucide-react";
import { format } from "date-fns";

interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  source: "MEETING" | "DOCUMENT" | "MANUAL";
  category: string | null;
  tags: string[];
  createdAt: string;
  createdBy: {
    id: string;
    name: string | null;
  };
  meeting?: {
    id: string;
    title: string;
  } | null;
  score?: number; // For semantic search results
}

interface KnowledgeStats {
  totalEntries: number;
  bySource: Record<string, number>;
  byCategory: Record<string, number>;
  availableTags: string[];
  availableCategories: string[];
  recentEntries: Array<{
    id: string;
    title: string;
    source: string;
    createdAt: string;
  }>;
}

const sourceConfig = {
  MEETING: { label: "Meeting", icon: Video, color: "bg-blue-100 text-blue-800" },
  DOCUMENT: { label: "Document", icon: FileText, color: "bg-green-100 text-green-800" },
  MANUAL: { label: "Manual", icon: PenLine, color: "bg-purple-100 text-purple-800" },
};

export default function KnowledgePage() {
  const router = useRouter();
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [semanticSearch, setSemanticSearch] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;

  // Create dialog
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newEntry, setNewEntry] = useState({
    title: "",
    content: "",
    summary: "",
    category: "",
    tags: "",
  });

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/knowledge/stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchEntries = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) {
        params.set("query", searchQuery);
        if (semanticSearch) {
          params.set("semantic", "true");
        }
      }
      if (sourceFilter && sourceFilter !== "all") params.set("source", sourceFilter);
      if (categoryFilter && categoryFilter !== "all") params.set("category", categoryFilter);
      params.set("limit", limit.toString());
      params.set("offset", ((page - 1) * limit).toString());

      const response = await fetch(`/api/knowledge?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setEntries(data.data);
        setTotal(data.total);
      }
    } catch (error) {
      console.error("Error fetching entries:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [searchQuery, semanticSearch, sourceFilter, categoryFilter, page]);

  const handleCreateEntry = async () => {
    if (!newEntry.title.trim() || !newEntry.content.trim()) return;

    setIsCreating(true);
    try {
      const response = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newEntry.title,
          content: newEntry.content,
          summary: newEntry.summary || undefined,
          category: newEntry.category || undefined,
          tags: newEntry.tags
            ? newEntry.tags.split(",").map((t) => t.trim()).filter(Boolean)
            : undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setIsCreateOpen(false);
        setNewEntry({ title: "", content: "", summary: "", category: "", tags: "" });
        router.push(`/knowledge/${data.data.id}`);
      }
    } catch (error) {
      console.error("Error creating entry:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
          <p className="text-muted-foreground">
            Institutional memory from meetings, documents, and manual entries.
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Knowledge
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Knowledge Entry</DialogTitle>
              <DialogDescription>
                Create a new knowledge entry for your organization.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="e.g., Remote Work Policy"
                  value={newEntry.title}
                  onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  placeholder="The full knowledge content..."
                  className="min-h-[200px]"
                  value={newEntry.content}
                  onChange={(e) => setNewEntry({ ...newEntry, content: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="summary">Summary (optional)</Label>
                <Textarea
                  id="summary"
                  placeholder="A brief summary..."
                  value={newEntry.summary}
                  onChange={(e) => setNewEntry({ ...newEntry, summary: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category (optional)</Label>
                  <Input
                    id="category"
                    placeholder="e.g., Policy, Process, Decision"
                    value={newEntry.category}
                    onChange={(e) => setNewEntry({ ...newEntry, category: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    placeholder="e.g., hr, remote-work, policy"
                    value={newEntry.tags}
                    onChange={(e) => setNewEntry({ ...newEntry, tags: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateEntry}
                disabled={isCreating || !newEntry.title.trim() || !newEntry.content.trim()}
              >
                {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Entry
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Entries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalEntries}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                From Meetings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.bySource.MEETING || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Manual Entries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.bySource.MANUAL || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Categories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.availableCategories.length}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={semanticSearch ? "Ask a question..." : "Search knowledge..."}
            className="pl-10"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="semantic"
            checked={semanticSearch}
            onCheckedChange={setSemanticSearch}
          />
          <Label htmlFor="semantic" className="flex items-center gap-1">
            <Sparkles className="h-4 w-4" />
            AI Search
          </Label>
        </div>

        <Select
          value={sourceFilter}
          onValueChange={(value) => {
            setSourceFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="MEETING">Meeting</SelectItem>
            <SelectItem value="DOCUMENT">Document</SelectItem>
            <SelectItem value="MANUAL">Manual</SelectItem>
          </SelectContent>
        </Select>

        {stats && stats.availableCategories.length > 0 && (
          <Select
            value={categoryFilter}
            onValueChange={(value) => {
              setCategoryFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {stats.availableCategories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Results Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Created</TableHead>
              {semanticSearch && <TableHead>Relevance</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={semanticSearch ? 6 : 5} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={semanticSearch ? 6 : 5} className="text-center py-8">
                  <div className="text-muted-foreground">
                    <Book className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No knowledge entries found</p>
                    <p className="text-sm">
                      {searchQuery
                        ? "Try adjusting your search terms"
                        : "Add your first knowledge entry to get started."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => {
                const SourceIcon = sourceConfig[entry.source].icon;
                return (
                  <TableRow
                    key={entry.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/knowledge/${entry.id}`)}
                  >
                    <TableCell>
                      <div className="font-medium">{entry.title}</div>
                      {entry.summary && (
                        <div className="text-sm text-muted-foreground truncate max-w-md">
                          {entry.summary}
                        </div>
                      )}
                      {entry.meeting && (
                        <div className="text-xs text-muted-foreground mt-1">
                          From: {entry.meeting.title}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={sourceConfig[entry.source].color}>
                        <SourceIcon className="h-3 w-3 mr-1" />
                        {sourceConfig[entry.source].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {entry.category ? (
                        <Badge variant="outline">{entry.category}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.tags.length > 0 ? (
                        <div className="flex gap-1 flex-wrap">
                          {entry.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {entry.tags.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{entry.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {format(new Date(entry.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    {semanticSearch && (
                      <TableCell>
                        {entry.score !== undefined && (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${Math.round(entry.score * 100)}%` }}
                              />
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {Math.round(entry.score * 100)}%
                            </span>
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
