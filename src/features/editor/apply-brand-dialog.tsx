"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { SwatchBook } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useEditorStore } from "@/features/editor/store";
import type { ProjectData } from "@/types/project";

type BrandRow = { id: string; name: string };

export function ApplyBrandButton() {
  const editorMode = useEditorStore((s) => s.editorMode);
  const projectId = useEditorStore((s) => s.projectId);
  const variationId = useEditorStore((s) => s.variationId);
  const data = useEditorStore((s) => s.data);
  const brandId = useEditorStore((s) => s.brandId);
  const brandName = useEditorStore((s) => s.brandName);
  const applyBrand = useEditorStore((s) => s.applyBrand);
  const [open, setOpen] = useState(false);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setListLoading(true);
    void fetch("/api/templates")
      .then((r) => r.json())
      .then((payload) => {
        const list = (payload.templates ?? payload.brands ?? []) as BrandRow[];
        setBrands(list);
        setSelectedId(brandId || list[0]?.id || "");
      })
      .catch(() => toast.error("Failed to load templates"))
      .finally(() => setListLoading(false));
  }, [open, brandId]);

  if (editorMode !== "playable") return null;

  async function patchBrand(nextBrandId: string | null) {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/variations/${variationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: nextBrandId,
          projectData: data,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to apply template");
        return;
      }
      const payload = (await res.json()) as {
        variation: { brandId: string | null; brand: { id: string; name: string } | null };
        resolved: ProjectData;
      };
      applyBrand({
        brandId: payload.variation.brandId,
        brandName: payload.variation.brand?.name ?? null,
        data: payload.resolved,
        unlockedSlotIds: [],
      });
      toast.success(
        payload.variation.brand
          ? `Applied ${payload.variation.brand.name}`
          : "Template unlinked",
      );
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <SwatchBook className="h-4 w-4" />
        {brandName ? "Change template" : "Apply template"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{brandName ? "Change template" : "Apply template"}</DialogTitle>
            <DialogDescription>
              Live-link a personal template to this playable. Logos, CTAs, and store URLs update here and
              stay in sync when you edit the template. You can customize individual layers on this playable.
            </DialogDescription>
          </DialogHeader>
          {listLoading ? (
            <p className="text-sm text-muted">Loading templates...</p>
          ) : brands.length === 0 ? (
            <p className="text-sm text-muted">
              No templates yet.{" "}
              <Link href="/templates" className="text-accent underline">
                Create one
              </Link>{" "}
              then come back.
            </p>
          ) : (
            <div className="space-y-1">
              <Label>Template</Label>
              <select
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.id === brandId ? " (current)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            {brandId ? (
              <Button
                variant="ghost"
                disabled={loading}
                onClick={() => void patchBrand(null)}
              >
                Remove template
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void patchBrand(selectedId || null)}
              disabled={loading || listLoading || !selectedId}
            >
              {loading ? "Applying..." : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
