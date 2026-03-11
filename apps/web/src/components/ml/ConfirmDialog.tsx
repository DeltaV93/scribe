"use client";

/**
 * Confirm Dialog
 *
 * Reusable confirmation dialog for dangerous ML operations.
 * Uses AlertDialog from shadcn/ui for accessibility.
 */

import { useState, ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, Rocket, RotateCcw, Trash2 } from "lucide-react";

type ConfirmVariant = "default" | "deploy" | "rollback" | "delete" | "warning";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Title of the dialog */
  title: string;
  /** Description/message to display */
  description: string | ReactNode;
  /** Confirm button text */
  confirmText?: string;
  /** Cancel button text */
  cancelText?: string;
  /** Variant determines styling and icon */
  variant?: ConfirmVariant;
  /** Callback when confirmed */
  onConfirm: () => void | Promise<void>;
  /** Whether the confirm action is loading */
  isLoading?: boolean;
  /** Disable the confirm button */
  disabled?: boolean;
}

const VARIANT_CONFIG: Record<
  ConfirmVariant,
  { icon: ReactNode; buttonClass: string; defaultConfirmText: string }
> = {
  default: {
    icon: <AlertTriangle className="h-5 w-5 text-muted-foreground" />,
    buttonClass: "",
    defaultConfirmText: "Confirm",
  },
  deploy: {
    icon: <Rocket className="h-5 w-5 text-purple-500" />,
    buttonClass: "bg-purple-600 hover:bg-purple-700",
    defaultConfirmText: "Deploy",
  },
  rollback: {
    icon: <RotateCcw className="h-5 w-5 text-yellow-500" />,
    buttonClass: "bg-yellow-600 hover:bg-yellow-700",
    defaultConfirmText: "Rollback",
  },
  delete: {
    icon: <Trash2 className="h-5 w-5 text-destructive" />,
    buttonClass: "bg-destructive hover:bg-destructive/90",
    defaultConfirmText: "Delete",
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
    buttonClass: "bg-yellow-600 hover:bg-yellow-700",
    defaultConfirmText: "Proceed",
  },
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  cancelText = "Cancel",
  variant = "default",
  onConfirm,
  isLoading,
  disabled,
}: ConfirmDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const config = VARIANT_CONFIG[variant];

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirm();
    } finally {
      setIsProcessing(false);
    }
  };

  const loading = isLoading || isProcessing;

  return (
    <AlertDialog open={open} onOpenChange={loading ? undefined : onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {config.icon}
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-muted-foreground">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={loading || disabled}
            className={config.buttonClass}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              confirmText || config.defaultConfirmText
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Hook to manage confirm dialog state
 */
interface UseConfirmDialogOptions {
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

interface ConfirmDialogState<T = unknown> {
  isOpen: boolean;
  data: T | null;
}

export function useConfirmDialog<T = unknown>() {
  const [state, setState] = useState<ConfirmDialogState<T>>({
    isOpen: false,
    data: null,
  });

  const open = (data?: T) => {
    setState({ isOpen: true, data: data ?? null });
  };

  const close = () => {
    setState({ isOpen: false, data: null });
  };

  const setOpen = (isOpen: boolean) => {
    if (!isOpen) {
      close();
    }
  };

  return {
    isOpen: state.isOpen,
    data: state.data,
    open,
    close,
    setOpen,
  };
}

/**
 * Pre-configured dialog for production deployment confirmation
 */
interface DeployConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versionNumber: number;
  environment: "staging" | "production";
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
}

export function DeployConfirmDialog({
  open,
  onOpenChange,
  versionNumber,
  environment,
  onConfirm,
  isLoading,
}: DeployConfirmDialogProps) {
  const isProduction = environment === "production";

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Deploy to ${environment}`}
      description={
        <div className="space-y-2">
          <p>
            You are about to deploy <strong>version {versionNumber}</strong> to{" "}
            <strong>{environment}</strong>.
          </p>
          {isProduction && (
            <div className="mt-3 p-3 rounded-md bg-yellow-50 border border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800">
              <p className="text-yellow-700 dark:text-yellow-400 font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Production Warning
              </p>
              <p className="text-yellow-600 dark:text-yellow-500 text-sm mt-1">
                This will affect live users. Make sure you have tested this
                version in staging first.
              </p>
            </div>
          )}
        </div>
      }
      variant="deploy"
      confirmText={isProduction ? "Deploy to Production" : "Deploy to Staging"}
      onConfirm={onConfirm}
      isLoading={isLoading}
    />
  );
}

/**
 * Pre-configured dialog for rollback confirmation
 */
interface RollbackConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versionNumber: number;
  environment: "staging" | "production";
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
}

export function RollbackConfirmDialog({
  open,
  onOpenChange,
  versionNumber,
  environment,
  onConfirm,
  isLoading,
}: RollbackConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Rollback to version ${versionNumber}`}
      description={
        <div className="space-y-2">
          <p>
            You are about to rollback <strong>{environment}</strong> to{" "}
            <strong>version {versionNumber}</strong>.
          </p>
          <p className="text-sm">
            This will route traffic away from the current version and deploy the
            selected version.
          </p>
        </div>
      }
      variant="rollback"
      confirmText={`Rollback ${environment}`}
      onConfirm={onConfirm}
      isLoading={isLoading}
    />
  );
}

/**
 * Pre-configured dialog for delete confirmation
 */
interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemType: string;
  itemName: string;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  itemType,
  itemName,
  onConfirm,
  isLoading,
}: DeleteConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete ${itemType}`}
      description={
        <div className="space-y-2">
          <p>
            Are you sure you want to delete <strong>{itemName}</strong>?
          </p>
          <p className="text-sm text-destructive">
            This action cannot be undone.
          </p>
        </div>
      }
      variant="delete"
      confirmText={`Delete ${itemType}`}
      onConfirm={onConfirm}
      isLoading={isLoading}
    />
  );
}
