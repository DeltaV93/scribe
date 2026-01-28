"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SheetConfigFormProps {
  programId: string;
  initialConfig?: {
    includeTimeInOut: boolean;
    includeClientSignature: boolean;
    includeNotes: boolean;
    customInstructions: string | null;
  };
  onSave?: () => void;
}

export function SheetConfigForm({
  programId,
  initialConfig,
  onSave,
}: SheetConfigFormProps) {
  const [config, setConfig] = useState({
    includeTimeInOut: initialConfig?.includeTimeInOut ?? true,
    includeClientSignature: initialConfig?.includeClientSignature ?? true,
    includeNotes: initialConfig?.includeNotes ?? true,
    customInstructions: initialConfig?.customInstructions ?? "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/programs/${programId}/attendance-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          includeTimeInOut: config.includeTimeInOut,
          includeClientSignature: config.includeClientSignature,
          includeNotes: config.includeNotes,
          customInstructions: config.customInstructions || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save configuration");
      }

      toast.success("Attendance sheet configuration saved");
      onSave?.();
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error("Failed to save configuration");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="includeTimeInOut">Time In/Out Columns</Label>
            <p className="text-sm text-muted-foreground">
              Include columns for recording arrival and departure times
            </p>
          </div>
          <Switch
            id="includeTimeInOut"
            checked={config.includeTimeInOut}
            onCheckedChange={(checked) =>
              setConfig((prev) => ({ ...prev, includeTimeInOut: checked }))
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="includeClientSignature">Signature Column</Label>
            <p className="text-sm text-muted-foreground">
              Include a column for client signatures
            </p>
          </div>
          <Switch
            id="includeClientSignature"
            checked={config.includeClientSignature}
            onCheckedChange={(checked) =>
              setConfig((prev) => ({ ...prev, includeClientSignature: checked }))
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="includeNotes">Notes Column</Label>
            <p className="text-sm text-muted-foreground">
              Include a column for additional notes
            </p>
          </div>
          <Switch
            id="includeNotes"
            checked={config.includeNotes}
            onCheckedChange={(checked) =>
              setConfig((prev) => ({ ...prev, includeNotes: checked }))
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="customInstructions">Custom Instructions</Label>
        <Textarea
          id="customInstructions"
          placeholder="Add any custom instructions to appear on the attendance sheet..."
          value={config.customInstructions}
          onChange={(e) =>
            setConfig((prev) => ({
              ...prev,
              customInstructions: e.target.value,
            }))
          }
          maxLength={500}
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          {config.customInstructions.length}/500 characters
        </p>
      </div>

      <Button onClick={handleSave} disabled={isSaving} className="w-full">
        {isSaving ? "Saving..." : "Save Configuration"}
      </Button>
    </div>
  );
}
