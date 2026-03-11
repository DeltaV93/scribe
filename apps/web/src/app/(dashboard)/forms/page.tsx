import { getCurrentUser } from "@/lib/auth";
import { listForms } from "@/lib/services/forms";
import { redirect } from "next/navigation";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  FileText,
  MoreHorizontal,
  Pencil,
  Copy,
  Archive,
  Trash2,
  Users,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { FormsHeaderActions } from "@/components/forms/forms-header-actions";
import { FormStatus } from "@/types";

function getStatusBadge(status: FormStatus) {
  switch (status) {
    case FormStatus.DRAFT:
      return <Badge variant="secondary">Draft</Badge>;
    case FormStatus.PUBLISHED:
      return <Badge variant="default">Published</Badge>;
    case FormStatus.ARCHIVED:
      return <Badge variant="outline">Archived</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export default async function FormsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch forms from database
  const { forms } = await listForms(user.orgId, {
    pageSize: 50,
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Forms</h1>
          <p className="text-muted-foreground">
            Create and manage intake forms for your organization.
          </p>
        </div>
        <FormsHeaderActions canCreateForms={user.permissions.canCreateForms} />
      </div>

      {/* Forms List */}
      {forms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle className="text-lg mb-2">No forms yet</CardTitle>
            <CardDescription className="text-center mb-4">
              Get started by creating your first intake form.
            </CardDescription>
            {user.permissions.canCreateForms && (
              <Link href="/forms/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create your first form
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {forms.map((form) => (
            <Card key={form.id} className="group relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1 min-w-0">
                    <CardTitle className="text-base truncate">
                      {form.name}
                    </CardTitle>
                    <CardDescription className="line-clamp-2">
                      {form.description || "No description"}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {user.permissions.canUpdateForms && (
                        <DropdownMenuItem asChild>
                          <Link href={`/forms/${form.id}/edit`}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                      )}
                      {user.permissions.canCreateForms && (
                        <DropdownMenuItem asChild>
                          <Link href={`/forms/${form.id}/duplicate`}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </Link>
                        </DropdownMenuItem>
                      )}
                      {user.permissions.canDeleteForms && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">
                            <Archive className="h-4 w-4 mr-2" />
                            Archive
                          </DropdownMenuItem>
                          {form.status === FormStatus.DRAFT && (
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-3">
                  {getStatusBadge(form.status)}
                  <Badge variant="outline" className="text-xs">
                    v{form.version}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {form.fields.length} fields
                  </div>
                  <div className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    {form.fields.filter((f) => f.isAiExtractable).length} AI
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {form.submissionCount || 0}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mt-3">
                  Updated {formatDate(form.updatedAt)}
                </p>

                {user.permissions.canUpdateForms && (
                  <Link href={`/forms/${form.id}/edit`} className="block mt-4">
                    <Button variant="outline" size="sm" className="w-full">
                      <Pencil className="h-3 w-3 mr-2" />
                      Edit Form
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
