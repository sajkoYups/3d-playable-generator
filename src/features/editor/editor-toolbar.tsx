"use client";

import Link from "next/link";
import { Undo2, Redo2, Play, Download, RotateCcw, Settings } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useEditorStore } from "@/features/editor/store";
import { PlayablePreviewModal } from "@/features/editor/playable-preview-modal";
import { ExportDialog } from "@/features/export/export-dialog";
import { ProjectSettingsDialog } from "@/features/editor/project-settings-dialog";
import { ImplementOnProjectButton } from "@/features/brands/implement-on-project";
import { BrandUsedOnButton } from "@/features/brands/brand-used-on";
import { ApplyBrandButton } from "@/features/editor/apply-brand-dialog";
import { ApplyAppBrandButton } from "@/features/editor/apply-app-brand-dialog";
import { startLoopMusic, stopLoopMusic } from "@/playable-runtime/audio/loop";
import { projectDataToBrandData } from "@/lib/brand-defaults";
import { screenVideoUrl } from "@/types/project";

export function EditorToolbar() {
  const projectName = useEditorStore((s) => s.projectName);
  const setProjectName = useEditorStore((s) => s.setProjectName);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const setSaveStatus = useEditorStore((s) => s.setSaveStatus);
  const projectId = useEditorStore((s) => s.projectId);
  const variationId = useEditorStore((s) => s.variationId);
  const galleryName = useEditorStore((s) => s.galleryName);
  const data = useEditorStore((s) => s.data);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const past = useEditorStore((s) => s.past);
  const future = useEditorStore((s) => s.future);
  const editorMode = useEditorStore((s) => s.editorMode);
  const brandId = useEditorStore((s) => s.brandId);
  const brandName = useEditorStore((s) => s.brandName);
  const appBrandName = useEditorStore((s) => s.appBrandName);
  const orientation = useEditorStore((s) => s.orientation);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const backHref = editorMode === "brand" ? "/templates" : `/projects/${projectId}`;
  const backLabel = editorMode === "brand" ? "← Templates" : `← ${galleryName || "Project"}`;

  async function retrySave() {
    setSaveStatus("saving");
    try {
      const url =
        editorMode === "brand"
          ? `/api/templates/${brandId}`
          : `/api/projects/${projectId}/variations/${variationId}`;
      const body =
        editorMode === "brand"
          ? { name: projectName, brandData: projectDataToBrandData(data) }
          : { name: projectName, projectData: data, overrides: { unlockedSlotIds: useEditorStore.getState().unlockedSlotIds } };
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setSaveStatus(res.ok ? "saved" : "error");
    } catch {
      setSaveStatus("error");
    }
  }

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-3">
      <Link href={backHref} className="max-w-[180px] truncate text-sm font-semibold text-muted hover:text-foreground">
        {backLabel}
      </Link>
      <Input
        className="h-8 max-w-[220px]"
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
      />
      {editorMode === "playable" && brandName && (
        <Badge className="bg-accent-muted text-accent">From {brandName}</Badge>
      )}
      {editorMode === "playable" && appBrandName && (
        <Badge className="bg-elevated text-accent-2">Brand {appBrandName}</Badge>
      )}
      <Badge
        className={
          saveStatus === "error"
            ? "bg-destructive/15 text-destructive"
            : saveStatus === "saving"
              ? "bg-accent-muted text-accent"
              : "bg-accent-2/15 text-accent-2"
        }
      >
        {saveStatus === "idle" && "Ready"}
        {saveStatus === "saving" && "Saving..."}
        {saveStatus === "saved" && "Saved"}
        {saveStatus === "error" && "Save failed"}
      </Badge>
      {saveStatus === "error" && (
        <Button size="sm" variant="outline" onClick={retrySave}>
          <RotateCcw className="h-3.5 w-3.5" />
          Retry
        </Button>
      )}
      <div className="mx-1 h-6 w-px bg-border" />
      <Button size="sm" variant="ghost" onClick={undo} disabled={!past.length}>
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button size="sm" variant="ghost" onClick={redo} disabled={!future.length}>
        <Redo2 className="h-4 w-4" />
      </Button>
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        {editorMode === "brand" && (
          <>
            <BrandUsedOnButton />
            <ImplementOnProjectButton />
          </>
        )}
        {editorMode === "playable" && (
          <>
            <ApplyBrandButton />
            <ApplyAppBrandButton />
          </>
        )}
        <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
          <Settings className="h-4 w-4" />
          Links
        </Button>
        {editorMode === "playable" && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const audio = data.gameplay.audio;
                const startVideo = screenVideoUrl(data.startScreen, orientation);
                const videoWins =
                  data.startScreen.background.type === "video" && Boolean(startVideo);
                if (videoWins && startVideo) {
                  startLoopMusic(startVideo);
                } else if (audio.playFromStart && audio.musicUrl) {
                  startLoopMusic(audio.musicUrl);
                }
                setPreviewOpen(true);
              }}
            >
              <Play className="h-4 w-4" />
              Preview
            </Button>
            <Button size="sm" onClick={() => setExportOpen(true)}>
              <Download className="h-4 w-4" />
              Export
            </Button>
          </>
        )}
      </div>
      <PlayablePreviewModal
        open={previewOpen}
        onOpenChange={(open) => {
          if (!open) stopLoopMusic();
          setPreviewOpen(open);
        }}
      />
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      <ProjectSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </header>
  );
}
