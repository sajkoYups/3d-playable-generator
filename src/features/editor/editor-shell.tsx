"use client";

import { useEffect, useRef } from "react";
import { useEditorStore } from "@/features/editor/store";
import { EditorToolbar } from "@/features/editor/editor-toolbar";
import { LayersPanel } from "@/features/editor/layers-panel";
import { EditorCanvas } from "@/features/editor/editor-canvas";
import { PropertiesPanel } from "@/features/editor/properties-panel";
import type { Orientation, ProjectData, TemplateId } from "@/types/project";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function EditorShell({
  projectId,
  projectName,
  templateId,
  defaultOrientation,
  initialData,
}: {
  projectId: string;
  projectName: string;
  templateId: TemplateId;
  defaultOrientation: Orientation;
  initialData: ProjectData;
}) {
  const hydrate = useEditorStore((s) => s.hydrate);
  const stage = useEditorStore((s) => s.stage);
  const setStage = useEditorStore((s) => s.setStage);
  const orientation = useEditorStore((s) => s.orientation);
  const setOrientation = useEditorStore((s) => s.setOrientation);
  const data = useEditorStore((s) => s.data);
  const projectNameState = useEditorStore((s) => s.projectName);
  const setSaveStatus = useEditorStore((s) => s.setSaveStatus);
  const hydrated = useEditorStore((s) => s.hydrated);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipFirst = useRef(true);

  useEffect(() => {
    hydrate({
      projectId,
      projectName,
      templateId,
      data: initialData,
      defaultOrientation,
    });
  }, [hydrate, projectId, projectName, templateId, initialData, defaultOrientation]);

  useEffect(() => {
    if (!hydrated) return;
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setSaveStatus("saving");
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: projectNameState,
            projectData: data,
          }),
        });
        setSaveStatus(res.ok ? "saved" : "error");
      } catch {
        setSaveStatus("error");
      }
    }, 800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [data, projectNameState, projectId, hydrated, setSaveStatus]);

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted">
        Loading editor...
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#0e1016]">
      <EditorToolbar />
      <div className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-border bg-card px-4 py-2">
        <div className="justify-self-start">
          <Tabs value={stage} onValueChange={(v) => setStage(v as typeof stage)}>
            <TabsList>
              <TabsTrigger value="start">Start</TabsTrigger>
              <TabsTrigger value="gameplay">Gameplay</TabsTrigger>
              <TabsTrigger value="end">End</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <Tabs
          value={orientation}
          onValueChange={(v) => setOrientation(v as typeof orientation)}
        >
          <TabsList>
            <TabsTrigger value="portrait">Portrait</TabsTrigger>
            <TabsTrigger value="landscape">Landscape</TabsTrigger>
          </TabsList>
        </Tabs>
        <div />
      </div>
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-card">
          <LayersPanel />
        </aside>
        <main className="min-w-0 flex-1 overflow-hidden">
          <EditorCanvas />
        </main>
        <aside className="w-80 shrink-0 overflow-auto border-l border-border bg-card">
          <PropertiesPanel />
        </aside>
      </div>
    </div>
  );
}
