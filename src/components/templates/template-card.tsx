"use client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Star, Users, Copy, Trash2, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface Template {
  id: string;
  name: string;
  description?: string | null;
  tags: string[];
  thumbnail?: string | null;
  useCaseExamples: string[];
  isSystemTemplate: boolean;
  usageCount: number;
  fieldCount: number;
  createdAt: string;
}

interface TemplateCardProps {
  template: Template;
  onUse: (template: Template) => void;
  onPreview: (template: Template) => void;
  onDelete?: (template: Template) => void;
}

export function TemplateCard({ template, onUse, onPreview, onDelete }: TemplateCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">{template.name}</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            {template.isSystemTemplate && (
              <Badge variant="secondary" className="text-xs">
                <Star className="h-3 w-3 mr-1" />
                System
              </Badge>
            )}
            {onDelete && !template.isSystemTemplate && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => onDelete(template)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        {template.description && (
          <CardDescription className="line-clamp-2">
            {template.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="pb-3">
        <div className="flex flex-wrap gap-1 mb-3">
          {template.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
          {template.tags.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{template.tags.length - 3}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <FileText className="h-4 w-4" />
            <span>{template.fieldCount} fields</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{template.usageCount} uses</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-3 border-t gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => onPreview(template)}
        >
          Preview
        </Button>
        <Button
          size="sm"
          className="flex-1"
          onClick={() => onUse(template)}
        >
          <Copy className="h-4 w-4 mr-1" />
          Use Template
        </Button>
      </CardFooter>
    </Card>
  );
}
