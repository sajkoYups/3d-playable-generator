"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Copy, FolderOpen, Lock, Plus, Search, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateProjectDialog } from "@/features/projects/create-project-dialog";
import { TEMPLATE_NAMES } from "@/lib/project-defaults";
import { is2DTemplate, type TemplateId } from "@/types/project";
import { TemplateGlyph } from "@/features/projects/template-glyph";
import { UPCOMING_GAMES, type UpcomingGame } from "@/features/projects/upcoming-games";

type ProjectRow = {
  id: string;
  name: string;
  templateId: string;
  thumbnailUrl: string | null;
  status: string;
  updatedAt: string | Date;
  variationCount: number;
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

  const games3D = useMemo(
    () => filtered.filter((p) => p.templateId !== "tower-defense" && !is2DTemplate(p.templateId)),
    [filtered],
  );
  const games2D = useMemo(
    () => filtered.filter((p) => is2DTemplate(p.templateId)),
    [filtered],
  );

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
    if (!confirm("Delete this project and all of its variations? This cannot be undone.")) return;
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
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">All games</p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">Playable projects</h1>
          <p className="text-sm text-muted">
            Starter kits plus anything you create. Open a project to see its variations.
          </p>
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
          placeholder="Search playable projects..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            const params = new URLSearchParams();
            if (e.target.value) params.set("q", e.target.value);
            router.replace(`/projects?${params.toString()}`);
          }}
        />
      </div>

      <div className="space-y-10">
        {games3D.length === 0 && games2D.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <p className="text-muted">No playable projects yet. Pick a game engine and start dressing a scene.</p>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Create project
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {games3D.length > 0 ? (
              <ProjectSection title="3D games" hint="Scene-based engines">
                {games3D.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    renamingId={renamingId}
                    renameValue={renameValue}
                    onRenameValueChange={setRenameValue}
                    onRenameSubmit={() => void renameProject(project.id)}
                    onOpen={() => router.push(`/projects/${project.id}`)}
                    onStartRename={() => {
                      setRenamingId(project.id);
                      setRenameValue(project.name);
                    }}
                    onDuplicate={() => void duplicateProject(project.id)}
                    onDelete={() => void deleteProject(project.id)}
                  />
                ))}
              </ProjectSection>
            ) : null}
            {games2D.length > 0 ? (
              <ProjectSection title="2D games" hint="Canvas engines">
                {games2D.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    renamingId={renamingId}
                    renameValue={renameValue}
                    onRenameValueChange={setRenameValue}
                    onRenameSubmit={() => void renameProject(project.id)}
                    onOpen={() => router.push(`/projects/${project.id}`)}
                    onStartRename={() => {
                      setRenamingId(project.id);
                      setRenameValue(project.name);
                    }}
                    onDuplicate={() => void duplicateProject(project.id)}
                    onDelete={() => void deleteProject(project.id)}
                  />
                ))}
              </ProjectSection>
            ) : null}
          </>
        )}
        <ProjectSection title="Upcoming games" hint="In the works">
          {UPCOMING_GAMES.map((game) => (
            <ComingSoonCard key={game.id} game={game} />
          ))}
        </ProjectSection>
      </div>

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function ProjectSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl tracking-tight">{title}</h2>
        <p className="text-sm text-muted">{hint}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function ComingSoonCard({ game }: { game: UpcomingGame }) {
  return (
    <Card
      aria-disabled="true"
      className="pointer-events-none select-none overflow-hidden border-dashed opacity-80"
    >
      <div className="relative h-36 bg-elevated">
        <div className="opacity-40">
          <TemplateGlyph templateId={game.id} />
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card/65">
          <Lock className="h-5 w-5 text-muted" />
          <span className="rounded-md border border-dashed border-muted bg-card px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
            Coming soon
          </span>
        </div>
      </div>
      <CardHeader>
        <CardTitle className="truncate text-muted">{game.name}</CardTitle>
        <div className="flex items-center gap-2">
          <Badge className="bg-card text-muted">Upcoming</Badge>
          <span className="text-[11px] text-muted">{game.blurb}</span>
        </div>
      </CardHeader>
    </Card>
  );
}

function ProjectCard({
  project,
  renamingId,
  renameValue,
  onRenameValueChange,
  onRenameSubmit,
  onOpen,
  onStartRename,
  onDuplicate,
  onDelete,
}: {
  project: ProjectRow;
  renamingId: string | null;
  renameValue: string;
  onRenameValueChange: (value: string) => void;
  onRenameSubmit: () => void;
  onOpen: () => void;
  onStartRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="cursor-pointer overflow-hidden" onClick={onOpen}>
      <div className="relative h-36 bg-elevated">
        <TemplateGlyph templateId={project.templateId as TemplateId} />
      </div>
      <CardHeader>
        {renamingId === project.id ? (
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              onRenameSubmit();
            }}
          >
            <Input value={renameValue} onChange={(e) => onRenameValueChange(e.target.value)} autoFocus />
          </form>
        ) : (
          <CardTitle className="truncate">{project.name}</CardTitle>
        )}
        <div className="flex items-center gap-2">
          <Badge className="bg-card text-muted">Project</Badge>
          <Badge>{TEMPLATE_NAMES[project.templateId as TemplateId] || project.templateId}</Badge>
          <span className="text-[11px] text-muted">
            {project.variationCount} {project.variationCount === 1 ? "variation" : "variations"}
          </span>
          <span className="text-[11px] text-muted">
            {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
          </span>
        </div>
      </CardHeader>
      <CardFooter className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
        <Button size="sm" onClick={onOpen}>
          <FolderOpen className="h-3.5 w-3.5" />
          Open
        </Button>
        <Button size="sm" variant="outline" onClick={onStartRename}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="outline" onClick={onDuplicate}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </CardFooter>
    </Card>
  );
}
