"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, RefreshCw, CheckCircle2, XCircle, Clock, PlayCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface MassNoteBatch {
  id: string;
  type: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  progress: number;
  total: number;
  completed: number;
  failed: number;
  error: string | null;
  metadata: {
    sessionId: string;
    sessionTitle: string;
    templateId?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

export function MassNotesBatchList() {
  const [batches, setBatches] = useState<MassNoteBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const limit = 10;

  useEffect(() => {
    loadBatches();
  }, [page]);

  // Poll for active batches
  useEffect(() => {
    const hasActive = batches.some(
      (b) => b.status === "PENDING" || b.status === "PROCESSING"
    );

    if (!hasActive) return;

    const interval = setInterval(loadBatches, 5000);
    return () => clearInterval(interval);
  }, [batches]);

  async function loadBatches() {
    try {
      const res = await fetch(
        `/api/mass-notes?batches=true&limit=${limit}&offset=${page * limit}`
      );
      if (res.ok) {
        const data = await res.json();
        setBatches(data.data || []);
        setTotal(data.pagination?.total || 0);
      }
    } catch (error) {
      console.error("Error loading batches:", error);
    } finally {
      setLoading(false);
    }
  }

  function getStatusIcon(status: MassNoteBatch["status"]) {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "FAILED":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "PROCESSING":
        return <PlayCircle className="h-4 w-4 text-blue-600" />;
      case "PENDING":
        return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  }

  function getStatusBadge(status: MassNoteBatch["status"]) {
    const variants: Record<
      MassNoteBatch["status"],
      "default" | "secondary" | "destructive" | "outline"
    > = {
      COMPLETED: "default",
      FAILED: "destructive",
      PROCESSING: "secondary",
      PENDING: "outline",
    };

    return <Badge variant={variants[status]}>{status}</Badge>;
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Mass Note History</CardTitle>
          <CardDescription>
            View previous mass note creation batches and their status.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={loadBatches}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {batches.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No mass note batches found. Create your first batch using the wizard.
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Created By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(batch.status)}
                        {getStatusBadge(batch.status)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {batch.metadata?.sessionTitle || "Unknown Session"}
                        </div>
                        {batch.error && (
                          <div className="text-xs text-red-600 mt-1">
                            {batch.error}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Progress value={batch.progress} className="w-24" />
                          <span className="text-sm text-muted-foreground">
                            {batch.progress}%
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {batch.completed} created
                          {batch.failed > 0 && `, ${batch.failed} failed`}
                          {" of "}
                          {batch.total} total
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatDistanceToNow(new Date(batch.createdAt), {
                          addSuffix: true,
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {batch.user.name || batch.user.email}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {total > limit && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {page * limit + 1} to{" "}
                  {Math.min((page + 1) * limit, total)} of {total} batches
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={(page + 1) * limit >= total}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
