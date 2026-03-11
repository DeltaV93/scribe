"use client";

import { FieldPalette } from "../field-palette";
import { FormCanvas } from "../canvas";
import { FieldEditor } from "../field-editor";

export function FieldsStep() {
  return (
    <div className="grid grid-cols-12 gap-4 h-[calc(100vh-16rem)]">
      {/* Field Palette - Left */}
      <div className="col-span-3">
        <FieldPalette className="h-full" />
      </div>

      {/* Canvas - Center */}
      <div className="col-span-5">
        <FormCanvas className="h-full" />
      </div>

      {/* Field Editor - Right */}
      <div className="col-span-4">
        <FieldEditor className="h-full" />
      </div>
    </div>
  );
}
