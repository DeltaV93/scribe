"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CredentialStatus } from "@prisma/client";
import {
  Award,
  Calendar,
  Building2,
  MoreVertical,
  Pencil,
  Trash2,
  RefreshCw,
  FileText,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";

interface CredentialCardProps {
  credential: {
    id: string;
    name: string;
    issuingOrg: string | null;
    issueDate: string | Date | null;
    expiryDate: string | Date | null;
    status: CredentialStatus;
    documentUrl: string | null;
    notes: string | null;
    daysUntilExpiry: number | null;
  };
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onRenew?: (id: string) => void;
  showActions?: boolean;
}

const statusConfig: Record<
  CredentialStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }
> = {
  ACTIVE: { label: "Active", variant: "default" },
  EXPIRING: { label: "Expiring Soon", variant: "outline", className: "border-yellow-500 text-yellow-600" },
  EXPIRED: { label: "Expired", variant: "destructive" },
};

export function CredentialCard({
  credential,
  onEdit,
  onDelete,
  onRenew,
  showActions = true,
}: CredentialCardProps) {
  const issueDate = credential.issueDate ? new Date(credential.issueDate) : null;
  const expiryDate = credential.expiryDate ? new Date(credential.expiryDate) : null;
  const statusInfo = statusConfig[credential.status];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            {credential.name}
          </CardTitle>
          {credential.issuingOrg && (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {credential.issuingOrg}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusInfo.variant} className={statusInfo.className}>
            {statusInfo.label}
          </Badge>
          {showActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(credential.id)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onRenew && (
                  <DropdownMenuItem onClick={() => onRenew(credential.id)}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Renew
                  </DropdownMenuItem>
                )}
                {credential.documentUrl && (
                  <DropdownMenuItem asChild>
                    <a href={credential.documentUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View Document
                    </a>
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem onClick={() => onDelete(credential.id)} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {issueDate && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Issued: {format(issueDate, "MMM d, yyyy")}</span>
            </div>
          )}
          {expiryDate && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Expires: {format(expiryDate, "MMM d, yyyy")}</span>
            </div>
          )}
        </div>

        {credential.daysUntilExpiry !== null && credential.daysUntilExpiry >= 0 && (
          <div
            className={`mt-2 text-sm ${
              credential.daysUntilExpiry <= 7
                ? "text-destructive"
                : credential.daysUntilExpiry <= 30
                  ? "text-yellow-600"
                  : "text-muted-foreground"
            }`}
          >
            {credential.daysUntilExpiry === 0
              ? "Expires today"
              : credential.daysUntilExpiry === 1
                ? "Expires tomorrow"
                : `Expires in ${credential.daysUntilExpiry} days`}
          </div>
        )}

        {credential.daysUntilExpiry !== null && credential.daysUntilExpiry < 0 && (
          <div className="mt-2 text-sm text-destructive">
            Expired {Math.abs(credential.daysUntilExpiry)} days ago
          </div>
        )}

        {credential.documentUrl && (
          <div className="mt-2 flex items-center gap-1 text-sm text-primary">
            <FileText className="h-3 w-3" />
            <span>Document attached</span>
          </div>
        )}

        {credential.notes && (
          <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{credential.notes}</p>
        )}
      </CardContent>
    </Card>
  );
}
