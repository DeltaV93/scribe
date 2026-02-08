import { WifiOff, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="mx-auto w-20 h-20 rounded-full bg-muted flex items-center justify-center">
          <WifiOff className="h-10 w-10 text-muted-foreground" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            You&apos;re Offline
          </h1>
          <p className="text-muted-foreground">
            It looks like you&apos;ve lost your internet connection. Some
            features may be limited until you&apos;re back online.
          </p>
        </div>

        <div className="space-y-3">
          <div className="p-4 rounded-lg bg-muted/50 text-left">
            <h3 className="font-medium text-sm mb-2">What you can still do:</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• View previously loaded clients and forms</li>
              <li>• Draft form submissions (will sync when online)</li>
              <li>• Read cached messages and notes</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button variant="outline" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            <Button asChild>
              <Link href="/dashboard">
                <Home className="h-4 w-4 mr-2" />
                Go to Dashboard
              </Link>
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Scrybe will automatically reconnect when your connection is restored.
        </p>
      </div>
    </div>
  );
}

export const metadata = {
  title: "Offline - Scrybe",
  description: "You are currently offline",
};
