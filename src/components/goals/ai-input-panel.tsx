"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, FileText, Upload, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface SuggestedDeliverable {
  name: string;
  description: string;
  metricType: string;
  targetValue: number;
  dueDate?: string;
  confidence: number;
}

interface AiInputPanelProps {
  onSuggestionsReceived: (suggestions: SuggestedDeliverable[]) => void;
}

export function AiInputPanel({ onSuggestionsReceived }: AiInputPanelProps) {
  const [pasteText, setPasteText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handlePasteSubmit = async () => {
    if (!pasteText.trim()) {
      toast.error("Please enter some text to analyze");
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch("/api/ai/parse-requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pasteText }),
      });

      if (!response.ok) {
        throw new Error("Failed to parse requirements");
      }

      const { data } = await response.json();
      onSuggestionsReceived(data.suggestions || []);
      toast.success(`Found ${data.suggestions?.length || 0} potential deliverables`);
    } catch (error) {
      console.error("Error parsing requirements:", error);
      toast.error("Failed to analyze text");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file first");
      return;
    }

    setIsProcessing(true);
    try {
      // Read file as text
      const text = await selectedFile.text();

      const response = await fetch("/api/ai/parse-requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, fileName: selectedFile.name }),
      });

      if (!response.ok) {
        throw new Error("Failed to parse requirements");
      }

      const { data } = await response.json();
      onSuggestionsReceived(data.suggestions || []);
      toast.success(`Found ${data.suggestions?.length || 0} potential deliverables`);
    } catch (error) {
      console.error("Error parsing file:", error);
      toast.error("Failed to analyze file");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          AI-Assisted Setup
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="paste">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="paste" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Paste Text
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload Document
            </TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="funder-text">
                Paste funder requirements, grant agreement, or contract text
              </Label>
              <Textarea
                id="funder-text"
                placeholder="Paste the relevant sections from your funder document here...

Example:
'The grantee shall serve a minimum of 100 individuals, with at least 80% completing the program. The grantee must achieve an 85% employment rate among completers...'"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                AI will extract deliverables, metrics, and deadlines from the text.
              </p>
            </div>
            <Button
              onClick={handlePasteSubmit}
              disabled={isProcessing || !pasteText.trim()}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Extract Deliverables
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="upload" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="document-upload">Upload document</Label>
              <Input
                id="document-upload"
                type="file"
                accept=".txt,.pdf,.doc,.docx"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-muted-foreground">
                Supported formats: TXT, PDF, DOC, DOCX (max 5MB)
              </p>
            </div>
            {selectedFile && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </div>
            )}
            <Button
              onClick={handleFileUpload}
              disabled={isProcessing || !selectedFile}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Extract Deliverables
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
