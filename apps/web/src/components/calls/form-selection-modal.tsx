"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileText } from "lucide-react";

interface Form {
  id: string;
  name: string;
  type: string;
  description?: string;
}

interface FormSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (selectedFormIds: string[]) => void;
  clientName: string;
  isLoading?: boolean;
}

export function FormSelectionModal({
  open,
  onOpenChange,
  onConfirm,
  clientName,
  isLoading = false,
}: FormSelectionModalProps) {
  const [forms, setForms] = useState<Form[]>([]);
  const [selectedForms, setSelectedForms] = useState<Set<string>>(new Set());
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (open) {
      fetchForms();
    }
  }, [open]);

  const fetchForms = async () => {
    setIsFetching(true);
    try {
      const response = await fetch("/api/forms?status=PUBLISHED");
      if (response.ok) {
        const data = await response.json();
        setForms(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching forms:", error);
    } finally {
      setIsFetching(false);
    }
  };

  const toggleForm = (formId: string) => {
    const newSelected = new Set(selectedForms);
    if (newSelected.has(formId)) {
      newSelected.delete(formId);
    } else {
      newSelected.add(formId);
    }
    setSelectedForms(newSelected);
  };

  const handleConfirm = () => {
    if (isLoading) return; // Prevent double-click
    onConfirm(Array.from(selectedForms));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Select Forms for Call</DialogTitle>
          <DialogDescription>
            Choose which forms to fill during the call with {clientName}. The AI
            will extract information from the conversation to help populate these
            forms.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isFetching ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : forms.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No published forms available</p>
            </div>
          ) : (
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-3">
                {forms.map((form) => (
                  <div
                    key={form.id}
                    className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleForm(form.id)}
                  >
                    <Checkbox
                      id={form.id}
                      checked={selectedForms.has(form.id)}
                      onCheckedChange={() => toggleForm(form.id)}
                    />
                    <div className="flex-1">
                      <Label
                        htmlFor={form.id}
                        className="font-medium cursor-pointer"
                      >
                        {form.name}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {form.type}
                      </p>
                      {form.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {form.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading || isFetching}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? "Starting Call..." : `Start Call${selectedForms.size > 0 ? ` (${selectedForms.size} forms)` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
