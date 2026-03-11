"use client";

/**
 * Model Card
 *
 * Card displaying model information with quick actions.
 */

import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  FileText,
  Tags,
  Globe,
  Building2,
  ChevronRight,
  Calendar,
  Layers,
} from "lucide-react";
import type { Model, ModelType } from "@/lib/ml-services";

interface ModelCardProps {
  model: Model;
  versionCount?: number;
  deployedVersion?: number;
}

const MODEL_TYPE_CONFIG: Record<ModelType, { icon: React.ReactNode; label: string }> = {
  llm: { icon: <Brain className="h-5 w-5" />, label: "LLM" },
  extraction: { icon: <FileText className="h-5 w-5" />, label: "Extraction" },
  classification: { icon: <Tags className="h-5 w-5" />, label: "Classification" },
};

export function ModelCard({ model, versionCount, deployedVersion }: ModelCardProps) {
  const router = useRouter();
  const typeConfig = MODEL_TYPE_CONFIG[model.model_type];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => router.push(`/settings/ml/models/${model.id}`)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              {typeConfig.icon}
            </div>
            <div>
              <CardTitle className="text-lg">{model.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">{typeConfig.label}</Badge>
                {model.is_global ? (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Globe className="h-3 w-3" />
                    Global
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Building2 className="h-3 w-3" />
                    Org
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="line-clamp-2 mb-4">
          {model.description || "No description provided"}
        </CardDescription>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            {versionCount !== undefined && (
              <div className="flex items-center gap-1">
                <Layers className="h-4 w-4" />
                <span>{versionCount} versions</span>
              </div>
            )}
            {deployedVersion !== undefined && (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                v{deployedVersion} deployed
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>{formatDate(model.created_at)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
