"use client";

/**
 * Deploy Version Dialog
 *
 * Dialog for deploying a model version to an environment.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle, Rocket, Server, Cloud } from "lucide-react";

interface DeployVersionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versionNumber: number;
  onDeploy: (environment: "staging" | "production", trafficPercentage: number) => Promise<void>;
  isLoading?: boolean;
}

export function DeployVersionDialog({
  open,
  onOpenChange,
  versionNumber,
  onDeploy,
  isLoading,
}: DeployVersionDialogProps) {
  const [environment, setEnvironment] = useState<"staging" | "production">("staging");
  const [trafficPercentage, setTrafficPercentage] = useState(100);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onDeploy(environment, trafficPercentage);
  };

  const handleClose = () => {
    if (!isLoading) {
      onOpenChange(false);
      setEnvironment("staging");
      setTrafficPercentage(100);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[450px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              Deploy Version {versionNumber}
            </DialogTitle>
            <DialogDescription>
              Deploy this version to an environment with specified traffic allocation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Environment */}
            <div className="space-y-2">
              <Label htmlFor="environment">Environment</Label>
              <Select
                value={environment}
                onValueChange={(value) => setEnvironment(value as "staging" | "production")}
              >
                <SelectTrigger id="environment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staging">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4" />
                      <div>
                        <span className="font-medium">Staging</span>
                        <p className="text-xs text-muted-foreground">
                          Test environment for validation
                        </p>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="production">
                    <div className="flex items-center gap-2">
                      <Cloud className="h-4 w-4" />
                      <div>
                        <span className="font-medium">Production</span>
                        <p className="text-xs text-muted-foreground">
                          Live environment serving users
                        </p>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Traffic Percentage */}
            <div className="space-y-2">
              <Label htmlFor="traffic">Traffic Percentage</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="traffic"
                  type="number"
                  min={0}
                  max={100}
                  value={trafficPercentage}
                  onChange={(e) => setTrafficPercentage(Number(e.target.value))}
                  className="w-24"
                />
                <span className="text-muted-foreground">%</span>
                <div className="flex-1">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={trafficPercentage}
                    onChange={(e) => setTrafficPercentage(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Percentage of traffic to route to this version.
              </p>
            </div>

            {/* Warning for production */}
            {environment === "production" && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  You are deploying to production. This will affect live users.
                  Consider deploying to staging first.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4 mr-2" />
                  Deploy
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
