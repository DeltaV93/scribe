"use client";

import { useState } from "react";
import { Package, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FORM_PACKS } from "@/lib/billing/types";

export function FormPacks() {
  const [loading, setLoading] = useState<string | null>(null);

  const handlePurchase = async (packId: string) => {
    setLoading(packId);
    try {
      const response = await fetch("/api/billing/form-packs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.sessionUrl) {
          window.location.href = data.sessionUrl;
        }
      }
    } catch (error) {
      console.error("Failed to purchase form pack:", error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Package className="h-5 w-5" />
          Form Packs
        </h3>
        <p className="text-sm text-muted-foreground">
          Need more forms? Purchase additional form packs as one-time purchases.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {FORM_PACKS.map((pack) => (
          <Card key={pack.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{pack.name}</CardTitle>
              <CardDescription>{pack.forms} additional forms</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-bold">
                ${pack.price}
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}one-time
                </span>
              </div>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => handlePurchase(pack.id)}
                disabled={loading !== null}
              >
                {loading === pack.id ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Purchase
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
