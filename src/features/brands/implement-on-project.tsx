"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useEditorStore } from "@/features/editor/store";

type ProjectRow = { id: string; name: string; templateId: string };

export function ImplementOnProjectButton() {
  const brandId = useEditorStore((s) => s.brandId);
  const editorMode = useEditorStore((s) => s.editorMode);
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectId, setProjectId] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    setListLoading(true);
    void fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        const list = (data.projects ?? []) as ProjectRow[];
        setProjects(list);
        setProjectId((current) => current || list[0]?.id || "");
      })
      .catch(() => toast.error("Failed to load projects"))
      .finally(() => setListLoading(false));
  }, [open]);

  if (editorMode !== "brand" || !brandId) return null;

  async function implement() {
    if (!projectId) {
      toast.error("Create a project first");
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
      toast.error(data.error || "Failed to implement");
      return;
    }
    const { variation } = await res.json();
    setOpen(false);
    router.push(`/projects/${projectId}/variations/${variation.id}/editor`);
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Implement on game
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Implement on a game</DialogTitle>
            <DialogDescription>
              Creates a new variation of the selected project, live-linked to this brand.
            </DialogDescription>
          </DialogHeader>
          {listLoading ? (
            <p className="text-sm text-muted">Loading projects...</p>
          ) : projects.length === 0 ? (
            <p className="text-sm text-muted">No projects yet. Create a game in Workshop first.</p>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Project</Label>
                <select
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Variation name (optional)</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Defaults to this brand" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void implement()} disabled={loading || listLoading || projects.length === 0}>
              {loading ? "Creating..." : "Create variation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
