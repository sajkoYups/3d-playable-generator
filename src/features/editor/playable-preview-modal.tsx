"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/features/editor/store";
import { useFittedIphoneFrame } from "@/features/editor/iphone-frame";
import { PlayablePlayer } from "@/features/editor/playable-player";
import type { Orientation } from "@/types/project";

export function PlayablePreviewModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const data = useEditorStore((s) => s.data);
  const templateId = useEditorStore((s) => s.templateId);
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [jumpToEnd, setJumpToEnd] = useState(false);
  const [key, setKey] = useState(0);
  const { containerRef, logical: size, outer, scale, fitted } = useFittedIphoneFrame(orientation, open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-h-[90vh] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Playable preview</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={orientation === "portrait" ? "default" : "outline"} onClick={() => { setOrientation("portrait"); setKey((k) => k + 1); }}>Portrait</Button>
          <Button size="sm" variant={orientation === "landscape" ? "default" : "outline"} onClick={() => { setOrientation("landscape"); setKey((k) => k + 1); }}>Landscape</Button>
          <Button size="sm" variant="outline" onClick={() => { setJumpToEnd(false); setKey((k) => k + 1); }}>Restart</Button>
          <Button size="sm" variant="secondary" onClick={() => { setJumpToEnd(true); setKey((k) => k + 1); }}>Jump to end</Button>
        </div>
        <div ref={containerRef} className="flex min-h-0 w-full flex-1 items-center justify-center overflow-visible py-4">
          <div style={{ width: outer.w * scale, height: outer.h * scale, visibility: fitted ? "visible" : "hidden" }}>
            <div
              className="overflow-hidden rounded-[28px] border-[10px] border-[#0a0b10] shadow-xl"
              style={{ width: outer.w, height: outer.h, transform: `scale(${scale})`, transformOrigin: "top left" }}
            >
              <div style={{ width: size.w, height: size.h }}>
                <PlayablePlayer key={key} data={data} templateId={templateId} forcedOrientation={orientation} jumpToEnd={jumpToEnd} />
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
