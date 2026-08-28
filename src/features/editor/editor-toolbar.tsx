"use client";

import Link from "next/link";
import { Undo2, Redo2, Play, Download, RotateCcw, Settings } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useEditorStore } from "@/features/editor/store";
import { PlayablePreviewModal } from "@/features/editor/playable-preview-modal";
import { ExportDialog } from "@/features/export/export-dialog";
import { ProjectSettingsDialog } from "@/features/editor/project-settings-dialog";
import { startLoopMusic, stopLoopMusic } from "@/playable-runtime/audio/loop";

export function EditorToolbar() {
  const projectName = useEditorStore((s) => s.projectName);
  const setProjectName = useEditorStore((s) => s.setProjectName);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const setSaveStatus = useEditorStore((s) => s.setSaveStatus);
  const projectId = useEditorStore((s) => s.projectId);
  const data = useEditorStore((s) => s.data);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const past = useEditorStore((s) => s.past);
  const future = useEditorStore((s) => s.future);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  async function retrySave() {
    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: projectName, projectData: data }),
      });
      setSaveStatus(res.ok ? "saved" : "error");
    } catch {
      setSaveStatus("error");
    }
  }

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-3">
      <Link href="/projects" className="text-sm font-semibold text-muted hover:text-foreground">
        ← Workshop
      </Link>
      <Input
        className="h-8 max-w-[220px]"
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
      />
      <Badge
        className={
          saveStatus === "error"
            ? "bg-red-900/40 text-red-200"
            : saveStatus === "saving"
              ? "bg-amber-900/40 text-amber-200"
              : "bg-teal-900/40 text-teal-200"
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
        <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
          <Settings className="h-4 w-4" />
          Links
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const audio = data.gameplay.audio;
            const videoWins =
              data.startScreen.background.type === "video" && Boolean(data.startScreen.videoUrl);
            if (videoWins && data.startScreen.videoUrl) {
              startLoopMusic(data.startScreen.videoUrl);
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
