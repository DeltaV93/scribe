"use client"

import { useState } from "react"
import { Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

interface ExtractedField {
  fieldId: string
  fieldSlug: string
  fieldName: string
  fieldType: string
  value: string | number | boolean | string[] | null
  rawValue: string | null
  confidence: number
  reasoning?: string
  sourceSnippet?: string
  needsReview: boolean
  validationErrors: string[]
}

interface FieldMappingEditorProps {
  field: ExtractedField
  onSave: (value: string | number | boolean | string[] | null) => void
  onCancel: () => void
}

export function FieldMappingEditor({
  field,
  onSave,
  onCancel,
}: FieldMappingEditorProps) {
  const [value, setValue] = useState<string | number | boolean | string[] | null>(
    field.value
  )

  const handleSave = () => {
    onSave(value)
  }

  const renderInput = () => {
    switch (field.fieldType) {
      case "TEXT_LONG":
        return (
          <Textarea
            value={value as string || ""}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter value"
            className="min-h-[100px]"
          />
        )

      case "NUMBER":
        return (
          <Input
            type="number"
            value={value as number || ""}
            onChange={(e) =>
              setValue(e.target.value ? Number(e.target.value) : null)
            }
            placeholder="Enter number"
          />
        )

      case "DATE":
        return (
          <Input
            type="date"
            value={value as string || ""}
            onChange={(e) => setValue(e.target.value)}
          />
        )

      case "PHONE":
        return (
          <Input
            type="tel"
            value={value as string || ""}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter phone number"
          />
        )

      case "EMAIL":
        return (
          <Input
            type="email"
            value={value as string || ""}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter email"
          />
        )

      case "YES_NO":
        return (
          <div className="flex items-center gap-3">
            <Switch
              checked={value === true || value === "true"}
              onCheckedChange={(checked) => setValue(checked)}
            />
            <span className="text-sm">
              {value === true || value === "true" ? "Yes" : "No"}
            </span>
          </div>
        )

      case "DROPDOWN":
        // For dropdown without options, show text input
        return (
          <Input
            value={value as string || ""}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter value"
          />
        )

      case "CHECKBOX":
        // For checkboxes, handle as comma-separated text
        return (
          <div className="space-y-2">
            <Input
              value={Array.isArray(value) ? value.join(", ") : (value as string) || ""}
              onChange={(e) =>
                setValue(
                  e.target.value
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean)
                )
              }
              placeholder="Enter values separated by commas"
            />
            <p className="text-xs text-muted-foreground">
              Separate multiple values with commas
            </p>
          </div>
        )

      case "ADDRESS":
        return (
          <Textarea
            value={value as string || ""}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter address"
            className="min-h-[80px]"
          />
        )

      default:
        return (
          <Input
            value={value as string || ""}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter value"
          />
        )
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-muted-foreground">
          {field.fieldName} ({field.fieldType})
        </Label>
        {renderInput()}
      </div>

      {field.rawValue && (
        <div className="text-xs">
          <span className="text-muted-foreground">Original text: </span>
          <span className="italic">&quot;{field.rawValue}&quot;</span>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave}>
          <Check className="h-4 w-4 mr-1" />
          Save
        </Button>
      </div>
    </div>
  )
}

interface FieldMappingListProps {
  fields: ExtractedField[]
  onFieldUpdate: (fieldId: string, value: string | number | boolean | string[] | null) => void
  selectedFields: string[]
  onSelectionChange: (fieldIds: string[]) => void
}

export function FieldMappingList({
  fields,
  onFieldUpdate,
  selectedFields,
  onSelectionChange,
}: FieldMappingListProps) {
  const toggleField = (fieldId: string) => {
    if (selectedFields.includes(fieldId)) {
      onSelectionChange(selectedFields.filter((id) => id !== fieldId))
    } else {
      onSelectionChange([...selectedFields, fieldId])
    }
  }

  const selectAll = () => {
    onSelectionChange(fields.map((f) => f.fieldId))
  }

  const selectNone = () => {
    onSelectionChange([])
  }

  const selectHighConfidence = () => {
    onSelectionChange(
      fields.filter((f) => f.confidence >= 0.85).map((f) => f.fieldId)
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 text-sm">
        <Button variant="outline" size="sm" onClick={selectAll}>
          Select All
        </Button>
        <Button variant="outline" size="sm" onClick={selectNone}>
          Select None
        </Button>
        <Button variant="outline" size="sm" onClick={selectHighConfidence}>
          High Confidence Only
        </Button>
      </div>

      <div className="space-y-2">
        {fields.map((field) => (
          <div
            key={field.fieldId}
            className="flex items-center gap-3 p-3 rounded-lg border"
          >
            <Checkbox
              checked={selectedFields.includes(field.fieldId)}
              onCheckedChange={() => toggleField(field.fieldId)}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{field.fieldName}</p>
              <p className="text-xs text-muted-foreground truncate">
                {field.value !== null ? String(field.value) : "(no value)"}
              </p>
            </div>
            <div className="text-sm text-right">
              <span
                className={
                  field.confidence >= 0.85
                    ? "text-green-600"
                    : field.confidence >= 0.7
                      ? "text-yellow-600"
                      : "text-red-600"
                }
              >
                {Math.round(field.confidence * 100)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
