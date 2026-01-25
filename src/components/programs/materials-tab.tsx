"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MaterialType, ExtractionStatus } from "@prisma/client";
import {
  Plus,
  FileText,
  Image,
  File,
  Sparkles,
  Loader2,
  Trash2,
  Download,
  CheckCircle,
  AlertCircle,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Material {
  id: string;
  filename: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  materialType: MaterialType;
  extractionStatus: ExtractionStatus;
  extractedData: any | null;
  uploadedAt: string;
  uploadedBy?: {
    name: string | null;
    email: string;
  };
  session?: {
    sessionNumber: number;
    title: string;
  } | null;
}

interface MaterialsTabProps {
  programId: string;
  programName: string;
}

export function MaterialsTab({ programId, programName }: MaterialsTabProps) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExtracting, setIsExtracting] = useState<string | null>(null);

  const fetchMaterials = async () => {
    try {
      const response = await fetch(`/api/programs/${programId}/materials`);
      if (response.ok) {
        const data = await response.json();
        setMaterials(data.data);
      }
    } catch (error) {
      console.error("Error fetching materials:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, [programId]);

  const handleDelete = async (materialId: string) => {
    if (!confirm("Are you sure you want to delete this material?")) return;

    try {
      const response = await fetch(`/api/programs/${programId}/materials/${materialId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete material");
      }

      toast.success("Material deleted");
      fetchMaterials();
    } catch (error) {
      toast.error("Failed to delete material");
    }
  };

  const handleExtract = async (materialId: string) => {
    setIsExtracting(materialId);

    try {
      const response = await fetch(`/api/programs/${programId}/extract-syllabus`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId,
          applyToProgram: false,
          createSessions: false,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Extraction failed");
      }

      const data = await response.json();
      toast.success(
        `Extracted ${data.data.extraction.sessions.length} sessions with ${data.data.quality.score}% confidence`
      );
      fetchMaterials();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Extraction failed");
    } finally {
      setIsExtracting(null);
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return Image;
    if (mimeType === "application/pdf") return FileText;
    return File;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getMaterialTypeLabel = (type: MaterialType) => {
    const labels: Record<MaterialType, string> = {
      SYLLABUS: "Syllabus",
      HANDOUT: "Handout",
      PRESENTATION: "Presentation",
      WORKSHEET: "Worksheet",
      ASSESSMENT: "Assessment",
      CERTIFICATE_TEMPLATE: "Certificate",
      OTHER: "Other",
    };
    return labels[type] || type;
  };

  const getExtractionStatusIcon = (status: ExtractionStatus) => {
    switch (status) {
      case ExtractionStatus.COMPLETED:
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case ExtractionStatus.PROCESSING:
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
      case ExtractionStatus.FAILED:
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Materials</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" disabled>
            <Plus className="mr-2 h-4 w-4" />
            Upload
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : materials.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No materials uploaded yet</p>
            <p className="text-sm">Upload syllabi, handouts, and other course materials</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>AI Extraction</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.map((material) => {
                const FileIcon = getFileIcon(material.mimeType);
                const isSyllabus = material.materialType === MaterialType.SYLLABUS;

                return (
                  <TableRow key={material.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <FileIcon className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{material.filename}</div>
                          {material.session && (
                            <div className="text-xs text-muted-foreground">
                              Session {material.session.sessionNumber}: {material.session.title}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getMaterialTypeLabel(material.materialType)}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatFileSize(material.sizeBytes)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(material.uploadedAt), "MMM d, yyyy")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {material.uploadedBy?.name || material.uploadedBy?.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      {isSyllabus ? (
                        <div className="flex items-center gap-2">
                          {getExtractionStatusIcon(material.extractionStatus)}
                          <span className="text-sm capitalize">
                            {material.extractionStatus.toLowerCase()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {isSyllabus &&
                          material.extractionStatus !== ExtractionStatus.PROCESSING && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleExtract(material.id)}
                              disabled={isExtracting === material.id}
                              title="Extract syllabus data"
                            >
                              {isExtracting === material.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Sparkles className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(material.fileUrl, "_blank")}
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(material.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
