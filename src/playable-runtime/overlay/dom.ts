import type { PlayableElement } from "@/types/project";
import {
  DEFAULT_TIMER_DURATION,
  DEFAULT_TIMER_WARNING,
  DEFAULT_TIMER_WARNING_COLOR,
  formatCountdown,
} from "@/playable-runtime/screens/format-time";

export function renderElement(
  element: PlayableElement,
  options: {
    interactive: boolean;
    remainingSeconds?: number;
    muted?: boolean;
    onAction?: (type: PlayableElement["action"]["type"], element: PlayableElement) => void;
  },
): HTMLElement {
  const content = element.content;
  const style = element.style;
  const wrap = document.createElement("div");
  wrap.style.width = "100%";
  wrap.style.height = "100%";
  wrap.style.display = "flex";
  wrap.style.alignItems = "center";
  wrap.style.justifyContent = "center";
  wrap.style.overflow = "hidden";

  const fire = (e: Event) => {
    if (!options.interactive) return;
    e.stopPropagation();
    options.onAction?.(element.action.type, element);
  };

  if (element.type === "timer") {
    const total = options.remainingSeconds ?? content.durationSeconds ?? DEFAULT_TIMER_DURATION;
    const warnAt = content.warningSeconds ?? DEFAULT_TIMER_WARNING;
    const urgent = total <= warnAt;
    wrap.style.background = String(style.backgroundColor || "#1c1f2a");
    wrap.style.color = urgent
      ? content.warningColor || DEFAULT_TIMER_WARNING_COLOR
      : content.color || "#f3ede0";
    wrap.style.fontFamily = content.fontFamily || "system-ui, sans-serif";
    wrap.style.fontSize = `${content.fontSize || 16}px`;
    wrap.style.fontWeight = String(content.fontWeight || 800);
    wrap.style.borderRadius = `${style.borderRadius ?? 999}px`;
    wrap.style.letterSpacing = "0.5px";
    wrap.style.fontVariantNumeric = "tabular-nums";
    wrap.textContent = formatCountdown(total);
    return wrap;
  }

  if (element.type === "text" || element.type === "starRating") {
    wrap.style.color = content.color || "#fff";
    wrap.style.fontFamily = content.fontFamily || "system-ui, sans-serif";
    wrap.style.fontSize = `${content.fontSize || 16}px`;
    wrap.style.fontWeight = String(content.fontWeight || 600);
    wrap.style.textAlign = content.textAlign || "center";
    wrap.style.lineHeight = String(content.lineHeight || 1.2);
    wrap.style.letterSpacing = `${content.letterSpacing || 0}px`;
    wrap.style.justifyContent =
      content.textAlign === "left"
        ? "flex-start"
        : content.textAlign === "right"
          ? "flex-end"
          : "center";
    wrap.textContent = content.text || (element.type === "starRating" ? "★★★★★" : "");
    if (element.action.type === "OPEN_POLICY") {
      wrap.style.textDecoration = "underline";
      wrap.style.cursor = options.interactive ? "pointer" : "default";
    }
    if (options.interactive && element.action.type !== "NONE") {
      wrap.style.cursor = "pointer";
      wrap.addEventListener("click", fire);
    }
    return wrap;
  }

  if (element.type === "image") {
    if (!content.imageUrl) {
      wrap.style.border = "1px dashed rgba(255,255,255,0.4)";
      wrap.style.background = "rgba(255,255,255,0.08)";
      wrap.style.borderRadius = "8px";
      wrap.style.fontSize = "10px";
      wrap.style.color = "rgba(255,255,255,0.7)";
      wrap.textContent = element.name;
      return wrap;
    }
    const img = document.createElement("img");
    img.src = content.imageUrl;
    img.alt = "";
    img.draggable = false;
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "contain";
    wrap.appendChild(img);
    return wrap;
  }

  if (element.type === "muteButton") {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.style.width = "100%";
    btn.style.height = "100%";
    btn.style.border = "none";
    btn.style.cursor = "pointer";
    btn.style.background = String(style.backgroundColor || "rgba(0,0,0,0.45)");
    btn.style.color = String(style.textColor || "#fff");
    btn.style.borderRadius = `${style.borderRadius ?? 999}px`;
    btn.style.fontSize = "16px";
    btn.textContent = options.muted ? "🔇" : content.text || "🔊";
    btn.dataset.playableMute = "1";
    btn.dataset.muteOn = "🔇";
    btn.dataset.muteOff = content.text || "🔊";
    if (options.interactive) btn.addEventListener("click", fire);
    wrap.appendChild(btn);
    return wrap;
  }

  if (element.type === "button" || element.type === "storeButton") {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.style.width = "100%";
    btn.style.height = "100%";
    btn.style.border =
      style.borderWidth && style.borderWidth > 0
        ? `${style.borderWidth}px solid ${style.borderColor || "#000"}`
        : "none";
    btn.style.cursor = "pointer";
    btn.style.background = String(style.backgroundColor || "#e07a3d");
    btn.style.color = String(style.textColor || "#fff");
    btn.style.fontSize = `${content.fontSize || 14}px`;
    btn.style.fontWeight = "700";
    btn.style.borderRadius = `${style.borderRadius ?? 16}px`;
    btn.style.boxShadow = String(style.shadow || "none");
    btn.textContent = content.text || "Button";
    if (options.interactive) btn.addEventListener("click", fire);
    wrap.appendChild(btn);
    return wrap;
  }

  return wrap;
}
