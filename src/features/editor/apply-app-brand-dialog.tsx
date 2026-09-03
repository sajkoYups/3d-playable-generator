"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Tag } from "lucide-react";
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

type BrandRow = { id: string; name: string; brandData?: { appName?: string } };

export function ApplyAppBrandButton({
  projectId: projectIdProp,
  variationId: variationIdProp,
  appBrandId: appBrandIdProp,
  appBrandName: appBrandNameProp,
  onApplied,
}: {
  projectId?: string;
  variationId?: string;
  appBrandId?: string | null;
  appBrandName?: string | null;
  onApplied?: () => void;
} = {}) {
  const editorMode = useEditorStore((s) => s.editorMode);
  const storeProjectId = useEditorStore((s) => s.projectId);
  const storeVariationId = useEditorStore((s) => s.variationId);
  const data = useEditorStore((s) => s.data);
  const storeAppBrandId = useEditorStore((s) => s.appBrandId);
  const storeAppBrandName = useEditorStore((s) => s.appBrandName);
  const applyAppBrand = useEditorStore((s) => s.applyAppBrand);

  const projectId = projectIdProp ?? storeProjectId;
  const variationId = variationIdProp ?? storeVariationId;
  const appBrandId = appBrandIdProp !== undefined ? appBrandIdProp : storeAppBrandId;
  const appBrandName = appBrandNameProp !== undefined ? appBrandNameProp : storeAppBrandName;
  const inEditor = !projectIdProp;

  const [open, setOpen] = useState(false);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setListLoading(true);
    void fetch("/api/app-brands")
      .then((r) => r.json())
      .then((payload) => {
        const list = (payload.brands ?? []) as BrandRow[];
        setBrands(list);
        setSelectedId(appBrandId || list[0]?.id || "");
      })
      .catch(() => toast.error("Failed to load brands"))
      .finally(() => setListLoading(false));
  }, [open, appBrandId]);

  if (inEditor && editorMode !== "playable") return null;

  async function patchBrand(nextId: string | null) {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/variations/${variationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appBrandId: nextId,
          ...(inEditor ? { projectData: data } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to apply brand");
        return;
      }
      const payload = (await res.json()) as {
        variation: { appBrandId: string | null; appBrand: { id: string; name: string } | null };
        resolved: ProjectData;
      };
      if (inEditor) {
        applyAppBrand({
          appBrandId: payload.variation.appBrandId,
          appBrandName: payload.variation.appBrand?.name ?? null,
          data: payload.resolved,
        });
      }
      toast.success(
        payload.variation.appBrand
          ? `Applied ${payload.variation.appBrand.name}`
          : "Brand unlinked",
      );
      setOpen(false);
      onApplied?.();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Tag className="h-4 w-4" />
        {appBrandName ? "Change brand" : "Apply brand"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{appBrandName ? "Change brand" : "Apply brand"}</DialogTitle>
            <DialogDescription>
              Live-link a brand kit. Store URLs, logos, coin, disclaimer, and colors update on this
              playable when you edit the brand.
            </DialogDescription>
          </DialogHeader>
          {listLoading ? (
            <p className="text-sm text-muted">Loading brands...</p>
          ) : brands.length === 0 ? (
            <p className="text-sm text-muted">
              No brands yet.{" "}
              <Link href="/brands" className="text-accent underline">
                Create one
              </Link>{" "}
              then come back.
            </p>
          ) : (
            <div className="space-y-1">
              <Label>Brand</Label>
              <select
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.brandData?.appName || b.name}
                    {b.id === appBrandId ? " (current)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            {appBrandId ? (
              <Button variant="ghost" disabled={loading} onClick={() => void patchBrand(null)}>
                Remove brand
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
