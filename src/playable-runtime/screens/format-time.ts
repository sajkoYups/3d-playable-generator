export const DEFAULT_TIMER_DURATION = 30;
export const DEFAULT_TIMER_WARNING = 10;
export const DEFAULT_TIMER_WARNING_COLOR = "#e85d4c";

export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
