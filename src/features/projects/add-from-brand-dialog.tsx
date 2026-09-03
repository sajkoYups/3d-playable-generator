"use client";

import { useEffect, useState } from "react";
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

type BrandRow = { id: string; name: string };

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
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [brandId, setBrandId] = useState<string>("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setListLoading(true);
    void fetch("/api/templates")
      .then((r) => r.json())
      .then((data) => {
        const list = (data.templates ?? data.brands ?? []) as BrandRow[];
        setBrands(list);
        setBrandId((current) => current || list[0]?.id || "");
      })
      .catch(() => toast.error("Failed to load templates"))
      .finally(() => setListLoading(false));
  }, [open]);

  async function create() {
    if (!brandId) {
      toast.error("Create a template first");
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/projects/${projectId}/variations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId, name: name.trim() || undefined }),
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
          <DialogTitle>Add from template</DialogTitle>
          <DialogDescription>
            Clone this game’s latest gameplay and live-link a personal template for logos, CTAs, and store URLs.
          </DialogDescription>
        </DialogHeader>
        {listLoading ? (
          <p className="text-sm text-muted">Loading templates...</p>
        ) : brands.length === 0 ? (
          <p className="text-sm text-muted">
            No templates yet. Open Templates, save a kit, then come back.
          </p>
        ) : (
          <div className="space-y-3">
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
            <div className="space-y-1">
              <Label>Variation name (optional)</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Defaults to the template name"
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={create} disabled={loading || listLoading || brands.length === 0}>
            {loading ? "Adding..." : "Create variation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
