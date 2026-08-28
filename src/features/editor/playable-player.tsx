"use client";

import { useEffect, useRef } from "react";
import type { Orientation, ProjectData, TemplateId } from "@/types/project";
import { mountPlayable, type MountedPlayable } from "@/playable-runtime/player/mount";
import { createEngine } from "@/playable-runtime/engines";
import { createNetworkAdapter } from "@/playable-runtime/networks";

export function PlayablePlayer({
  data,
  templateId,
  forcedOrientation,
  jumpToEnd = false,
  className,
}: {
  data: ProjectData;
  templateId: TemplateId;
  forcedOrientation?: Orientation;
  jumpToEnd?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const handle = useRef<MountedPlayable | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const engine = createEngine(templateId);
    const network = createNetworkAdapter("generic");
    handle.current = mountPlayable(ref.current, {
      data,
      templateId,
      engine,
      network,
      forcedOrientation,
      jumpToEnd,
    });
    return () => {
      handle.current?.destroy();
      handle.current = null;
    };
    // remount on identity of the playable, not every data tweak
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, forcedOrientation, jumpToEnd]);

  useEffect(() => {
    handle.current?.setData(data);
  }, [data]);

  return <div ref={ref} className={className} style={{ width: "100%", height: "100%" }} />;
}
