import { backgroundImageUrl } from "@/types/project";
import type { Background } from "@/types/project";

export function drawCanvasBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  background: Background | undefined,
  bgImage: HTMLImageElement | null,
) {
  if (!background) {
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, w, h);
    return;
  }

  if (background.type === "transparent") {
    return;
  }

  if (background.type === "image" && bgImage && bgImage.complete && bgImage.naturalWidth) {
    const fit = background.imageFit || "cover";
    if (fit === "stretch") {
      ctx.drawImage(bgImage, 0, 0, w, h);
    } else {
      const scale =
        fit === "contain"
          ? Math.min(w / bgImage.naturalWidth, h / bgImage.naturalHeight)
          : Math.max(w / bgImage.naturalWidth, h / bgImage.naturalHeight);
      const dw = bgImage.naturalWidth * scale;
      const dh = bgImage.naturalHeight * scale;
      ctx.drawImage(bgImage, (w - dw) / 2, (h - dh) / 2, dw, dh);
    }
    if (background.overlayOpacity > 0) {
      ctx.fillStyle = hexToRgba(background.overlayColor || "#000000", background.overlayOpacity);
      ctx.fillRect(0, 0, w, h);
    }
    return;
  }

  if (background.type === "gradient") {
    const angle = ((background.gradientAngle || 180) * Math.PI) / 180;
    const x0 = w / 2 - (Math.cos(angle) * w) / 2;
    const y0 = h / 2 - (Math.sin(angle) * h) / 2;
    const x1 = w / 2 + (Math.cos(angle) * w) / 2;
    const y1 = h / 2 + (Math.sin(angle) * h) / 2;
    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, background.gradientFrom || "#0f172a");
    grad.addColorStop(1, background.gradientTo || "#1e293b");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    return;
  }

  ctx.fillStyle = background.color || "#111827";
  ctx.fillRect(0, 0, w, h);
}

export function loadImage(url: string): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function canvasBgUrl(background: Background | undefined, orientation: "portrait" | "landscape") {
  return backgroundImageUrl(background, orientation);
}

function hexToRgba(hex: string, alpha: number): string {
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
