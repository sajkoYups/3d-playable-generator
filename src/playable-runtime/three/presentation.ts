import type { CameraConfig, LightingPreset, Orientation } from "@/types/project";
import type { ThreeHost } from "@/playable-runtime/three/host";

export function applyLivePresentation(
  host: ThreeHost | null,
  options: Record<string, unknown>,
  ctx: { camera: CameraConfig; lighting: LightingPreset; orientation: Orientation },
) {
  if (!host) return;
  if (typeof options.lighting === "string") {
    ctx.lighting = options.lighting as LightingPreset;
    host.applyLighting(ctx.lighting);
  }
  let cameraDirty = false;
  if (options.camera && typeof options.camera === "object") {
    ctx.camera = options.camera as CameraConfig;
    cameraDirty = true;
  }
  if (options.orientation === "portrait" || options.orientation === "landscape") {
    ctx.orientation = options.orientation;
    cameraDirty = true;
  }
  if (cameraDirty) {
    host.applyCamera(ctx.camera, ctx.orientation, host.camera.aspect);
  }
}
