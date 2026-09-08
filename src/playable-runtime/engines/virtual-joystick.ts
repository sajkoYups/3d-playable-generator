export type JoystickState = {
  active: boolean;
  x: number;
  y: number;
  originX: number;
  originY: number;
  pointerId: number | null;
};

export function createVirtualJoystick(opts?: { radius?: number; margin?: number }) {
  const radius = opts?.radius ?? 56;
  const margin = opts?.margin ?? 18;
  const state: JoystickState = {
    active: false,
    x: 0,
    y: 0,
    originX: 0,
    originY: 0,
    pointerId: null,
  };

  function place(w: number, h: number) {
    if (!state.active) {
      state.originX = margin + radius;
      state.originY = h - margin - radius;
    }
    return state;
  }

  function onDown(clientX: number, clientY: number, rect: DOMRect, pointerId: number, w: number, h: number) {
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const ox = margin + radius;
    const oy = h - margin - radius;
    const dx = x - ox;
    const dy = y - oy;
    if (dx * dx + dy * dy > (radius * 1.8) ** 2 && x > w * 0.55) return false;
    state.active = true;
    state.pointerId = pointerId;
    state.originX = ox;
    state.originY = oy;
    apply(x, y);
    return true;
  }

  function onMove(clientX: number, clientY: number, rect: DOMRect, pointerId: number) {
    if (!state.active || state.pointerId !== pointerId) return;
    apply(clientX - rect.left, clientY - rect.top);
  }

  function onUp(pointerId: number) {
    if (state.pointerId !== pointerId && pointerId !== -1) return;
    state.active = false;
    state.pointerId = null;
    state.x = 0;
    state.y = 0;
  }

  function apply(x: number, y: number) {
    let dx = x - state.originX;
    let dy = y - state.originY;
    const len = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(1, len / radius);
    state.x = (dx / len) * clamped;
    state.y = (dy / len) * clamped;
  }

  function draw(ctx: CanvasRenderingContext2D) {
    const { originX, originY } = state;
    ctx.save();
    ctx.globalAlpha = state.active ? 0.85 : 0.55;
    ctx.beginPath();
    ctx.arc(originX, originY, radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(15,23,42,0.45)";
    ctx.fill();
    ctx.strokeStyle = "rgba(248,250,252,0.55)";
    ctx.lineWidth = 2;
    ctx.stroke();
    const kx = originX + state.x * radius * 0.62;
    const ky = originY + state.y * radius * 0.62;
    ctx.beginPath();
    ctx.arc(kx, ky, radius * 0.38, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(248,250,252,0.9)";
    ctx.fill();
    ctx.restore();
  }

  return { state, place, onDown, onMove, onUp, draw, radius };
}
