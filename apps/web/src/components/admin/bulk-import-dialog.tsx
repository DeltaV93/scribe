"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Upload,
  FileText,
  Download,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Team {
  id: string;
  name: string;
  memberCount: number;
}

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: Team[];
  onSuccess: () => void;
}

interface ParsedRow {
  rowNumber: number;
  email: string;
  name: string;
  role: string;
  team: string;
  maxCaseload: string;
  errors: string[];
  isValid: boolean;
}

interface ColumnMapping {
  email: string;
  name: string;
  role: string;
  team: string;
  maxCaseload: string;
}

interface ImportResult {
  email: string;
  name: string;
  success: boolean;
  error?: string;
}

type ImportStep = "upload" | "mapping" | "preview" | "importing" | "results";

const VALID_ROLES = ["ADMIN", "PROGRAM_MANAGER", "CASE_MANAGER", "VIEWER"];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrator",
  PROGRAM_MANAGER: "Program Manager",
  CASE_MANAGER: "Case Manager",
  VIEWER: "Viewer",
};

const CSV_TEMPLATE = `email,name,role,team,maxCaseload
john@example.com,John Doe,CASE_MANAGER,Team A,25
jane@example.com,Jane Smith,PROGRAM_MANAGER,,
bob@example.com,Bob Wilson,VIEWER,,`;

export function BulkImportDialog({
  open,
  onOpenChange,
  teams,
  onSuccess,
}: BulkImportDialogProps) {
  const [step, setStep] = useState<ImportStep>("upload");
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    email: "",
    name: "",
    role: "",
    team: "",
    maxCaseload: "",
  });
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [fileName, setFileName] = useState<string>("");

  const resetState = () => {
    setStep("upload");
    setCsvData([]);
    setHeaders([]);
    setColumnMapping({
      email: "",
      name: "",
      role: "",
      team: "",
      maxCaseload: "",
    });
    setParsedRows([]);
    setIsSubmitting(false);
    setImportProgress(0);
    setImportResults([]);
    setFileName("");
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetState();
    }
    onOpenChange(open);
  };

  // Parse CSV manually (simple implementation)
  const parseCSV = (text: string): string[][] => {
    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
    return lines.map((line) => {
      const cells: string[] = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          cells.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      cells.push(current.trim());
      return cells;
    });
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);

      if (parsed.length < 2) {
        toast.error("CSV must have a header row and at least one data row");
        return;
      }

      const [headerRow, ...dataRows] = parsed;
      setHeaders(headerRow);
      setCsvData(dataRows);

      // Auto-detect column mapping
      const autoMapping: ColumnMapping = {
        email: "",
        name: "",
        role: "",
        team: "",
        maxCaseload: "",
      };

      headerRow.forEach((header, index) => {
        const lower = header.toLowerCase().trim();
        if (lower === "email" || lower === "email address") {
          autoMapping.email = String(index);
        } else if (lower === "name" || lower === "full name" || lower === "fullname") {
          autoMapping.name = String(index);
        } else if (lower === "role") {
          autoMapping.role = String(index);
        } else if (lower === "team" || lower === "team name") {
          autoMapping.team = String(index);
        } else if (
          lower === "maxcaseload" ||
          lower === "max caseload" ||
          lower === "caseload"
        ) {
          autoMapping.maxCaseload = String(index);
        }
      });

      setColumnMapping(autoMapping);
      setStep("mapping");
    };
    reader.readAsText(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".csv"],
    },
    maxFiles: 1,
  });

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "user-invite-template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const processMapping = () => {
    if (!columnMapping.email || !columnMapping.name) {
      toast.error("Email and Name columns are required");
      return;
    }

    const teamNameToId = new Map(teams.map((t) => [t.name.toLowerCase(), t.id]));

    const rows: ParsedRow[] = csvData.map((row, index) => {
      const errors: string[] = [];

      const email = row[parseInt(columnMapping.email)]?.trim() || "";
      const name = row[parseInt(columnMapping.name)]?.trim() || "";
      const role = columnMapping.role
        ? row[parseInt(columnMapping.role)]?.trim().toUpperCase() || ""
        : "";
      const team = columnMapping.team
        ? row[parseInt(columnMapping.team)]?.trim() || ""
        : "";
      const maxCaseload = columnMapping.maxCaseload
        ? row[parseInt(columnMapping.maxCaseload)]?.trim() || ""
        : "";

      // Validate email
      if (!email) {
        errors.push("Email is required");
      } else if (!validateEmail(email)) {
        errors.push("Invalid email format");
      }

      // Validate name
      if (!name) {
        errors.push("Name is required");
      }

      // Validate role if provided
      if (role && !VALID_ROLES.includes(role)) {
        errors.push(`Invalid role: ${role}. Must be one of: ${VALID_ROLES.join(", ")}`);
      }

      // Validate team if provided
      if (team && !teamNameToId.has(team.toLowerCase())) {
        errors.push(`Team not found: ${team}`);
      }

      // Validate maxCaseload if provided
      if (maxCaseload) {
        const caseloadNum = parseInt(maxCaseload);
        if (isNaN(caseloadNum) || caseloadNum <= 0) {
          errors.push("Max caseload must be a positive number");
        }
      }

      return {
        rowNumber: index + 2, // +2 for 1-based index and header row
        email,
        name,
        role: role || "CASE_MANAGER",
        team,
        maxCaseload,
        errors,
        isValid: errors.length === 0,
      };
    });

    // Check for duplicate emails
    const emailCounts = new Map<string, number[]>();
    rows.forEach((row, index) => {
      if (row.email) {
        const lower = row.email.toLowerCase();
        const indices = emailCounts.get(lower) || [];
        indices.push(index);
        emailCounts.set(lower, indices);
      }
    });

    emailCounts.forEach((indices, email) => {
      if (indices.length > 1) {
        indices.forEach((idx) => {
          rows[idx].errors.push(`Duplicate email: ${email}`);
          rows[idx].isValid = false;
        });
      }
    });

    setParsedRows(rows);
    setStep("preview");
  };

  const handleSubmit = async () => {
    const validRows = parsedRows.filter((row) => row.isValid);
    if (validRows.length === 0) {
      toast.error("No valid rows to import");
      return;
    }

    setIsSubmitting(true);
    setStep("importing");
    setImportProgress(0);

    const teamNameToId = new Map(teams.map((t) => [t.name.toLowerCase(), t.id]));

    const invitations = validRows.map((row) => ({
      email: row.email,
      name: row.name,
      role: row.role as "ADMIN" | "PROGRAM_MANAGER" | "CASE_MANAGER" | "VIEWER",
      teamId: row.team ? teamNameToId.get(row.team.toLowerCase()) : undefined,
      maxCaseload: row.maxCaseload ? parseInt(row.maxCaseload) : undefined,
    }));

    try {
      // Simulate progress for UX
      const progressInterval = setInterval(() => {
        setImportProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch("/api/admin/users/invite/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitations }),
      });

      clearInterval(progressInterval);
      setImportProgress(100);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send invitations");
      }

      // Map results
      const results: ImportResult[] = [
        ...data.results.successful.map((s: { email: string; name: string }) => ({
          email: s.email,
          name: s.name,
          success: true,
        })),
        ...data.results.failed.map(
          (f: { email: string; name: string; error: string }) => ({
            email: f.email,
            name: f.name,
            success: false,
            error: f.error,
          })
        ),
      ];

      setImportResults(results);
      setStep("results");

      if (data.results.summary.sent > 0) {
        toast.success(
          `Sent ${data.results.summary.sent} invitation${data.results.summary.sent !== 1 ? "s" : ""}`
        );
        onSuccess();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send invitations");
      setStep("preview");
    } finally {
      setIsSubmitting(false);
    }
  };

  const validRowCount = parsedRows.filter((row) => row.isValid).length;
  const invalidRowCount = parsedRows.filter((row) => !row.isValid).length;
  const successCount = importResults.filter((r) => r.success).length;
  const failedCount = importResults.filter((r) => !r.success).length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Import Users</DialogTitle>
          <DialogDescription>
            {step === "upload" && "Upload a CSV file to invite multiple users at once."}
            {step === "mapping" && "Map your CSV columns to the required fields."}
            {step === "preview" && "Review the data before sending invitations."}
            {step === "importing" && "Sending invitations..."}
            {step === "results" && "Import complete."}
          </DialogDescription>
        </DialogHeader>

        {/* Upload Step */}
        {step === "upload" && (
          <div className="space-y-4 py-4">
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              )}
            >
              <input {...getInputProps()} />
              <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
              {isDragActive ? (
                <p className="text-sm text-primary">Drop your CSV file here...</p>
              ) : (
                <>
                  <p className="text-sm font-medium">
                    Drag & drop a CSV file here, or click to select
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    CSV files only, max 100 users per import
                  </p>
                </>
              )}
            </div>

            <div className="flex items-center justify-center">
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Download Template
              </Button>
            </div>

            <div className="bg-muted rounded-lg p-4 text-xs space-y-2">
              <p className="font-medium">Expected CSV format:</p>
              <pre className="text-muted-foreground overflow-x-auto">
                {CSV_TEMPLATE}
              </pre>
              <p className="text-muted-foreground">
                <strong>Required:</strong> email, name |{" "}
                <strong>Optional:</strong> role (defaults to CASE_MANAGER), team,
                maxCaseload
              </p>
              <p className="text-muted-foreground">
                <strong>Valid roles:</strong> ADMIN, PROGRAM_MANAGER, CASE_MANAGER,
                VIEWER
              </p>
            </div>
          </div>
        )}

        {/* Mapping Step */}
        {step === "mapping" && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>{fileName}</span>
              <span>({csvData.length} rows)</span>
            </div>

            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Email Column <span className="text-destructive">*</span>
                  </label>
                  <Select
                    value={columnMapping.email}
                    onValueChange={(value) =>
                      setColumnMapping({ ...columnMapping, email: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {headers.map((header, index) => (
                        <SelectItem key={index} value={String(index)}>
                          {header || `Column ${index + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Name Column <span className="text-destructive">*</span>
                  </label>
                  <Select
                    value={columnMapping.name}
                    onValueChange={(value) =>
                      setColumnMapping({ ...columnMapping, name: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {headers.map((header, index) => (
                        <SelectItem key={index} value={String(index)}>
                          {header || `Column ${index + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role Column</label>
                  <Select
                    value={columnMapping.role}
                    onValueChange={(value) =>
                      setColumnMapping({ ...columnMapping, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Not mapped" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Not mapped</SelectItem>
                      {headers.map((header, index) => (
                        <SelectItem key={index} value={String(index)}>
                          {header || `Column ${index + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Team Column</label>
                  <Select
                    value={columnMapping.team}
                    onValueChange={(value) =>
                      setColumnMapping({ ...columnMapping, team: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Not mapped" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Not mapped</SelectItem>
                      {headers.map((header, index) => (
                        <SelectItem key={index} value={String(index)}>
                          {header || `Column ${index + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Max Caseload Column</label>
                  <Select
                    value={columnMapping.maxCaseload}
                    onValueChange={(value) =>
                      setColumnMapping({ ...columnMapping, maxCaseload: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Not mapped" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Not mapped</SelectItem>
                      {headers.map((header, index) => (
                        <SelectItem key={index} value={String(index)}>
                          {header || `Column ${index + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Preview of first 3 rows */}
            <div className="bg-muted rounded-lg p-4">
              <p className="text-xs font-medium mb-2">Preview (first 3 rows):</p>
              <div className="text-xs overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Email</TableHead>
                      <TableHead className="text-xs">Name</TableHead>
                      <TableHead className="text-xs">Role</TableHead>
                      <TableHead className="text-xs">Team</TableHead>
                      <TableHead className="text-xs">Max Caseload</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvData.slice(0, 3).map((row, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-xs">
                          {columnMapping.email
                            ? row[parseInt(columnMapping.email)] || "-"
                            : "-"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {columnMapping.name
                            ? row[parseInt(columnMapping.name)] || "-"
                            : "-"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {columnMapping.role
                            ? row[parseInt(columnMapping.role)] || "-"
                            : "-"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {columnMapping.team
                            ? row[parseInt(columnMapping.team)] || "-"
                            : "-"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {columnMapping.maxCaseload
                            ? row[parseInt(columnMapping.maxCaseload)] || "-"
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}

        {/* Preview Step */}
        {step === "preview" && (
          <div className="space-y-4 py-4 flex-1 min-h-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  {validRowCount} valid
                </Badge>
                {invalidRowCount > 0 && (
                  <Badge variant="outline" className="gap-1 border-red-200 text-red-700">
                    <XCircle className="h-3 w-3" />
                    {invalidRowCount} invalid
                  </Badge>
                )}
              </div>
            </div>

            <ScrollArea className="h-[300px] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Row</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Caseload</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row, index) => (
                    <TableRow
                      key={index}
                      className={cn(!row.isValid && "bg-red-50")}
                    >
                      <TableCell className="text-xs text-muted-foreground">
                        {row.rowNumber}
                      </TableCell>
                      <TableCell className="text-sm">{row.email || "-"}</TableCell>
                      <TableCell className="text-sm">{row.name || "-"}</TableCell>
                      <TableCell className="text-sm">
                        <Badge variant="secondary" className="text-xs">
                          {ROLE_LABELS[row.role] || row.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{row.team || "-"}</TableCell>
                      <TableCell className="text-sm">
                        {row.maxCaseload || "-"}
                      </TableCell>
                      <TableCell>
                        {row.isValid ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <div className="flex items-center gap-1">
                            <AlertCircle className="h-4 w-4 text-red-500" />
                            <span className="text-xs text-red-600 max-w-[150px] truncate">
                              {row.errors[0]}
                            </span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {invalidRowCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <AlertCircle className="h-4 w-4 inline mr-2" />
                {invalidRowCount} row{invalidRowCount !== 1 ? "s" : ""} will be
                skipped due to validation errors.
              </div>
            )}
          </div>
        )}

        {/* Importing Step */}
        {step === "importing" && (
          <div className="py-8 space-y-4">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-sm font-medium">Sending invitations...</p>
              <p className="text-xs text-muted-foreground mt-1">
                This may take a moment
              </p>
            </div>
            <Progress value={importProgress} className="h-2" />
          </div>
        )}

        {/* Results Step */}
        {step === "results" && (
          <div className="space-y-4 py-4 flex-1 min-h-0">
            <div className="flex items-center justify-center gap-8 py-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{successCount}</div>
                <div className="text-sm text-muted-foreground">Sent</div>
              </div>
              {failedCount > 0 && (
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">{failedCount}</div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
              )}
            </div>

            <ScrollArea className="h-[250px] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importResults.map((result, index) => (
                    <TableRow
                      key={index}
                      className={cn(!result.success && "bg-red-50")}
                    >
                      <TableCell className="text-sm">{result.email}</TableCell>
                      <TableCell className="text-sm">{result.name}</TableCell>
                      <TableCell>
                        {result.success ? (
                          <Badge
                            variant="outline"
                            className="gap-1 border-green-200 text-green-700"
                          >
                            <CheckCircle className="h-3 w-3" />
                            Sent
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="gap-1 border-red-200 text-red-700"
                          >
                            <XCircle className="h-3 w-3" />
                            {result.error || "Failed"}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
          )}

          {step === "mapping" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button onClick={processMapping}>Continue</Button>
            </>
          )}

          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("mapping")}>
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={validRowCount === 0 || isSubmitting}
              >
                Send {validRowCount} Invitation{validRowCount !== 1 ? "s" : ""}
              </Button>
            </>
          )}

          {step === "results" && (
            <Button onClick={() => handleOpenChange(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
