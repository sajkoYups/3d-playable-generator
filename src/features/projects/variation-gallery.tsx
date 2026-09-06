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
import { Card, CardContent } from "@/components/ui/card";
import { TEMPLATE_NAMES } from "@/lib/project-defaults";
import { TemplateGlyph } from "@/features/projects/template-glyph";
import { AddFromBrandDialog } from "@/features/projects/add-from-brand-dialog";
import { ApplyAppBrandButton } from "@/features/editor/apply-app-brand-dialog";
import { is2DTemplate, type TemplateId } from "@/types/project";

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
  const dimension = is2DTemplate(project.templateId) ? "2D" : "3D";

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
      <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
        <Link href="/projects" className="hover:text-foreground">
          Playable projects
        </Link>
        <span aria-hidden>/</span>
        <span className="text-muted">{dimension} games</span>
        <span aria-hidden>/</span>
        <span className="truncate text-foreground">{project.name}</span>
      </nav>

      <div className="overflow-hidden rounded-xl border border-accent/50 bg-card shadow-sm ring-1 ring-accent/20">
        <div className="flex flex-col sm:flex-row">
          <div className="relative h-36 shrink-0 overflow-hidden bg-elevated sm:h-auto sm:w-56">
            <span className="absolute inset-y-0 left-0 z-10 w-1.5 bg-accent" />
            <TemplateGlyph templateId={project.templateId} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="min-w-0 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
                You’re in this project
              </p>
              <h1 className="truncate font-[family-name:var(--font-display)] text-3xl tracking-tight">
                {project.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-accent-muted text-accent">{dimension}</Badge>
                <Badge>{TEMPLATE_NAMES[project.templateId]}</Badge>
                <span className="text-sm text-muted">
                  {variations.length} {variations.length === 1 ? "variation" : "variations"}
                </span>
              </div>
            </div>
            <Button onClick={() => setAddOpen(true)} className="w-fit shrink-0">
              <Plus className="h-4 w-4" />
              Add another
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4 border-l-2 border-accent/30 pl-4 sm:pl-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl tracking-tight">
              Variations of {project.name}
            </h2>
            <p className="text-sm text-muted">Each one is a dressed version of this game.</p>
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
              <p className="text-muted">No variations match. Add a regular one, or stamp a template.</p>
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" />
                Add another
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {filtered.map((variation) => {
              const preview = variation.brandLogo || variation.appBrandIcon || variation.thumbnailUrl;
              return (
                <Card
                  key={variation.id}
                  className="cursor-pointer transition hover:border-accent/40"
                  onClick={() => router.push(`/projects/${project.id}/variations/${variation.id}/editor`)}
                >
                  <div className="flex gap-4 p-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-elevated">
                      {preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={preview} alt="" className="h-full w-full object-contain p-1.5" />
                      ) : (
                        <span className="text-lg font-semibold text-muted">
                          {variation.name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        {renamingId === variation.id ? (
                          <form
                            className="min-w-0 flex-1"
                            onClick={(e) => e.stopPropagation()}
                            onSubmit={(e) => {
                              e.preventDefault();
                              void renameVariation(variation.id);
                            }}
                          >
                            <Input
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              autoFocus
                            />
                          </form>
                        ) : (
                          <h3 className="truncate font-[family-name:var(--font-display)] text-base font-semibold">
                            {variation.name}
                          </h3>
                        )}
                        <Badge className="shrink-0 bg-accent-muted text-accent">Variation</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                        {variation.brandName ? (
                          <Badge>{variation.brandName}</Badge>
                        ) : (
                          <span>No template</span>
                        )}
                        {variation.appBrandName ? (
                          <Badge className="bg-elevated text-accent-2">{variation.appBrandName}</Badge>
                        ) : (
                          <span>No brand</span>
                        )}
                        <span>{formatDistanceToNow(new Date(variation.updatedAt), { addSuffix: true })}</span>
                      </div>
                      <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          onClick={() =>
                            router.push(`/projects/${project.id}/variations/${variation.id}/editor`)
                          }
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
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <AddFromBrandDialog projectId={project.id} open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
