"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Copy, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { TEMPLATE_NAMES } from "@/lib/project-defaults";
import { TemplateGlyph } from "@/features/projects/template-glyph";
import { AddFromBrandDialog } from "@/features/projects/add-from-brand-dialog";
import { ApplyAppBrandButton } from "@/features/editor/apply-app-brand-dialog";
import type { TemplateId } from "@/types/project";

type VariationRow = {
  id: string;
  name: string;
  status: string;
  updatedAt: string | Date;
  thumbnailUrl: string | null;
  brandId: string | null;
  brandName: string | null;
  brandLogo: string | null;
  appBrandId: string | null;
  appBrandName: string | null;
  appBrandIcon: string | null;
};

export function VariationGallery({
  project,
  variations,
}: {
  project: {
    id: string;
    name: string;
    templateId: TemplateId;
    defaultOrientation: string;
  };
  variations: VariationRow[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return variations;
    return variations.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        (v.brandName && v.brandName.toLowerCase().includes(q)) ||
        (v.appBrandName && v.appBrandName.toLowerCase().includes(q)),
    );
  }, [variations, query]);

  async function duplicateVariation(vid: string) {
    const res = await fetch(`/api/projects/${project.id}/variations/${vid}/duplicate`, { method: "POST" });
    if (!res.ok) {
      toast.error("Failed to duplicate");
      return;
    }
    toast.success("Variation duplicated");
    router.refresh();
  }

  async function deleteVariation(vid: string) {
    if (!confirm("Delete this variation?")) return;
    const res = await fetch(`/api/projects/${project.id}/variations/${vid}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to delete");
      return;
    }
    toast.success("Variation deleted");
    router.refresh();
  }

  async function renameVariation(vid: string) {
    const res = await fetch(`/api/projects/${project.id}/variations/${vid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renameValue }),
    });
    if (!res.ok) {
      toast.error("Failed to rename");
      return;
    }
    setRenamingId(null);
    toast.success("Renamed");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Link href="/projects" className="text-sm text-muted hover:text-foreground">
          ← Playable projects
        </Link>
        <div className="flex flex-col gap-4 rounded-lg border border-accent/30 bg-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
              Playable project
            </p>
            <h1 className="truncate font-[family-name:var(--font-display)] text-3xl tracking-tight">
              {project.name}
            </h1>
            <p className="text-sm text-muted">
              This project · {TEMPLATE_NAMES[project.templateId]} · {variations.length}{" "}
              {variations.length === 1 ? "variation" : "variations"}
            </p>
          </div>
          <Button onClick={() => setAddOpen(true)} className="shrink-0">
            <Plus className="h-4 w-4" />
            Add from template
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Variations</h2>
            <p className="text-xs text-muted">Each card is a variation of this one project.</p>
          </div>
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              className="pl-9"
              placeholder="Search this project’s variations..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <p className="text-muted">No variations match. Stamp a personal template onto this game.</p>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              Add from template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((variation) => (
            <Card
              key={variation.id}
              className="cursor-pointer overflow-hidden"
              onClick={() => router.push(`/projects/${project.id}/variations/${variation.id}/editor`)}
            >
              <div className="relative flex h-36 items-center justify-center bg-elevated">
                {variation.brandLogo || variation.appBrandIcon || variation.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={variation.brandLogo || variation.appBrandIcon || variation.thumbnailUrl || ""}
                    alt=""
                    className="h-20 w-20 object-contain"
                  />
                ) : (
                  <TemplateGlyph templateId={project.templateId} />
                )}
              </div>
              <CardHeader>
                {renamingId === variation.id ? (
                  <form
                    onClick={(e) => e.stopPropagation()}
                    onSubmit={(e) => {
                      e.preventDefault();
                      void renameVariation(variation.id);
                    }}
                  >
                    <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
                  </form>
                ) : (
                  <CardTitle className="truncate">{variation.name}</CardTitle>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-card text-muted">Variation</Badge>
                  {variation.brandName ? (
                    <Badge>{variation.brandName}</Badge>
                  ) : (
                    <Badge className="bg-card text-muted">No template</Badge>
                  )}
                  {variation.appBrandName ? (
                    <Badge className="bg-elevated text-accent-2">{variation.appBrandName}</Badge>
                  ) : (
                    <Badge className="bg-card text-muted">No brand</Badge>
                  )}
                  <span className="text-[11px] text-muted">
                    {formatDistanceToNow(new Date(variation.updatedAt), { addSuffix: true })}
                  </span>
                </div>
              </CardHeader>
              <CardFooter className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                <Button
                  size="sm"
                  onClick={() => router.push(`/projects/${project.id}/variations/${variation.id}/editor`)}
                >
                  Open
                </Button>
                <ApplyAppBrandButton
                  projectId={project.id}
                  variationId={variation.id}
                  appBrandId={variation.appBrandId}
                  appBrandName={variation.appBrandName}
                  onApplied={() => router.refresh()}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setRenamingId(variation.id);
                    setRenameValue(variation.name);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => duplicateVariation(variation.id)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => deleteVariation(variation.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
      </div>

      <AddFromBrandDialog projectId={project.id} open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
