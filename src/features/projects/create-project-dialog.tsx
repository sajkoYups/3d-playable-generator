"use client";

import { useState } from "react";
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
import type { Orientation, TemplateId } from "@/types/project";
import { TEMPLATE_BLURBS, TEMPLATE_NAMES } from "@/lib/project-defaults";
import { TemplateGlyph } from "@/features/projects/template-glyph";

const TEMPLATES: TemplateId[] = ["stack-tower", "triple-match", "lane-runner", "parking-jam", "tower-defense"];

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
  const [appStoreUrl, setAppStoreUrl] = useState("");
  const [googlePlayUrl, setGooglePlayUrl] = useState("");
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
        appStoreUrl,
        googlePlayUrl,
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
    router.push(`/projects/${project.id}/editor`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New playable</DialogTitle>
          <DialogDescription>Choose a 3D engine, then dress start / game / end screens.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Project name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {TEMPLATES.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setTemplateId(id)}
                className={`overflow-hidden rounded-lg border text-left transition ${
                  templateId === id ? "border-accent" : "border-border hover:border-[#4a5164]"
                }`}
              >
                <div className="h-20 bg-[#161821]">
                  <TemplateGlyph templateId={id} />
                </div>
                <div className="p-3">
                  <div className="text-sm font-medium">{TEMPLATE_NAMES[id]}</div>
                  <div className="mt-1 text-xs text-muted">{TEMPLATE_BLURBS[id]}</div>
                </div>
              </button>
            ))}
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
          <div className="space-y-2">
            <Label>App Store URL (optional)</Label>
            <Input value={appStoreUrl} onChange={(e) => setAppStoreUrl(e.target.value)} placeholder="https://apps.apple.com/..." />
          </div>
          <div className="space-y-2">
            <Label>Google Play URL (optional)</Label>
            <Input value={googlePlayUrl} onChange={(e) => setGooglePlayUrl(e.target.value)} placeholder="https://play.google.com/..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={create} disabled={loading || !name.trim()}>
            {loading ? "Creating..." : "Create & open editor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
