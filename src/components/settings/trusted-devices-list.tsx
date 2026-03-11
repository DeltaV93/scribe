"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Monitor,
  Smartphone,
  Tablet,
  Trash2,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface TrustedDevice {
  id: string;
  deviceInfo: {
    browser: string;
    os: string;
    device: string;
    isMobile: boolean;
  };
  ipAddress: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string;
  isRevoked: boolean;
}

interface TrustedDevicesResponse {
  success: boolean;
  data?: {
    devices: TrustedDevice[];
    total: number;
    maxDevices: number;
  };
  error?: string;
}

function getDeviceIcon(device: string) {
  switch (device.toLowerCase()) {
    case "mobile":
      return <Smartphone className="h-5 w-5" />;
    case "tablet":
      return <Tablet className="h-5 w-5" />;
    default:
      return <Monitor className="h-5 w-5" />;
  }
}

function formatDeviceName(deviceInfo: TrustedDevice["deviceInfo"]) {
  return `${deviceInfo.browser} on ${deviceInfo.os}`;
}

export function TrustedDevicesList() {
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [maxDevices, setMaxDevices] = useState(5);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRevoking, setIsRevoking] = useState<string | null>(null);
  const [isRevokingAll, setIsRevokingAll] = useState(false);

  const fetchDevices = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/trusted-devices");
      const data: TrustedDevicesResponse = await response.json();

      if (data.success && data.data) {
        setDevices(data.data.devices);
        setMaxDevices(data.data.maxDevices);
      } else {
        setError(data.error || "Failed to load trusted devices");
      }
    } catch {
      setError("Failed to load trusted devices");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleRevokeDevice = async (deviceId: string) => {
    setIsRevoking(deviceId);

    try {
      const response = await fetch(`/api/auth/trusted-devices/${deviceId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        setDevices((prev) => prev.filter((d) => d.id !== deviceId));
      } else {
        setError(data.error || "Failed to revoke device");
      }
    } catch {
      setError("Failed to revoke device");
    } finally {
      setIsRevoking(null);
    }
  };

  const handleRevokeAllDevices = async () => {
    setIsRevokingAll(true);

    try {
      const response = await fetch("/api/auth/trusted-devices", {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        setDevices([]);
      } else {
        setError(data.error || "Failed to revoke all devices");
      }
    } catch {
      setError("Failed to revoke all devices");
    } finally {
      setIsRevokingAll(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Trusted Devices
          </CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Trusted Devices
            </CardTitle>
            <CardDescription>
              Devices that can skip two-factor authentication for 30 days.
              {devices.length > 0 && (
                <span className="ml-1">
                  ({devices.length}/{maxDevices} devices)
                </span>
              )}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDevices}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {devices.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ShieldCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No trusted devices</p>
            <p className="text-sm mt-1">
              Check &quot;Remember this device&quot; during MFA verification to add one.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {devices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      {getDeviceIcon(device.deviceInfo.device)}
                    </div>
                    <div>
                      <p className="font-medium">
                        {formatDeviceName(device.deviceInfo)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Last used{" "}
                        {formatDistanceToNow(new Date(device.lastUsedAt), {
                          addSuffix: true,
                        })}
                        {" · "}
                        Expires{" "}
                        {formatDistanceToNow(new Date(device.expiresAt), {
                          addSuffix: true,
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        IP: {device.ipAddress}
                      </p>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isRevoking === device.id}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Revoke trusted device?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove {formatDeviceName(device.deviceInfo)}{" "}
                          from your trusted devices. You will need to complete MFA
                          verification next time you log in from this device.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRevokeDevice(device.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Revoke
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full text-destructive hover:text-destructive"
                    disabled={isRevokingAll}
                  >
                    {isRevokingAll ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Revoking...
                      </>
                    ) : (
                      "Revoke All Trusted Devices"
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Revoke all trusted devices?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove all {devices.length} trusted devices. You
                      will need to complete MFA verification on every device next
                      time you log in.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleRevokeAllDevices}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Revoke All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
