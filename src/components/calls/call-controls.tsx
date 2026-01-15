"use client";

import { Button } from "@/components/ui/button";
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Pause,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CallControlsProps {
  isMuted: boolean;
  isOnHold: boolean;
  isConnected: boolean;
  onMuteToggle: () => void;
  onHoldToggle: () => void;
  onEndCall: () => void;
  disabled?: boolean;
}

export function CallControls({
  isMuted,
  isOnHold,
  isConnected,
  onMuteToggle,
  onHoldToggle,
  onEndCall,
  disabled = false,
}: CallControlsProps) {
  return (
    <div className="flex items-center justify-center gap-4 p-4 bg-background border-t">
      {/* Mute Button */}
      <Button
        variant={isMuted ? "destructive" : "secondary"}
        size="lg"
        className="rounded-full h-14 w-14"
        onClick={onMuteToggle}
        disabled={disabled || !isConnected}
        title={isMuted ? "Unmute (M)" : "Mute (M)"}
      >
        {isMuted ? (
          <MicOff className="h-6 w-6" />
        ) : (
          <Mic className="h-6 w-6" />
        )}
      </Button>

      {/* Hold Button */}
      <Button
        variant={isOnHold ? "warning" : "secondary"}
        size="lg"
        className={cn(
          "rounded-full h-14 w-14",
          isOnHold && "bg-yellow-500 hover:bg-yellow-600"
        )}
        onClick={onHoldToggle}
        disabled={disabled || !isConnected}
        title={isOnHold ? "Resume" : "Hold"}
      >
        {isOnHold ? (
          <Play className="h-6 w-6" />
        ) : (
          <Pause className="h-6 w-6" />
        )}
      </Button>

      {/* End Call Button */}
      <Button
        variant="destructive"
        size="lg"
        className="rounded-full h-14 w-14"
        onClick={onEndCall}
        disabled={disabled}
        title="End Call (E)"
      >
        <PhoneOff className="h-6 w-6" />
      </Button>
    </div>
  );
}

interface CallButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
}

export function StartCallButton({
  onClick,
  disabled = false,
  isLoading = false,
  className,
}: CallButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn("gap-2", className)}
    >
      <Phone className="h-4 w-4" />
      {isLoading ? "Connecting..." : "Start Call"}
    </Button>
  );
}
