"use client";

import { useEffect, useRef } from "react";
import { is2DTemplate, type Orientation, type ProjectData, type TemplateId } from "@/types/project";
import { createEngine } from "@/playable-runtime/engines";
import type { Playable3DEngine } from "@/playable-runtime/engines/types";
import { AudioBus } from "@/playable-runtime/audio/bus";

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
    const audio = new AudioBus();
    audio.setUrls(current.gameplay.audio);
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
        towerDefense: current.gameplay.towerDefense,
        playAllRounds: true,
        parkingRoundIndex: parkingRoundIndexRef.current,
        audioBus: audio,
        background: current.gameplay.background[orientationRef.current],
        pieceImages: current.gameplay.pieceImages,
        match3: current.gameplay.match3
          ? { ...current.gameplay.match3, hintHandEnabled: false }
          : undefined,
        waterSort: current.gameplay.waterSort,
        hintHandUrl: "",
        hintHandVisible: false,
      } as object),
    } as never);
    const el = ref.current;
    const ro = new ResizeObserver(() => {
      engine.resize?.(el.clientWidth, el.clientHeight);
    });
    ro.observe(el);
    let resetTimer: ReturnType<typeof setTimeout> | undefined;
    engine.onWin(() => {
      if (is2DTemplate(templateId)) return;
      resetTimer = setTimeout(() => engine.reset(), 900);
    });
    engine.onLose(() => {
      if (is2DTemplate(templateId)) return;
      resetTimer = setTimeout(() => engine.reset(), 900);
    });
    if (autoStart) engine.start();
    return () => {
      ro.disconnect();
      if (resetTimer) clearTimeout(resetTimer);
      engine.destroy();
      audio.destroy();
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
      towerDefense: data.gameplay.towerDefense,
      playAllRounds: true,
      parkingRoundIndex,
      background: data.gameplay.background[orientation],
      pieceImages: data.gameplay.pieceImages,
      match3: data.gameplay.match3
        ? { ...data.gameplay.match3, hintHandEnabled: false }
        : undefined,
      waterSort: data.gameplay.waterSort,
      hintHandUrl: "",
      hintHandVisible: false,
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
    data.gameplay.towerDefense,
    data.gameplay.background,
    data.gameplay.pieceImages,
    data.gameplay.match3,
    data.gameplay.waterSort,
  ]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ pointerEvents: interactive ? "auto" : "none", touchAction: "none", width: "100%", height: "100%" }}
    />
  );
}
