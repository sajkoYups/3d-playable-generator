"use client";

import type { PlayableElement, ProjectLinks } from "@/types/project";
import {
  DEFAULT_TIMER_DURATION,
  DEFAULT_TIMER_WARNING,
  DEFAULT_TIMER_WARNING_COLOR,
  formatCountdown,
} from "@/playable-runtime/screens/format-time";

export function ElementView({
  element,
  interactive = true,
  onAction,
  remainingSeconds,
}: {
  element: PlayableElement;
  links?: ProjectLinks;
  interactive?: boolean;
  onAction?: (type: PlayableElement["action"]["type"]) => void;
  remainingSeconds?: number;
}) {
  const content = element.content;
  const style = element.style;

  const handleClick = (e: React.MouseEvent) => {
    if (!interactive) return;
    e.stopPropagation();
    onAction?.(element.action.type);
  };

  if (element.type === "timer") {
    const total = remainingSeconds ?? content.durationSeconds ?? DEFAULT_TIMER_DURATION;
    const warnAt = content.warningSeconds ?? DEFAULT_TIMER_WARNING;
    const urgent = total <= warnAt;
    return (
      <div
        className="flex h-full w-full items-center justify-center px-2"
        style={{
          background: style.backgroundColor || "#1c1f2a",
          color: urgent ? content.warningColor || DEFAULT_TIMER_WARNING_COLOR : content.color || "#f3ede0",
          fontFamily: content.fontFamily || "system-ui, sans-serif",
          fontSize: content.fontSize || 16,
          fontWeight: content.fontWeight || 800,
          borderRadius: style.borderRadius ?? 999,
          letterSpacing: 0.5,
          fontVariantNumeric: "tabular-nums",
          boxShadow: style.shadow || "none",
        }}
      >
        {formatCountdown(total)}
      </div>
    );
  }

  if (element.type === "text" || element.type === "starRating") {
    return (
      <div
        className="h-full w-full overflow-hidden"
        style={{
          color: content.color || "#fff",
          fontFamily: content.fontFamily || "system-ui, sans-serif",
          fontSize: content.fontSize || 16,
          fontWeight: content.fontWeight || 600,
          textAlign: content.textAlign || "center",
          lineHeight: content.lineHeight || 1.2,
          letterSpacing: content.letterSpacing || 0,
          textDecoration: element.action.type === "OPEN_POLICY" ? "underline" : undefined,
          display: "flex",
          alignItems: "center",
          justifyContent:
            content.textAlign === "left"
              ? "flex-start"
              : content.textAlign === "right"
                ? "flex-end"
                : "center",
        }}
      >
        {content.text || (element.type === "starRating" ? "★★★★★" : "")}
      </div>
    );
  }

  if (element.type === "image") {
    if (!content.imageUrl) {
      return (
        <div className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-white/40 bg-white/10 text-[10px] text-white/70">
          {element.name}
        </div>
      );
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={content.imageUrl} alt="" className="h-full w-full object-contain" draggable={false} />
    );
  }

  if (element.type === "muteButton") {
    return (
      <button
        type="button"
        className="flex h-full w-full items-center justify-center text-sm"
        style={{
          background: style.backgroundColor || "rgba(0,0,0,0.45)",
          color: style.textColor || "#fff",
          borderRadius: style.borderRadius ?? 999,
          boxShadow: style.shadow || "none",
        }}
        onClick={handleClick}
      >
        {content.text || "🔊"}
      </button>
    );
  }

  if (element.type === "button" || element.type === "storeButton") {
    return (
      <button
        type="button"
        className="flex h-full w-full items-center justify-center px-2 text-center font-semibold"
        style={{
          background: style.backgroundColor || "#e07a3d",
          color: style.textColor || "#fff",
          fontSize: content.fontSize || 14,
          borderRadius: style.borderRadius ?? 16,
          border:
            style.borderWidth && style.borderWidth > 0
              ? `${style.borderWidth}px solid ${style.borderColor || "#000"}`
              : "none",
          boxShadow: style.shadow || "none",
        }}
        onClick={handleClick}
      >
        {content.text || "Button"}
      </button>
    );
  }

  return null;
}
