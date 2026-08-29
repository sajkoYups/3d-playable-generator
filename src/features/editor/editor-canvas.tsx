"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/features/editor/store";
import { useFittedIphoneFrame } from "@/features/editor/iphone-frame";
import type { CSSProperties } from "react";
import { backgroundToStyle, layoutToStyle, snapToCenter, clamp01 } from "@/playable-runtime/layout/layout";
import { ElementView } from "@/features/editor/element-view";
import { GameplayHost } from "@/features/editor/gameplay-host";

function MutedLoopVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.muted = true;
    void el.play().catch(() => undefined);
    return () => {
      el.pause();
    };
  }, [src]);
  return (
    <video
      ref={ref}
      src={src}
      loop
      muted
      playsInline
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}

export function EditorCanvas() {
  const stage = useEditorStore((s) => s.stage);
  const orientation = useEditorStore((s) => s.orientation);
  const data = useEditorStore((s) => s.data);
  const templateId = useEditorStore((s) => s.templateId);
  const parkingRoundIndex = useEditorStore((s) => s.parkingRoundIndex);
  const selectedElementId = useEditorStore((s) => s.selectedElementId);
  const selectElement = useEditorStore((s) => s.selectElement);
  const updateElementLayout = useEditorStore((s) => s.updateElementLayout);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const elements = useEditorStore((s) => s.getStageElements());
  const { containerRef, logical: size, outer, scale } = useFittedIphoneFrame(orientation);

  const frameRef = useRef<HTMLDivElement>(null);
  const [guides, setGuides] = useState({ v: false, h: false });
  const dragRef = useRef<{
    id: string;
    mode: "move" | "resize";
    startX: number;
    startY: number;
    orig: { x: number; y: number; width: number; height: number };
  } | null>(null);

  const screen =
    stage === "start" ? data.startScreen : stage === "end" ? data.endScreen : null;

  const onPointerDown = useCallback(
    (e: React.PointerEvent, id: string, mode: "move" | "resize") => {
      e.stopPropagation();
      const el = elements.find((x) => x.id === id);
      if (!el || el.permanentlyLocked || el.layout[orientation].locked) {
        selectElement(id);
        return;
      }
      selectElement(id);
      pushHistory();
      const box = el.layout[orientation];
      dragRef.current = {
        id,
        mode,
        startX: e.clientX,
        startY: e.clientY,
        orig: { x: box.x, y: box.y, width: box.width, height: box.height },
      };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [elements, orientation, pushHistory, selectElement],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || !frameRef.current) return;
      const rect = frameRef.current.getBoundingClientRect();
      const dx = (e.clientX - drag.startX) / rect.width;
      const dy = (e.clientY - drag.startY) / rect.height;

      if (drag.mode === "move") {
        let x = clamp01(drag.orig.x + dx);
        let y = clamp01(drag.orig.y + dy);
        const snappedX = snapToCenter(x, drag.orig.width);
        const snappedY = snapToCenter(y, drag.orig.height);
        setGuides({
          v: Math.abs(snappedX - x) < 0.0001 || Math.abs(x + drag.orig.width / 2 - 0.5) < 0.02,
          h: Math.abs(snappedY - y) < 0.0001 || Math.abs(y + drag.orig.height / 2 - 0.5) < 0.02,
        });
        x = snapToCenter(x, drag.orig.width);
        y = snapToCenter(y, drag.orig.height);
        updateElementLayout(drag.id, orientation, { x, y }, false);
      } else {
        const width = clamp01(Math.max(0.04, drag.orig.width + dx));
        const height = clamp01(Math.max(0.04, drag.orig.height + dy));
        updateElementLayout(drag.id, orientation, { width, height }, false);
      }
    },
    [orientation, updateElementLayout],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    setGuides({ v: false, h: false });
  }, []);

  const sorted = [...elements].sort(
    (a, b) => a.layout[orientation].zIndex - b.layout[orientation].zIndex,
  );

  return (
    <div className="h-full p-6" onClick={() => selectElement(null)}>
      <div
        ref={containerRef}
        className="flex h-full w-full items-center justify-center overflow-hidden"
      >
        <div style={{ width: outer.w * scale, height: outer.h * scale }}>
          <div
            className="overflow-hidden rounded-[28px] border-[10px] border-[#0a0b10] shadow-2xl"
            style={{
              width: outer.w,
              height: outer.h,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              ref={frameRef}
              className="relative overflow-hidden"
              style={{ width: size.w, height: size.h }}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              {screen && (
                <div className="absolute inset-0 overflow-hidden" style={backgroundToStyle(screen.background, orientation) as CSSProperties}>
                  {screen.background.type === "video" && screen.videoUrl ? (
                    <MutedLoopVideo src={screen.videoUrl} />
                  ) : null}
                </div>
              )}
              {stage === "gameplay" && (
                <div
                  className="absolute inset-0"
                  style={backgroundToStyle(data.gameplay.stageBackground[orientation], orientation) as CSSProperties}
                />
              )}

              <div className="pointer-events-none absolute inset-[4%] rounded-lg border border-dashed border-white/20" />
              <div
                className={`pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2 ${
                  guides.v ? "bg-accent/80" : "bg-white/10"
                }`}
              />
              <div
                className={`pointer-events-none absolute left-0 top-1/2 h-px w-full -translate-y-1/2 ${
                  guides.h ? "bg-accent/80" : "bg-white/10"
                }`}
              />

              {sorted.map((el) => {
                const box = el.layout[orientation];
                if (!box.visible && el.type !== "gameplayContainer") return null;
                const style = layoutToStyle(box, size.w, size.h) as CSSProperties;
                const selected = selectedElementId === el.id;
                const locked = el.permanentlyLocked || box.locked;

                if (el.type === "gameplayContainer") {
                  return (
                    <div
                      key={el.id}
                      style={style}
                      className={`overflow-hidden rounded-md ${selected ? "ring-2 ring-amber-400" : "ring-1 ring-white/20"}`}
                    >
                      <GameplayHost
                        key={`${templateId}-${orientation}`}
                        templateId={templateId}
                        data={data}
                        orientation={orientation}
                        interactive
                        autoStart
                        parkingRoundIndex={parkingRoundIndex}
                        className="h-full w-full"
                      />
                    </div>
                  );
                }

                return (
                  <div
                    key={el.id}
                    style={style}
                    className={`group ${selected ? "ring-2 ring-accent" : ""} ${
                      locked ? "cursor-default" : "cursor-move"
                    }`}
                    onPointerDown={(e) => onPointerDown(e, el.id, "move")}
                  >
                    <ElementView element={el} interactive={false} />
                    {selected && !locked && (
                      <div
                        className="absolute bottom-0 right-0 h-3 w-3 translate-x-1/2 translate-y-1/2 rounded-sm bg-accent"
                        onPointerDown={(e) => onPointerDown(e, el.id, "resize")}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
