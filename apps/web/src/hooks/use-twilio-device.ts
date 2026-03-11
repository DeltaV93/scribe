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
  const initializingRef = useRef(false);
  const mountedRef = useRef(true);

  // Store options in ref to avoid dependency changes
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Duration timer functions
  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  const startDurationTimer = useCallback(() => {
    stopDurationTimer();
    const startTime = Date.now();
    durationIntervalRef.current = setInterval(() => {
      setCallState((prev) => ({
        ...prev,
        duration: Math.floor((Date.now() - startTime) / 1000),
      }));
    }, 1000);
  }, [stopDurationTimer]);

  // Setup call event handlers - using ref for options to keep stable
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
        optionsRef.current?.onCallDisconnected?.();
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
        console.error("[TwilioDevice] Call error:", callError);
        setError(callError.message || "Call error");
      });

      call.on("mute", (isMuted: boolean) => {
        setCallState((prev) => ({ ...prev, isMuted }));
      });

      call.on("ringing", () => {
        setCallState((prev) => ({ ...prev, status: "ringing" }));
      });
    },
    [startDurationTimer, stopDurationTimer]
  );

  // Initialize device on mount - empty dependency array for single initialization
  useEffect(() => {
    mountedRef.current = true;

    const initializeDevice = async () => {
      // Prevent multiple simultaneous initializations
      if (initializingRef.current) {
        console.log("[TwilioDevice] Skipping init - already initializing");
        return;
      }

      if (deviceRef.current) {
        console.log("[TwilioDevice] Skipping init - device already exists");
        return;
      }

      initializingRef.current = true;

      try {
        console.log("[TwilioDevice] Fetching token...");
        const response = await fetch("/api/voice/token");
        if (!response.ok) {
          throw new Error("Failed to fetch voice token");
        }
        const data = await response.json();
        const token = data.data.token;
        console.log("[TwilioDevice] Token fetched successfully");

        // Check if we should still proceed (component might have unmounted)
        if (!mountedRef.current) {
          console.log("[TwilioDevice] Component unmounted during token fetch, aborting");
          initializingRef.current = false;
          return;
        }

        // Check if device was created while we were fetching (race condition)
        if (deviceRef.current !== null) {
          console.log("[TwilioDevice] Device already exists, updating token instead");
          (deviceRef.current as Device).updateToken(token);
          initializingRef.current = false;
          return;
        }

        console.log("[TwilioDevice] Creating new device...");
        const device = new Device(token, {
          codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
          allowIncomingWhileBusy: false,
          logLevel: "warn",
        });

        // Store device reference BEFORE registering
        deviceRef.current = device;

        // Device event handlers
        device.on("registered", () => {
          console.log("[TwilioDevice] Device registered - setting status to ready");
          if (mountedRef.current) {
            setDeviceStatus("ready");
            setError(null);
          }
        });

        device.on("unregistered", () => {
          console.log("[TwilioDevice] Device unregistered");
          if (mountedRef.current) {
            setDeviceStatus("offline");
          }
        });

        device.on("error", (deviceError) => {
          console.error("[TwilioDevice] Device error:", deviceError);
          if (mountedRef.current) {
            setError(deviceError.message || "Device error");
            setDeviceStatus("error");
            optionsRef.current?.onError?.(deviceError);
          }
        });

        device.on("incoming", (call) => {
          console.log("[TwilioDevice] Incoming call");
          callRef.current = call;
          if (mountedRef.current) {
            setCallState((prev) => ({
              ...prev,
              status: "ringing",
              direction: "inbound",
            }));
            optionsRef.current?.onIncomingCall?.(call);
          }
        });

        device.on("tokenWillExpire", async () => {
          console.log("[TwilioDevice] Token expiring, refreshing...");
          try {
            const response = await fetch("/api/voice/token");
            if (response.ok) {
              const data = await response.json();
              device.updateToken(data.data.token);
              console.log("[TwilioDevice] Token refreshed");
            }
          } catch (err) {
            console.error("[TwilioDevice] Failed to refresh token:", err);
          }
        });

        console.log("[TwilioDevice] Registering device...");
        await device.register();
        console.log("[TwilioDevice] Device.register() completed");

        // Schedule token refresh (45 minutes before expiry)
        if (tokenTimeoutRef.current) {
          clearTimeout(tokenTimeoutRef.current);
        }
        tokenTimeoutRef.current = setTimeout(
          async () => {
            try {
              const response = await fetch("/api/voice/token");
              if (response.ok) {
                const data = await response.json();
                deviceRef.current?.updateToken(data.data.token);
              }
            } catch (err) {
              console.error("[TwilioDevice] Failed to refresh token:", err);
            }
          },
          45 * 60 * 1000
        );
      } catch (err) {
        console.error("[TwilioDevice] Failed to initialize:", err);
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : "Failed to initialize");
          setDeviceStatus("error");
        }
      } finally {
        initializingRef.current = false;
      }
    };

    initializeDevice();

    return () => {
      console.log("[TwilioDevice] Cleanup running");
      mountedRef.current = false;

      if (tokenTimeoutRef.current) {
        clearTimeout(tokenTimeoutRef.current);
        tokenTimeoutRef.current = null;
      }

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      if (callRef.current) {
        callRef.current.disconnect();
        callRef.current = null;
      }

      if (deviceRef.current) {
        deviceRef.current.destroy();
        deviceRef.current = null;
      }

      initializingRef.current = false;
    };
  }, []); // Empty dependency array - only run on mount/unmount

  // Actions
  const makeCall = useCallback(
    async (phoneNumber: string, params?: Record<string, string>) => {
      console.log("[TwilioDevice] makeCall called:", {
        phoneNumber,
        params,
        deviceStatus,
        hasDevice: !!deviceRef.current,
      });

      if (!deviceRef.current || deviceStatus !== "ready") {
        console.error("[TwilioDevice] makeCall failed - device not ready:", {
          deviceStatus,
          hasDevice: !!deviceRef.current,
        });
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

    const isOnHold = callState.isOnHold;
    setCallState((prev) => ({ ...prev, isOnHold: !isOnHold }));

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
