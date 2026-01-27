"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw, Image } from "lucide-react";

interface PhotoViewerProps {
  photoUrl: string;
  enhancedPhotoUrl?: string;
}

export function PhotoViewer({ photoUrl, enhancedPhotoUrl }: PhotoViewerProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showEnhanced, setShowEnhanced] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeUrl = showEnhanced && enhancedPhotoUrl ? enhancedPhotoUrl : photoUrl;

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale((s) => Math.max(0.5, Math.min(5, s + delta)));
    },
    []
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const resetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  if (!photoUrl) {
    return (
      <div className="flex items-center justify-center h-96 rounded-lg border bg-muted">
        <p className="text-muted-foreground">No photo available</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setScale((s) => Math.min(5, s + 0.25))}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={resetView}>
          <RotateCcw className="h-4 w-4" />
        </Button>
        {enhancedPhotoUrl && (
          <Button
            variant={showEnhanced ? "default" : "outline"}
            size="sm"
            className="h-8 ml-2"
            onClick={() => setShowEnhanced(!showEnhanced)}
          >
            <Image className="mr-1 h-3 w-3" />
            {showEnhanced ? "Enhanced" : "Original"}
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {Math.round(scale * 100)}%
        </span>
      </div>
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-lg border bg-muted h-[500px] cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={activeUrl}
          alt="Attendance sheet"
          className="absolute select-none"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: "0 0",
            maxWidth: "none",
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}
