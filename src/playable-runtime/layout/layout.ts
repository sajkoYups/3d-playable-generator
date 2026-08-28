import type { Background, LayoutBox, Orientation } from "@/types/project";
import { backgroundImageUrl } from "@/types/project";

export type StyleMap = Record<string, string | number>;

export function layoutToStyle(
  box: LayoutBox,
  canvasWidth: number,
  canvasHeight: number,
): StyleMap {
  const left = box.x * canvasWidth;
  const top = box.y * canvasHeight;
  const width = box.width * canvasWidth;
  const height = box.height * canvasHeight;

  return {
    position: "absolute",
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
    transform: box.rotation ? `rotate(${box.rotation}deg)` : "none",
    transformOrigin: "center center",
    opacity: box.opacity,
    display: box.visible ? "flex" : "none",
    zIndex: box.zIndex,
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
  };
}

export function backgroundToStyle(
  background: Background,
  orientation: Orientation,
): StyleMap {
  const imageUrl = backgroundImageUrl(background, orientation);

  if (background.type === "transparent") {
    return { backgroundColor: "transparent" };
  }

  if (background.type === "image" && imageUrl) {
    const size =
      background.imageFit === "stretch"
        ? "100% 100%"
        : background.imageFit === "contain"
          ? "contain"
          : "cover";
    return {
      backgroundImage: `linear-gradient(${hexToRgba(
        background.overlayColor,
        background.overlayOpacity,
      )}, ${hexToRgba(background.overlayColor, background.overlayOpacity)}), url(${imageUrl})`,
      backgroundSize: size,
      backgroundPosition: background.imagePosition || "center",
      backgroundRepeat: "no-repeat",
    };
  }

  if (background.type === "gradient") {
    return {
      backgroundImage: `linear-gradient(${background.gradientAngle}deg, ${background.gradientFrom}, ${background.gradientTo})`,
    };
  }

  if (background.type === "video") {
    return { backgroundColor: background.color };
  }

  return { backgroundColor: background.color };
}

export function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace("#", "");
  const full =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((c) => c + c)
          .join("")
      : cleaned;
  const num = parseInt(full || "000000", 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function applyStyle(el: HTMLElement, style: StyleMap) {
  for (const [k, v] of Object.entries(style)) {
    (el.style as unknown as Record<string, string | number>)[k] = v;
  }
}

export function snapToCenter(value: number, size: number, threshold = 0.02): number {
  const center = 0.5 - size / 2;
  if (Math.abs(value - center) < threshold) return center;
  return value;
}

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
