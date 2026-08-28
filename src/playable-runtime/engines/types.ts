import type { CameraConfig, LightingPreset, Orientation } from "@/types/project";

export type PointerKind = "down" | "move" | "up" | "tap" | "swipe";

export type PointerEvent3D = {
  kind: PointerKind;
  ndcX: number;
  ndcY: number;
  clientX: number;
  clientY: number;
  swipe?: { dx: number; dy: number };
};

export type EngineInitContext = {
  container: HTMLElement;
  orientation: Orientation;
  camera: CameraConfig;
  lighting: LightingPreset;
  assets: Record<string, string>;
};

export interface Playable3DEngine {
  id: string;
  name: string;
  initialize(ctx: EngineInitContext): void;
  start(): void;
  pause(): void;
  reset(): void;
  destroy(): void;
  onWin(callback: () => void): void;
  onLose(callback: () => void): void;
  setOptions?(options: Record<string, unknown>): void;
  handlePointer?(event: PointerEvent3D): void;
  resize?(width: number, height: number): void;
}
