import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Mail } from "lucide-react";

export default function ExpiredPage() {
  return (
    <div className="container max-w-lg mx-auto py-8 px-4">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle>Link Expired or Invalid</CardTitle>
          <CardDescription>
            This portal link is no longer valid.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <p className="text-sm text-muted-foreground">
            Portal links expire after 24 hours for your security. If you need to access
            your messages or account, please contact your case manager for a new link.
          </p>

          <div className="rounded-lg bg-muted p-4">
            <div className="flex items-center justify-center gap-2 text-sm">
              <Mail className="h-4 w-4" />
              <span>Check your text messages for a new link</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            For security, do not share portal links with anyone else.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
