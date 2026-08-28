import type { PointerEvent3D } from "@/playable-runtime/engines/types";

export function attachPointer(
  el: HTMLElement,
  handler: (event: PointerEvent3D) => void,
): () => void {
  let downX = 0;
  let downY = 0;
  let downT = 0;
  let dragging = false;

  const ndc = (e: PointerEvent) => {
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    const y = -(((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1);
    return { ndcX: x, ndcY: y };
  };

  const onDown = (e: PointerEvent) => {
    dragging = true;
    downX = e.clientX;
    downY = e.clientY;
    downT = performance.now();
    const { ndcX, ndcY } = ndc(e);
    handler({ kind: "down", ndcX, ndcY, clientX: e.clientX, clientY: e.clientY });
  };

  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const { ndcX, ndcY } = ndc(e);
    handler({ kind: "move", ndcX, ndcY, clientX: e.clientX, clientY: e.clientY });
  };

  const onUp = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    const { ndcX, ndcY } = ndc(e);
    const dx = e.clientX - downX;
    const dy = e.clientY - downY;
    const dt = performance.now() - downT;
    handler({ kind: "up", ndcX, ndcY, clientX: e.clientX, clientY: e.clientY });
    if (Math.hypot(dx, dy) < 12 && dt < 400) {
      handler({ kind: "tap", ndcX, ndcY, clientX: e.clientX, clientY: e.clientY });
    } else if (Math.hypot(dx, dy) > 28) {
      handler({
        kind: "swipe",
        ndcX,
        ndcY,
        clientX: e.clientX,
        clientY: e.clientY,
        swipe: { dx, dy },
      });
    }
  };

  el.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  return () => {
    el.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };
}
