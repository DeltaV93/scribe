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
import { PlacementStatus } from "@prisma/client";
import { Briefcase, Calendar, DollarSign, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface PlacementCardProps {
  placement: {
    id: string;
    employerName: string;
    jobTitle: string;
    hourlyWage: string | number | null;
    startDate: string | Date;
    endDate: string | Date | null;
    status: PlacementStatus;
    notes: string | null;
  };
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onEndPlacement?: (id: string, status: "ENDED" | "TERMINATED") => void;
  showActions?: boolean;
}

const statusConfig: Record<PlacementStatus, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  ACTIVE: { label: "Active", variant: "default" },
  ENDED: { label: "Ended", variant: "secondary" },
  TERMINATED: { label: "Terminated", variant: "destructive" },
};

export function PlacementCard({
  placement,
  onEdit,
  onDelete,
  onEndPlacement,
  showActions = true,
}: PlacementCardProps) {
  const startDate = new Date(placement.startDate);
  const endDate = placement.endDate ? new Date(placement.endDate) : null;
  const statusInfo = statusConfig[placement.status];

  const duration = endDate
    ? formatDistanceToNow(startDate, { addSuffix: false })
    : formatDistanceToNow(startDate, { addSuffix: false });

  const formatWage = (wage: string | number | null) => {
    if (!wage) return null;
    const numWage = typeof wage === "string" ? parseFloat(wage) : wage;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(numWage);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">{placement.jobTitle}</CardTitle>
          <p className="text-sm text-muted-foreground">{placement.employerName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          {showActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(placement.id)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                {placement.status === "ACTIVE" && onEndPlacement && (
                  <>
                    <DropdownMenuItem onClick={() => onEndPlacement(placement.id, "ENDED")}>
                      End Placement
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onEndPlacement(placement.id, "TERMINATED")}
                      className="text-destructive"
                    >
                      Terminate Placement
                    </DropdownMenuItem>
                  </>
                )}
                {onDelete && (
                  <DropdownMenuItem onClick={() => onDelete(placement.id)} className="text-destructive">
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
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              {format(startDate, "MMM d, yyyy")}
              {endDate && ` - ${format(endDate, "MMM d, yyyy")}`}
            </span>
          </div>
          {placement.hourlyWage && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              <span>{formatWage(placement.hourlyWage)}/hr</span>
            </div>
          )}
        </div>
        {placement.status === "ACTIVE" && (
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Briefcase className="h-4 w-4" />
            <span>Employed for {duration}</span>
          </div>
        )}
        {placement.notes && (
          <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{placement.notes}</p>
        )}
      </CardContent>
    </Card>
  );
}
