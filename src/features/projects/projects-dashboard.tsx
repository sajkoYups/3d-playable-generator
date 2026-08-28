"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Copy, FolderOpen, Plus, Search, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateProjectDialog } from "@/features/projects/create-project-dialog";
import { TEMPLATE_BLURBS, TEMPLATE_NAMES } from "@/lib/project-defaults";
import type { TemplateId } from "@/types/project";
import { TemplateGlyph } from "@/features/projects/template-glyph";

type ProjectRow = {
  id: string;
  name: string;
  templateId: string;
  thumbnailUrl: string | null;
  status: string;
  updatedAt: string | Date;
};

export function ProjectsDashboard({
  projects,
  initialQuery,
}: {
  projects: ProjectRow[];
  initialQuery: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [createOpen, setCreateOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, query]);

  async function duplicateProject(id: string) {
    const res = await fetch(`/api/projects/${id}/duplicate`, { method: "POST" });
    if (!res.ok) {
      toast.error("Failed to duplicate");
      return;
    }
    toast.success("Project duplicated");
    router.refresh();
  }

  async function deleteProject(id: string) {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("Project deleted");
    router.refresh();
  }

  async function renameProject(id: string) {
    const res = await fetch(`/api/projects/${id}`, {
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">Workshop</h1>
          <p className="text-sm text-muted">Four locked 3D engines. You dress the stage and ship the HTML.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New playable
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          className="pl-9"
          placeholder="Search projects..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            const params = new URLSearchParams();
            if (e.target.value) params.set("q", e.target.value);
            router.replace(`/projects?${params.toString()}`);
          }}
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <p className="text-muted">No projects yet. Pick a template and start dressing a scene.</p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Create project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => (
            <Card key={project.id} className="overflow-hidden">
              <div className="relative h-36 bg-[#161821]">
                <TemplateGlyph templateId={project.templateId as TemplateId} />
              </div>
              <CardHeader>
                {renamingId === project.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void renameProject(project.id);
                    }}
                  >
                    <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
                  </form>
                ) : (
                  <CardTitle className="truncate">{project.name}</CardTitle>
                )}
                <div className="flex items-center gap-2">
                  <Badge>{TEMPLATE_NAMES[project.templateId as TemplateId] || project.templateId}</Badge>
                  <span className="text-[11px] text-muted">
                    {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
                  </span>
                </div>
              </CardHeader>
              <CardFooter className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => router.push(`/projects/${project.id}/editor`)}>
                  <FolderOpen className="h-3.5 w-3.5" />
                  Open
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setRenamingId(project.id);
                    setRenameValue(project.name);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => duplicateProject(project.id)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => deleteProject(project.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
