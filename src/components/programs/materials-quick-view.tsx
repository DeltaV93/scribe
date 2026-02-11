"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
 * MaterialsQuickView - A popover component for quick-viewing materials
 * attached to a program or session without navigating away.
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

  // Fetch materials when popover opens
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

  const handleDownload = (material: Material) => {
    window.open(material.fileUrl, "_blank");
  };

  // Don't render if no materials
  if (materialCount === 0) {
    return null;
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-auto px-2 py-1 gap-1.5 text-muted-foreground hover:text-foreground",
            className
          )}
          title={`${materialCount} material${materialCount !== 1 ? "s" : ""} attached`}
        >
          <Paperclip className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">{materialCount}</span>
          {label && <span className="text-xs">{label}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b">
          <h4 className="font-medium text-sm">
            {sessionId ? "Session Materials" : "Program Materials"}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {materialCount} material{materialCount !== 1 ? "s" : ""} attached
          </p>
        </div>

        <div className="max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : materials.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
              <FolderOpen className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No materials found</p>
            </div>
          ) : (
            <ul className="divide-y">
              {materials.map((material) => {
                const TypeIcon = getMaterialTypeIcon(material.materialType);
                return (
                  <li
                    key={material.id}
                    className="flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      <TypeIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        title={material.filename}
                      >
                        {material.filename}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {getMaterialTypeLabel(material.materialType)}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {formatFileSize(material.sizeBytes)}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 flex-shrink-0"
                      onClick={() => handleDownload(material)}
                      title="Download / Open"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {materials.length > 0 && (
          <div className="p-2 border-t bg-muted/30">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs h-7"
              onClick={() => {
                // Close popover and user can navigate to materials tab
                setIsOpen(false);
              }}
            >
              <ExternalLink className="h-3 w-3 mr-1.5" />
              View all in Materials tab
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
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
