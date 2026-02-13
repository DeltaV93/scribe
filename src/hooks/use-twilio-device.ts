"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Device, Call } from "@twilio/voice-sdk";

export type DeviceStatus = "offline" | "ready" | "busy" | "error";
export type CallStatus = "connecting" | "ringing" | "open" | "closed" | "pending";

export interface CallState {
  status: CallStatus;
  direction: "inbound" | "outbound" | null;
  duration: number;
  isMuted: boolean;
  isOnHold: boolean;
}

export interface UseTwilioDeviceReturn {
  deviceStatus: DeviceStatus;
  callState: CallState;
  error: string | null;
  isReady: boolean;
  isBusy: boolean;
  // Actions
  makeCall: (phoneNumber: string, params?: Record<string, string>) => Promise<void>;
  hangup: () => void;
  mute: (shouldMute?: boolean) => void;
  hold: () => Promise<void>;
  sendDigits: (digits: string) => void;
}

interface UseTwilioDeviceOptions {
  onIncomingCall?: (call: Call) => void;
  onCallDisconnected?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Hook for managing Twilio Voice SDK device in browser
 * Handles token refresh, call lifecycle, and device events
 */
export function useTwilioDevice(options?: UseTwilioDeviceOptions): UseTwilioDeviceReturn {
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>("offline");
  const [callState, setCallState] = useState<CallState>({
    status: "closed",
    direction: null,
    duration: 0,
    isMuted: false,
    isOnHold: false,
  });
  const [error, setError] = useState<string | null>(null);

  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const tokenTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch token from our API
  const fetchToken = useCallback(async (): Promise<string> => {
    const response = await fetch("/api/voice/token");
    if (!response.ok) {
      throw new Error("Failed to fetch voice token");
    }
    const data = await response.json();
    return data.data.token;
  }, []);

  // Initialize or update device with token
  const initializeDevice = useCallback(async () => {
    try {
      console.log("[TwilioDevice] Fetching token...");
      const token = await fetchToken();
      console.log("[TwilioDevice] Token fetched successfully");

      if (deviceRef.current) {
        // Update existing device
        console.log("[TwilioDevice] Updating existing device token");
        deviceRef.current.updateToken(token);
      } else {
        // Create new device
        console.log("[TwilioDevice] Creating new device...");
        const device = new Device(token, {
          codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
          allowIncomingWhileBusy: false,
          logLevel: "warn",
        });

        // Device event handlers
        device.on("registered", () => {
          console.log("[TwilioDevice] Device registered - setting status to ready");
          setDeviceStatus("ready");
          setError(null);
        });

        device.on("unregistered", () => {
          console.log("[TwilioDevice] Device unregistered");
          setDeviceStatus("offline");
        });

        device.on("error", (deviceError) => {
          console.error("[TwilioDevice] Device error:", deviceError);
          setError(deviceError.message || "Device error");
          setDeviceStatus("error");
          options?.onError?.(deviceError);
        });

        device.on("incoming", (call) => {
          console.log("[TwilioDevice] Incoming call");
          callRef.current = call;
          setCallState((prev) => ({
            ...prev,
            status: "ringing",
            direction: "inbound",
          }));
          options?.onIncomingCall?.(call);
          setupCallHandlers(call);
        });

        device.on("tokenWillExpire", async () => {
          console.log("[TwilioDevice] Token expiring, refreshing...");
          try {
            const newToken = await fetchToken();
            device.updateToken(newToken);
            console.log("[TwilioDevice] Token refreshed");
          } catch (err) {
            console.error("[TwilioDevice] Failed to refresh token:", err);
          }
        });

        console.log("[TwilioDevice] Registering device...");
        await device.register();
        console.log("[TwilioDevice] Device.register() completed");
        deviceRef.current = device;
      }

      // Schedule token refresh (45 minutes before expiry)
      if (tokenTimeoutRef.current) {
        clearTimeout(tokenTimeoutRef.current);
      }
      tokenTimeoutRef.current = setTimeout(
        async () => {
          try {
            const newToken = await fetchToken();
            deviceRef.current?.updateToken(newToken);
          } catch (err) {
            console.error("Failed to refresh token:", err);
          }
        },
        45 * 60 * 1000
      ); // 45 minutes
    } catch (err) {
      console.error("[TwilioDevice] Failed to initialize:", err);
      setError(err instanceof Error ? err.message : "Failed to initialize");
      setDeviceStatus("error");
    }
  }, [fetchToken, options, setupCallHandlers]);

  // Setup call event handlers
  const setupCallHandlers = useCallback(
    (call: Call) => {
      call.on("accept", () => {
        setCallState((prev) => ({ ...prev, status: "open" }));
        setDeviceStatus("busy");
        startDurationTimer();
      });

      call.on("disconnect", () => {
        setCallState({
          status: "closed",
          direction: null,
          duration: 0,
          isMuted: false,
          isOnHold: false,
        });
        setDeviceStatus("ready");
        callRef.current = null;
        stopDurationTimer();
        options?.onCallDisconnected?.();
      });

      call.on("cancel", () => {
        setCallState((prev) => ({ ...prev, status: "closed" }));
        setDeviceStatus("ready");
        callRef.current = null;
        stopDurationTimer();
      });

      call.on("reject", () => {
        setCallState((prev) => ({ ...prev, status: "closed" }));
        setDeviceStatus("ready");
        callRef.current = null;
      });

      call.on("error", (callError) => {
        console.error("Call error:", callError);
        setError(callError.message || "Call error");
      });

      call.on("mute", (isMuted: boolean) => {
        setCallState((prev) => ({ ...prev, isMuted }));
      });

      call.on("ringing", () => {
        setCallState((prev) => ({ ...prev, status: "ringing" }));
      });
    },
    [options]
  );

  // Duration timer
  const startDurationTimer = useCallback(() => {
    stopDurationTimer();
    const startTime = Date.now();
    durationIntervalRef.current = setInterval(() => {
      setCallState((prev) => ({
        ...prev,
        duration: Math.floor((Date.now() - startTime) / 1000),
      }));
    }, 1000);
  }, []);

  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  // Initialize device on mount
  useEffect(() => {
    initializeDevice();

    return () => {
      // Cleanup
      if (tokenTimeoutRef.current) {
        clearTimeout(tokenTimeoutRef.current);
      }
      stopDurationTimer();
      if (callRef.current) {
        callRef.current.disconnect();
      }
      if (deviceRef.current) {
        deviceRef.current.destroy();
        deviceRef.current = null;
      }
    };
  }, [initializeDevice, stopDurationTimer]);

  // Actions
  const makeCall = useCallback(
    async (phoneNumber: string, params?: Record<string, string>) => {
      console.log("[TwilioDevice] makeCall called:", { phoneNumber, params, deviceStatus, hasDevice: !!deviceRef.current });

      if (!deviceRef.current || deviceStatus !== "ready") {
        console.error("[TwilioDevice] makeCall failed - device not ready:", { deviceStatus, hasDevice: !!deviceRef.current });
        throw new Error("Device not ready");
      }

      setCallState((prev) => ({
        ...prev,
        status: "connecting",
        direction: "outbound",
      }));

      try {
        console.log("[TwilioDevice] Connecting call to:", phoneNumber);
        const call = await deviceRef.current.connect({
          params: {
            To: phoneNumber,
            ...params,
          },
        });
        console.log("[TwilioDevice] Call connected successfully");
        callRef.current = call;
        setupCallHandlers(call);
      } catch (err) {
        console.error("[TwilioDevice] Call connection failed:", err);
        setCallState((prev) => ({ ...prev, status: "closed" }));
        throw err;
      }
    },
    [deviceStatus, setupCallHandlers]
  );

  const hangup = useCallback(() => {
    if (callRef.current) {
      callRef.current.disconnect();
    }
  }, []);

  const mute = useCallback((shouldMute?: boolean) => {
    if (callRef.current) {
      const newMuteState = shouldMute ?? !callRef.current.isMuted();
      callRef.current.mute(newMuteState);
    }
  }, []);

  const hold = useCallback(async () => {
    if (!callRef.current) return;

    // Hold is implemented by muting and optionally playing hold music
    // For a proper hold, you'd transfer to a hold conference
    // This is a simplified implementation
    const isOnHold = callState.isOnHold;
    setCallState((prev) => ({ ...prev, isOnHold: !isOnHold }));

    // Mute when on hold
    if (!isOnHold) {
      callRef.current.mute(true);
    } else {
      callRef.current.mute(false);
    }
  }, [callState.isOnHold]);

  const sendDigits = useCallback((digits: string) => {
    if (callRef.current) {
      callRef.current.sendDigits(digits);
    }
  }, []);

  return {
    deviceStatus,
    callState,
    error,
    isReady: deviceStatus === "ready",
    isBusy: deviceStatus === "busy",
    makeCall,
    hangup,
    mute,
    hold,
    sendDigits,
  };
}
