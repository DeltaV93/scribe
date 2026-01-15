"use client";

import { useState, useEffect } from "react";
import {
  File,
  FileText,
  Image,
  Music,
  Download,
  Trash2,
  RefreshCw,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { formatFileSize } from "@/lib/files/types";
import type { FileUploadResult, ScanStatus } from "@/lib/files/types";

interface FileListProps {
  onFileSelect?: (file: FileUploadResult) => void;
}

export function FileList({ onFileSelect }: FileListProps) {
  const [files, setFiles] = useState<FileUploadResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchFiles = async () => {
    try {
      const response = await fetch("/api/files");
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files);
        setTotal(data.total);
      }
    } catch (error) {
      console.error("Failed to fetch files:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleDownload = async (file: FileUploadResult) => {
    try {
      const response = await fetch(`/api/files/${file.id}?action=download`);
      if (response.ok) {
        const data = await response.json();
        window.open(data.url, "_blank");
      }
    } catch (error) {
      console.error("Download error:", error);
    }
  };

  const handleDelete = async (file: FileUploadResult) => {
    if (!confirm(`Delete ${file.originalName}?`)) return;

    try {
      const response = await fetch(`/api/files/${file.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setFiles((prev) => prev.filter((f) => f.id !== file.id));
        setTotal((prev) => prev - 1);
      }
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  const handleRescan = async (file: FileUploadResult) => {
    try {
      await fetch(`/api/files/${file.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rescan" }),
      });
      // Refresh the list
      fetchFiles();
    } catch (error) {
      console.error("Rescan error:", error);
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return Image;
    if (mimeType.startsWith("audio/")) return Music;
    if (mimeType.includes("pdf") || mimeType.includes("word")) return FileText;
    return File;
  };

  const getScanStatusBadge = (status: ScanStatus) => {
    switch (status) {
      case "PENDING":
        return (
          <Badge variant="secondary" className="gap-1">
            <ShieldQuestion className="h-3 w-3" />
            Pending
          </Badge>
        );
      case "SCANNING":
        return (
          <Badge variant="secondary" className="gap-1">
            <Shield className="h-3 w-3 animate-pulse" />
            Scanning
          </Badge>
        );
      case "CLEAN":
        return (
          <Badge variant="default" className="gap-1 bg-green-600">
            <ShieldCheck className="h-3 w-3" />
            Clean
          </Badge>
        );
      case "INFECTED":
        return (
          <Badge variant="destructive" className="gap-1">
            <ShieldAlert className="h-3 w-3" />
            Quarantined
          </Badge>
        );
      case "ERROR":
        return (
          <Badge variant="outline" className="gap-1 text-yellow-600">
            <ShieldQuestion className="h-3 w-3" />
            Error
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <File className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No files uploaded yet</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {total} file{total !== 1 ? "s" : ""}
        </p>
        <Button variant="outline" size="sm" onClick={fetchFiles}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>File</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Uploaded</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => {
            const FileIcon = getFileIcon(file.mimeType);
            return (
              <TableRow
                key={file.id}
                className="cursor-pointer"
                onClick={() => onFileSelect?.(file)}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <FileIcon className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium truncate max-w-[200px]">
                      {file.originalName}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatFileSize(file.sizeBytes)}
                </TableCell>
                <TableCell>{getScanStatusBadge(file.scanStatus)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(file.uploadedAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        •••
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(file);
                        }}
                        disabled={file.scanStatus === "INFECTED"}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRescan(file);
                        }}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Rescan
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(file);
                        }}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
