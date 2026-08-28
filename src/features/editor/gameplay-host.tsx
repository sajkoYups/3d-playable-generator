"use client";

import { useEffect, useRef } from "react";
import type { Orientation, ProjectData, TemplateId } from "@/types/project";
import { createEngine } from "@/playable-runtime/engines";
import type { Playable3DEngine } from "@/playable-runtime/engines/types";

export function GameplayHost({
  templateId,
  data,
  orientation = "portrait",
  interactive = true,
  className,
  autoStart = true,
  parkingRoundIndex = 0,
}: {
  templateId: TemplateId;
  data: ProjectData;
  orientation?: Orientation;
  interactive?: boolean;
  className?: string;
  autoStart?: boolean;
  parkingRoundIndex?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Playable3DEngine | null>(null);
  const dataRef = useRef(data);
  const orientationRef = useRef(orientation);
  const parkingRoundIndexRef = useRef(parkingRoundIndex);
  dataRef.current = data;
  orientationRef.current = orientation;
  parkingRoundIndexRef.current = parkingRoundIndex;

  useEffect(() => {
    if (!ref.current) return;
    const engine = createEngine(templateId);
    engineRef.current = engine;
    const current = dataRef.current;
    engine.initialize({
      container: ref.current,
      orientation: orientationRef.current,
      camera: current.gameplay.camera[orientationRef.current],
      lighting: current.gameplay.lighting,
      assets: {},
      ...({
        stackTower: current.gameplay.stackTower,
        tripleMatch: current.gameplay.tripleMatch,
        laneRunner: current.gameplay.laneRunner,
        parkingJam: current.gameplay.parkingJam,
        playAllRounds: true,
        parkingRoundIndex: parkingRoundIndexRef.current,
      } as object),
    } as never);
    const el = ref.current;
    const ro = new ResizeObserver(() => {
      engine.resize?.(el.clientWidth, el.clientHeight);
    });
    ro.observe(el);
    let resetTimer: ReturnType<typeof setTimeout> | undefined;
    engine.onWin(() => {
      resetTimer = setTimeout(() => engine.reset(), 900);
    });
    engine.onLose(() => {
      resetTimer = setTimeout(() => engine.reset(), 900);
    });
    if (autoStart) engine.start();
    return () => {
      ro.disconnect();
      if (resetTimer) clearTimeout(resetTimer);
      engine.destroy();
      engineRef.current = null;
    };
  }, [templateId, autoStart]);

  useEffect(() => {
    engineRef.current?.setOptions?.({
      camera: data.gameplay.camera[orientation],
      lighting: data.gameplay.lighting,
      orientation,
      stackTower: data.gameplay.stackTower,
      tripleMatch: data.gameplay.tripleMatch,
      laneRunner: data.gameplay.laneRunner,
      parkingJam: data.gameplay.parkingJam,
      playAllRounds: true,
      parkingRoundIndex,
    });
  }, [
    orientation,
    parkingRoundIndex,
    data.gameplay.camera,
    data.gameplay.lighting,
    data.gameplay.stackTower,
    data.gameplay.tripleMatch,
    data.gameplay.laneRunner,
    data.gameplay.parkingJam,
  ]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ pointerEvents: interactive ? "auto" : "none", touchAction: "none", width: "100%", height: "100%" }}
    />
  );
}
