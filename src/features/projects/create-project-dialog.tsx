"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
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
import type { Orientation, TemplateId } from "@/types/project";
import { TEMPLATE_BLURBS, TEMPLATE_NAMES } from "@/lib/project-defaults";
import { TemplateGlyph } from "@/features/projects/template-glyph";
import { UPCOMING_GAMES, type UpcomingGame } from "@/features/projects/upcoming-games";

const TEMPLATES_3D: TemplateId[] = ["stack-tower", "triple-match", "lane-runner", "parking-jam"];
const TEMPLATES_2D: TemplateId[] = [
  "water-sort",
  "match-3",
  "solitaire",
  "domino",
  "tappy-plane",
  "racing-lap",
  "top-down-shooter",
];

function UpcomingTemplateCard({ game }: { game: UpcomingGame }) {
  return (
    <div
      aria-disabled="true"
      className="pointer-events-none select-none overflow-hidden rounded-lg border border-dashed border-muted text-left opacity-70"
    >
      <div className="relative h-20 bg-elevated">
        <div className="opacity-40">
          <TemplateGlyph templateId={game.id} />
        </div>
        <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-card/65">
          <Lock className="h-3.5 w-3.5 text-muted" />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Coming soon</span>
        </div>
      </div>
      <div className="p-3">
        <div className="text-sm font-medium text-muted">{game.name}</div>
        <div className="mt-1 text-xs text-muted">Coming soon</div>
      </div>
    </div>
  );
}

function TemplateCard({
  id,
  selected,
  onSelect,
}: {
  id: TemplateId;
  selected: boolean;
  onSelect: (id: TemplateId) => void;
}) {
  return (
    <button
      key={id}
      type="button"
      onClick={() => onSelect(id)}
      className={`overflow-hidden rounded-lg border text-left transition ${
        selected ? "border-accent" : "border-border hover:border-muted"
      }`}
    >
      <div className="h-20 bg-elevated">
        <TemplateGlyph templateId={id} />
      </div>
      <div className="p-3">
        <div className="text-sm font-medium">{TEMPLATE_NAMES[id]}</div>
        <div className="mt-1 text-xs text-muted">{TEMPLATE_BLURBS[id]}</div>
      </div>
    </button>
  );
}

export function CreateProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("Untitled Playable");
  const [templateId, setTemplateId] = useState<TemplateId>("stack-tower");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [loading, setLoading] = useState(false);

  async function create() {
    setLoading(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        templateId,
        defaultOrientation: orientation,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to create project");
      return;
    }
    const { project } = await res.json();
    onOpenChange(false);
    router.push(`/projects/${project.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New playable</DialogTitle>
          <DialogDescription>
            Choose a 3D or 2D engine. Store links live on Personal templates, then you stamp a template onto a variation.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Project name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>3D engines</Label>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATES_3D.map((id) => (
                <TemplateCard key={id} id={id} selected={templateId === id} onSelect={setTemplateId} />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>2D games</Label>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATES_2D.map((id) => (
                <TemplateCard key={id} id={id} selected={templateId === id} onSelect={setTemplateId} />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Upcoming games</Label>
            <div className="grid grid-cols-2 gap-2">
              {UPCOMING_GAMES.map((game) => (
                <UpcomingTemplateCard key={game.id} game={game} />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Default orientation</Label>
            <div className="flex gap-2">
              {(["portrait", "landscape"] as const).map((o) => (
                <Button
                  key={o}
                  type="button"
                  variant={orientation === o ? "default" : "outline"}
                  size="sm"
                  onClick={() => setOrientation(o)}
                  className="capitalize"
                >
                  {o}
                </Button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={create} disabled={loading || !name.trim()}>
            {loading ? "Creating..." : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
