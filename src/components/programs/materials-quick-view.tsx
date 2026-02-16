"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MaterialType } from "@prisma/client";
import {
  FileText,
  Presentation,
  FileCheck,
  FileSpreadsheet,
  GraduationCap,
  File,
  Download,
  ExternalLink,
  Paperclip,
  Loader2,
  FolderOpen,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Material {
  id: string;
  filename: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  materialType: MaterialType;
  uploadedAt: string;
}

interface MaterialsQuickViewProps {
  programId: string;
  sessionId?: string;
  materialCount: number;
  label?: string;
  className?: string;
}

/**
 * Get the appropriate icon component for a material type
 */
function getMaterialTypeIcon(type: MaterialType) {
  switch (type) {
    case "SYLLABUS":
      return FileText;
    case "HANDOUT":
      return File;
    case "PRESENTATION":
      return Presentation;
    case "WORKSHEET":
      return FileSpreadsheet;
    case "ASSESSMENT":
      return FileCheck;
    case "CERTIFICATE_TEMPLATE":
      return GraduationCap;
    default:
      return File;
  }
}

/**
 * Get display name for material type
 */
function getMaterialTypeLabel(type: MaterialType): string {
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
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Check if a file is previewable as an image
 */
function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

/**
 * MaterialsQuickView - A modal dialog for quick-viewing materials
 * attached to a program or session without navigating away.
 *
 * PX-722: Updated from popover to modal for better UX
 */
export function MaterialsQuickView({
  programId,
  sessionId,
  materialCount,
  label,
  className,
}: MaterialsQuickViewProps) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Fetch materials when modal opens
  useEffect(() => {
    if (isOpen && !hasLoaded && materialCount > 0) {
      fetchMaterials();
    }
  }, [isOpen, hasLoaded, materialCount, programId, sessionId]);

  const fetchMaterials = async () => {
    setIsLoading(true);
    try {
      const url = sessionId
        ? `/api/programs/${programId}/materials?sessionId=${sessionId}`
        : `/api/programs/${programId}/materials?sessionId=null`;

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setMaterials(data.data);
        setHasLoaded(true);
      }
    } catch (error) {
      console.error("Error fetching materials:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = (material: Material, e?: React.MouseEvent) => {
    e?.stopPropagation();
    window.open(material.fileUrl, "_blank");
  };

  const handlePreview = (material: Material) => {
    if (isImageFile(material.mimeType)) {
      setPreviewUrl(material.fileUrl);
    } else {
      // For non-images, open in new tab
      window.open(material.fileUrl, "_blank");
    }
  };

  // Don't render if no materials
  if (materialCount === 0) {
    return null;
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-auto px-2 py-1 gap-1.5 text-muted-foreground hover:text-foreground",
          className
        )}
        title={`${materialCount} material${materialCount !== 1 ? "s" : ""} attached`}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
      >
        <Paperclip className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">{materialCount}</span>
        {label && <span className="text-xs">{label}</span>}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          className="sm:max-w-[480px] max-h-[80vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>
              {sessionId ? "Session Materials" : "Program Materials"}
            </DialogTitle>
            <DialogDescription>
              {materialCount} material{materialCount !== 1 ? "s" : ""} attached
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 -mx-6 px-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : materials.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FolderOpen className="h-10 w-10 mb-3 opacity-50" />
                <p className="text-sm">No materials found</p>
              </div>
            ) : (
              <ul className="divide-y">
                {materials.map((material) => {
                  const TypeIcon = getMaterialTypeIcon(material.materialType);
                  const canPreview = isImageFile(material.mimeType);
                  return (
                    <li
                      key={material.id}
                      className={cn(
                        "flex items-start gap-3 py-3 transition-colors",
                        canPreview && "cursor-pointer hover:bg-muted/50 -mx-3 px-3 rounded-md"
                      )}
                      onClick={() => canPreview && handlePreview(material)}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {canPreview ? (
                          <ImageIcon className="h-5 w-5 text-blue-500" />
                        ) : (
                          <TypeIcon className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-medium truncate"
                          title={material.filename}
                        >
                          {material.filename}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {getMaterialTypeLabel(material.materialType)}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {formatFileSize(material.sizeBytes)}
                          </span>
                          {canPreview && (
                            <span className="text-[10px] text-blue-500">
                              Click to preview
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 flex-shrink-0"
                        onClick={(e) => handleDownload(material, e)}
                        title="Open in new tab"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Image preview modal */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="sm:max-w-[90vw] sm:max-h-[90vh] p-0 overflow-hidden">
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white"
              onClick={() => setPreviewUrl(null)}
            >
              <X className="h-4 w-4" />
            </Button>
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Material preview"
                className="max-w-full max-h-[85vh] object-contain mx-auto"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * MaterialsIndicator - A simple badge/indicator showing materials count
 * Use this when you just want to show a count without the popover functionality.
 */
export function MaterialsIndicator({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count === 0) return null;

  return (
    <Badge
      variant="secondary"
      className={cn("h-5 px-1.5 text-[10px] font-medium", className)}
    >
      <Paperclip className="h-3 w-3 mr-0.5" />
      {count}
    </Badge>
  );
}
