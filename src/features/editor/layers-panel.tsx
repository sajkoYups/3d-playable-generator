"use client";

import { useEditorStore, useStageElements } from "@/features/editor/store";
import { Eye, EyeOff, Lock, Unlock } from "lucide-react";
import { cn } from "@/lib/utils";
import { END_POLICY_SLOT_ID, isBrandSlotId } from "@/types/project";

export function LayersPanel() {
  const elements = useStageElements();
  const selectedElementId = useEditorStore((s) => s.selectedElementId);
  const selectElement = useEditorStore((s) => s.selectElement);
  const orientation = useEditorStore((s) => s.orientation);
  const updateElementLayout = useEditorStore((s) => s.updateElementLayout);
  const stage = useEditorStore((s) => s.stage);
  const data = useEditorStore((s) => s.data);
  const editorMode = useEditorStore((s) => s.editorMode);
  const brandId = useEditorStore((s) => s.brandId);
  const addEndPolicy = useEditorStore((s) => s.addEndPolicy);
  const canAddPolicy =
    stage === "end" &&
    !elements.some((el) => el.id === END_POLICY_SLOT_ID) &&
    (editorMode === "brand" || !brandId);

  const sorted = [...elements].sort(
    (a, b) => b.layout[orientation].zIndex - a.layout[orientation].zIndex,
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
        Layers · {stage}
      </div>
      {stage !== "gameplay" && (
        <button
          className="px-3 py-2 text-left text-sm hover:bg-[#161821]"
          onClick={() => selectElement(null)}
        >
          Background
        </button>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        {sorted.map((el) => {
          const box = el.layout[orientation];
          const locked = el.permanentlyLocked || box.locked;
          return (
            <div
              key={el.id}
              className={cn(
                "flex items-center gap-1 px-2 py-1.5 text-sm",
                selectedElementId === el.id ? "bg-[#2a2118]" : "hover:bg-[#161821]",
              )}
            >
              <button
                className="min-w-0 flex-1 truncate text-left"
                onClick={() => selectElement(el.id)}
              >
                {el.name}
                {el.permanentlyLocked && (
                  <span className="ml-1 text-[10px] text-accent">LOCKED</span>
                )}
                {editorMode === "playable" && Boolean(brandId) && isBrandSlotId(el.id) && (
                    <span className="ml-1 text-[10px] text-accent">BRAND</span>
                  )}
              </button>
              <button
                className="rounded p-1 hover:bg-[#2a2e3a]"
                onClick={() =>
                  updateElementLayout(el.id, orientation, { visible: !box.visible })
                }
                disabled={el.permanentlyLocked}
              >
                {box.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </button>
              <button
                className="rounded p-1 hover:bg-[#2a2e3a]"
                disabled={el.permanentlyLocked}
                onClick={() => {
                  if (el.permanentlyLocked) return;
                  updateElementLayout(el.id, orientation, { locked: !box.locked });
                }}
              >
                {locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
              </button>
              <button
                className="rounded px-1 text-xs hover:bg-[#2a2e3a]"
                disabled={el.permanentlyLocked}
                onClick={() =>
                  updateElementLayout(el.id, orientation, { zIndex: box.zIndex + 1 })
                }
              >
                ↑
              </button>
              <button
                className="rounded px-1 text-xs hover:bg-[#2a2e3a]"
                disabled={el.permanentlyLocked}
                onClick={() =>
                  updateElementLayout(el.id, orientation, { zIndex: box.zIndex - 1 })
                }
              >
                ↓
              </button>
            </div>
          );
        })}
      </div>
      {canAddPolicy && (
        <button
          className="border-t border-border px-3 py-2 text-left text-sm text-accent hover:bg-[#161821]"
          onClick={() => addEndPolicy()}
        >
          + Privacy Policy
        </button>
      )}
      {stage !== "gameplay" && (
        <div className="border-t border-border px-3 py-2 text-[11px] text-muted">
          BG: {data[stage === "start" ? "startScreen" : "endScreen"].background.type}
        </div>
      )}
    </div>
  );
}
