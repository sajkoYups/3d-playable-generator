"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type BrandRow = { id: string; name: string };
type AddMode = "regular" | "template";

export function AddFromBrandDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<AddMode>("regular");
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [brandId, setBrandId] = useState<string>("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode("regular");
    setName("");
    setListLoading(true);
    void fetch("/api/templates")
      .then((r) => r.json())
      .then((data) => {
        const list = (data.templates ?? data.brands ?? []) as BrandRow[];
        setBrands(list);
        setBrandId(list[0]?.id || "");
      })
      .catch(() => toast.error("Failed to load templates"))
      .finally(() => setListLoading(false));
  }, [open]);

  const canCreate = mode === "regular" || Boolean(brandId);

  async function create() {
    if (mode === "template" && !brandId) {
      toast.error("Create a template first");
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/projects/${projectId}/variations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim() || undefined,
        ...(mode === "template" ? { brandId } : { brandId: null }),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to add variation");
      return;
    }
    const { variation } = await res.json();
    onOpenChange(false);
    router.push(`/projects/${projectId}/variations/${variation.id}/editor`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add another variation</DialogTitle>
          <DialogDescription>
            Start from this game as-is, or stamp a personal template for logos, CTAs, and store URLs.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("regular")}
              className={cn(
                "rounded-lg border px-3 py-3 text-left transition",
                mode === "regular" ? "border-accent" : "border-border hover:border-muted",
              )}
            >
              <div className="text-sm font-medium">Regular</div>
              <div className="mt-1 text-xs text-muted">This game as-is. No template.</div>
            </button>
            <button
              type="button"
              onClick={() => setMode("template")}
              className={cn(
                "rounded-lg border px-3 py-3 text-left transition",
                mode === "template" ? "border-accent" : "border-border hover:border-muted",
              )}
            >
              <div className="text-sm font-medium">From a template</div>
              <div className="mt-1 text-xs text-muted">Live-link a kit you already saved.</div>
            </button>
          </div>

          {mode === "template" ? (
            listLoading ? (
              <p className="text-sm text-muted">Loading templates...</p>
            ) : brands.length === 0 ? (
              <p className="text-sm text-muted">
                No templates yet.{" "}
                <Link href="/templates" className="text-accent underline">
                  Create one
                </Link>{" "}
                then come back, or use Regular instead.
              </p>
            ) : (
              <div className="space-y-1">
                <Label>Template</Label>
                <select
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                >
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )
          ) : null}

          <div className="space-y-1">
            <Label>Variation name (optional)</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={mode === "template" ? "Defaults to the template name" : "Untitled variation"}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={create} disabled={loading || (mode === "template" && (listLoading || !canCreate))}>
            {loading ? "Adding..." : "Create variation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
