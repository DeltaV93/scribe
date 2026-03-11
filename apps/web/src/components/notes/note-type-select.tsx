"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Lock, Globe } from "lucide-react";

export type NoteType = "INTERNAL" | "SHAREABLE";

interface NoteTypeSelectProps {
  value: NoteType;
  onChange: (value: NoteType) => void;
  disabled?: boolean;
}

export function NoteTypeSelect({
  value,
  onChange,
  disabled = false,
}: NoteTypeSelectProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="note-type">Note Type</Label>
      <Select
        value={value}
        onValueChange={(v) => onChange(v as NoteType)}
        disabled={disabled}
      >
        <SelectTrigger id="note-type" className="w-full">
          <SelectValue placeholder="Select note type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="INTERNAL">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col items-start">
                <span>Internal</span>
                <span className="text-xs text-muted-foreground">
                  Visible to staff only
                </span>
              </div>
            </div>
          </SelectItem>
          <SelectItem value="SHAREABLE">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col items-start">
                <span>Shareable</span>
                <span className="text-xs text-muted-foreground">
                  Requires approval before client sees
                </span>
              </div>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
