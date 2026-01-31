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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Plus,
  Search,
  Video,
  Users,
  Clock,
  CheckCircle,
  AlertCircle,
  Upload,
} from "lucide-react";
import { format } from "date-fns";

interface Meeting {
  id: string;
  title: string;
  description: string | null;
  status: "SCHEDULED" | "PROCESSING" | "COMPLETED" | "FAILED";
  source: "UPLOAD" | "TEAMS" | "ZOOM" | "GOOGLE_MEET";
  scheduledStartAt: string | null;
  actualStartAt: string | null;
  durationSeconds: number | null;
  participantCount: number | null;
  tags: string[];
  createdBy: {
    id: string;
    name: string | null;
  };
  location: {
    id: string;
    name: string;
    type: string;
  } | null;
  _count: {
    actionItems: number;
    questions: number;
  };
}

const statusConfig = {
  SCHEDULED: { label: "Scheduled", color: "bg-blue-100 text-blue-800", icon: Clock },
  PROCESSING: { label: "Processing", color: "bg-yellow-100 text-yellow-800", icon: Loader2 },
  COMPLETED: { label: "Completed", color: "bg-green-100 text-green-800", icon: CheckCircle },
  FAILED: { label: "Failed", color: "bg-red-100 text-red-800", icon: AlertCircle },
};

export default function MeetingsPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;

  // Create meeting dialog
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newMeeting, setNewMeeting] = useState({
    title: "",
    description: "",
  });

  const fetchMeetings = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("query", searchQuery);
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      params.set("limit", limit.toString());
      params.set("offset", ((page - 1) * limit).toString());

      const response = await fetch(`/api/meetings?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setMeetings(data.data);
        setTotal(data.total);
      }
    } catch (error) {
      console.error("Error fetching meetings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, [searchQuery, statusFilter, page]);

  const handleCreateMeeting = async () => {
    if (!newMeeting.title.trim()) return;

    setIsCreating(true);
    try {
      const response = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newMeeting.title,
          description: newMeeting.description || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setIsCreateOpen(false);
        setNewMeeting({ title: "", description: "" });
        router.push(`/meetings/${data.data.id}`);
      }
    } catch (error) {
      console.error("Error creating meeting:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "-";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meetings</h1>
          <p className="text-muted-foreground">
            View meeting recordings, transcripts, and summaries.
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Meeting
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Meeting</DialogTitle>
              <DialogDescription>
                Create a meeting record to upload and process a recording.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Meeting Title</Label>
                <Input
                  id="title"
                  placeholder="e.g., Weekly Team Standup"
                  value={newMeeting.title}
                  onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of the meeting..."
                  value={newMeeting.description}
                  onChange={(e) => setNewMeeting({ ...newMeeting, description: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateMeeting} disabled={isCreating || !newMeeting.title.trim()}>
                {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Meeting
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search meetings..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="SCHEDULED">Scheduled</SelectItem>
            <SelectItem value="PROCESSING">Processing</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Meeting</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Participants</TableHead>
              <TableHead>Action Items</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : meetings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <div className="text-muted-foreground">
                    <Video className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No meetings found</p>
                    <p className="text-sm">Create a new meeting to get started.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              meetings.map((meeting) => {
                const StatusIcon = statusConfig[meeting.status].icon;
                return (
                  <TableRow
                    key={meeting.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/meetings/${meeting.id}`)}
                  >
                    <TableCell>
                      <div className="font-medium">{meeting.title}</div>
                      {meeting.description && (
                        <div className="text-sm text-muted-foreground truncate max-w-xs">
                          {meeting.description}
                        </div>
                      )}
                      {meeting.tags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {meeting.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusConfig[meeting.status].color}>
                        <StatusIcon className={`h-3 w-3 mr-1 ${meeting.status === "PROCESSING" ? "animate-spin" : ""}`} />
                        {statusConfig[meeting.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {meeting.actualStartAt || meeting.scheduledStartAt ? (
                        format(
                          new Date(meeting.actualStartAt || meeting.scheduledStartAt!),
                          "MMM d, yyyy"
                        )
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>{formatDuration(meeting.durationSeconds)}</TableCell>
                    <TableCell>
                      {meeting.participantCount ? (
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {meeting.participantCount}
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {meeting._count.actionItems > 0 && (
                        <Badge variant="outline">{meeting._count.actionItems} items</Badge>
                      )}
                    </TableCell>
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
