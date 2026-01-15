"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Upload, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface ImportPreview {
  form: { name: string; type: string };
  fieldCount: number;
  sections: string[];
  fieldTypes: Record<string, number>;
}

interface ImportFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const fieldTypeLabels: Record<string, string> = {
  TEXT_SHORT: "Short Text",
  TEXT_LONG: "Long Text",
  NUMBER: "Number",
  DATE: "Date",
  PHONE: "Phone",
  EMAIL: "Email",
  ADDRESS: "Address",
  DROPDOWN: "Dropdown",
  CHECKBOX: "Checkbox",
  YES_NO: "Yes/No",
  FILE: "File Upload",
  SIGNATURE: "Signature",
};

export function ImportFormModal({ open, onOpenChange }: ImportFormModalProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<unknown>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [customName, setCustomName] = useState("");

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (!selectedFile) return;

      // Reset state
      setFile(selectedFile);
      setPreview(null);
      setErrors([]);
      setWarnings([]);
      setImportData(null);

      // Read and parse the file
      setLoading(true);
      try {
        const text = await selectedFile.text();
        let data: unknown;

        try {
          data = JSON.parse(text);
        } catch {
          setErrors(["Invalid JSON file"]);
          setLoading(false);
          return;
        }

        setImportData(data);

        // Send to preview endpoint
        const response = await fetch("/api/forms/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data, preview: true }),
        });

        const result = await response.json();

        if (result.success) {
          setPreview(result.data.preview);
          setWarnings(result.data.validation.warnings || []);
          setCustomName(result.data.preview.form.name);
        } else {
          setErrors(result.validation?.errors || [result.error?.message || "Validation failed"]);
        }
      } catch (error) {
        setErrors(["Failed to read file"]);
        console.error(error);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleImport = async () => {
    if (!importData) return;

    setImporting(true);
    try {
      const response = await fetch("/api/forms/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: importData,
          preview: false,
          options: {
            name: customName || undefined,
          },
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Form imported successfully with ${result.data.fieldCount} fields`);
        onOpenChange(false);
        router.push(`/forms/${result.data.formId}/edit`);
      } else {
        setErrors(result.validation?.errors || [result.error?.message || "Import failed"]);
      }
    } catch (error) {
      toast.error("Failed to import form");
      console.error(error);
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setImportData(null);
    setPreview(null);
    setErrors([]);
    setWarnings([]);
    setCustomName("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Form</DialogTitle>
          <DialogDescription>
            Import a form from an exported JSON file. The form will be created as a
            new draft in your organization.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File input */}
          {!preview && (
            <div className="space-y-2">
              <Label htmlFor="import-file">Select File</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <input
                  type="file"
                  id="import-file"
                  accept=".json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="import-file"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {file ? file.name : "Click to select a .json file"}
                      </span>
                    </>
                  )}
                </label>
              </div>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside">
                  {errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Preview */}
          {preview && (
            <ScrollArea className="max-h-[40vh]">
              <div className="space-y-4">
                {/* Form name */}
                <div className="space-y-2">
                  <Label htmlFor="form-name">Form Name</Label>
                  <Input
                    id="form-name"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder={preview.form.name}
                  />
                </div>

                <Separator />

                {/* Form info */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{preview.form.name}</span>
                  </div>
                  <Badge variant="outline">{preview.form.type}</Badge>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Fields:</span>{" "}
                    <span className="font-medium">{preview.fieldCount}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Sections:</span>{" "}
                    <span className="font-medium">{preview.sections.length}</span>
                  </div>
                </div>

                {/* Field types */}
                <div>
                  <span className="text-sm text-muted-foreground">Field Types:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(preview.fieldTypes).map(([type, count]) => (
                      <Badge key={type} variant="secondary" className="text-xs">
                        {fieldTypeLabels[type] || type}: {count}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Sections */}
                {preview.sections.length > 0 && (
                  <div>
                    <span className="text-sm text-muted-foreground">Sections:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {preview.sections.map((section) => (
                        <Badge key={section} variant="outline" className="text-xs">
                          {section}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warnings */}
                {warnings.length > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <ul className="list-disc list-inside text-sm">
                        {warnings.map((warning, i) => (
                          <li key={i}>{warning}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Validation success */}
                {errors.length === 0 && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>File validated successfully</span>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          {preview ? (
            <>
              <Button variant="outline" onClick={handleReset}>
                Choose Different File
              </Button>
              <Button onClick={handleImport} disabled={importing || errors.length > 0}>
                {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Import Form
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
