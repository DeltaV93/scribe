"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, Check, Pen, Mic, FileText } from "lucide-react";

export type ConsentMethod = "DIGITAL" | "VERBAL" | "PRE_SIGNED";

interface RecordingConsentProps {
  clientName: string;
  onConsentComplete: (consent: {
    method: ConsentMethod;
    signature?: string;
    documentId?: string;
    acknowledgedAt: Date;
  }) => void;
  onCancel?: () => void;
  existingConsentDocumentId?: string;
}

export function RecordingConsent({
  clientName,
  onConsentComplete,
  onCancel,
  existingConsentDocumentId,
}: RecordingConsentProps) {
  const [method, setMethod] = useState<ConsentMethod>("VERBAL");
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Canvas drawing handlers
  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    lastPointRef.current = { x, y };
  }, []);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas || !lastPointRef.current) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    lastPointRef.current = { x, y };
    setHasSignature(true);
  }, [isDrawing]);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    lastPointRef.current = null;
  }, []);

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }, []);

  const getSignatureDataUrl = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    return canvas.toDataURL("image/png");
  }, []);

  const handleSubmit = () => {
    if (method === "DIGITAL" && !hasSignature) return;
    if (method === "PRE_SIGNED" && !existingConsentDocumentId) return;
    if (!acknowledged) return;

    onConsentComplete({
      method,
      signature: method === "DIGITAL" ? getSignatureDataUrl() : undefined,
      documentId: method === "PRE_SIGNED" ? existingConsentDocumentId : undefined,
      acknowledgedAt: new Date(),
    });
  };

  const canSubmit =
    acknowledged &&
    (method === "VERBAL" ||
      (method === "DIGITAL" && hasSignature) ||
      (method === "PRE_SIGNED" && existingConsentDocumentId));

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          Recording Consent Required
        </CardTitle>
        <CardDescription>
          Before recording this meeting with {clientName}, you must obtain their consent.
          Select how consent will be captured.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Consent Method Selection */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Consent Method</Label>
          <RadioGroup
            value={method}
            onValueChange={(v) => setMethod(v as ConsentMethod)}
            className="space-y-3"
          >
            <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="VERBAL" id="verbal" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="verbal" className="flex items-center gap-2 cursor-pointer font-medium">
                  <Mic className="h-4 w-4" />
                  Verbal Consent
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Client will state their consent at the beginning of the recording.
                  The first 10 seconds will capture their verbal acknowledgment.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="DIGITAL" id="digital" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="digital" className="flex items-center gap-2 cursor-pointer font-medium">
                  <Pen className="h-4 w-4" />
                  Digital Signature
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Client signs on this device to provide written consent.
                </p>
              </div>
            </div>

            {existingConsentDocumentId && (
              <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="PRE_SIGNED" id="pre-signed" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="pre-signed" className="flex items-center gap-2 cursor-pointer font-medium">
                    <FileText className="h-4 w-4" />
                    Pre-Signed Consent
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Reference existing consent document on file (from intake).
                  </p>
                </div>
              </div>
            )}
          </RadioGroup>
        </div>

        {/* Digital Signature Canvas */}
        {method === "DIGITAL" && (
          <div className="space-y-3">
            <Label className="text-base font-medium">Client Signature</Label>
            <div className="border rounded-lg p-2 bg-white">
              <canvas
                ref={canvasRef}
                width={500}
                height={150}
                className="w-full border border-dashed border-gray-300 rounded cursor-crosshair touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {hasSignature ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <Check className="h-4 w-4" /> Signature captured
                  </span>
                ) : (
                  "Sign above using mouse or touch"
                )}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearSignature}
                disabled={!hasSignature}
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* Acknowledgment */}
        <div className="space-y-3 pt-4 border-t">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="acknowledge"
              checked={acknowledged}
              onCheckedChange={(checked) => setAcknowledged(checked === true)}
            />
            <Label htmlFor="acknowledge" className="text-sm cursor-pointer leading-relaxed">
              I confirm that {clientName} has been informed that this meeting will be
              recorded, has been told how the recording will be used, and has given their
              consent to be recorded.
            </Label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            Start Recording
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
