import { TUBE_CAPACITY, type Tube } from "@/playable-runtime/engines/water-sort/rules";

export const DEFAULT_COLORS = ["#e23d3d", "#2b6fdb", "#1aa35a", "#f0b429", "#9b4de0"];

export type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  life: number;
  size: number;
};

function parseHex(hex: string): [number, number, number] {
  const raw = hex.trim().replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  if (full.length !== 6) return [100, 116, 139];
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return [100, 116, 139];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgb(r: number, g: number, b: number, a = 1): string {
  const rr = Math.round(Math.max(0, Math.min(255, r)));
  const gg = Math.round(Math.max(0, Math.min(255, g)));
  const bb = Math.round(Math.max(0, Math.min(255, b)));
  return a >= 1 ? `rgb(${rr},${gg},${bb})` : `rgba(${rr},${gg},${bb},${a})`;
}

function mix(hex: string, toward: [number, number, number], t: number): string {
  const [r, g, b] = parseHex(hex);
  return rgb(r + (toward[0] - r) * t, g + (toward[1] - g) * t, b + (toward[2] - b) * t);
}

export function colorAt(colors: string[], index: number): string {
  return colors[index] || DEFAULT_COLORS[index] || "#64748b";
}

export function addTubePath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  inset = 0,
) {
  const left = x + inset;
  const top = y + inset;
  const width = w - inset * 2;
  const height = h - inset * 2;
  const r = Math.min(width * 0.42, height * 0.1);
  const rimH = Math.max(3, width * 0.09);
  ctx.beginPath();
  ctx.moveTo(left, top + rimH);
  ctx.lineTo(left, top + height - r);
  ctx.arc(left + width / 2, top + height - r, r, Math.PI, 0, false);
  ctx.lineTo(left + width, top + rimH);
  ctx.closePath();
}

export function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createRadialGradient(w * 0.5, h * 0.42, Math.min(w, h) * 0.2, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(1, "rgba(120, 155, 185, 0.12)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function drawMovesChip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  text: string,
): number {
  ctx.save();
  ctx.font = `700 ${Math.max(12, Math.round(h * 0.38))}px system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const padX = 14;
  const width = Math.ceil(ctx.measureText(text).width) + padX * 2;
  const radius = h / 2;
  ctx.beginPath();
  ctx.roundRect(x, y, width, h, radius);
  ctx.fillStyle = "#fffaf3";
  ctx.shadowColor = "rgba(31,51,71,0.14)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "#1f3347";
  ctx.fillText(text, x + padX, y + h / 2 + 0.5);
  ctx.restore();
  return width;
}

export function drawCoinIcon(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  x: number,
  y: number,
  size: number,
) {
  if (image && image.complete && image.naturalWidth) {
    ctx.drawImage(image, x, y, size, size);
    return;
  }
  ctx.fillStyle = "#e2b13a";
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2 - 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = Math.max(1, size * 0.08);
  ctx.stroke();
}

export function drawWaterSortHud(
  ctx: CanvasRenderingContext2D,
  opts: {
    w: number;
    hudH: number;
    moves: number;
    maxMoves: number;
    round: number;
    roundsToWin: number;
    earnedLabel: string;
    rewardTextColor: string;
    coinImage: HTMLImageElement | null;
    punch: number;
    payoutActive: boolean;
    showMoves: boolean;
    showCoins: boolean;
  },
): { targetX: number; targetY: number } {
  const chipH = Math.max(24, Math.min(30, opts.hudH * 0.55));
  const chipY = (opts.hudH - chipH) / 2;
  const cy = chipY + chipH / 2;
  const roundText = `R${Math.min(opts.round + 1, opts.roundsToWin)}/${opts.roundsToWin}`;
  const fontPx = Math.max(11, Math.round(chipH * 0.38));
  const pop = opts.punch;
  let targetX = 24;
  let targetY = cy;
  let movesW = 0;

  if (opts.showMoves) {
    movesW = drawMovesChip(ctx, 8, chipY, chipH, `Moves ${opts.moves}/${opts.maxMoves}`);
    targetX = 8 + movesW / 2;
    if (!opts.showCoins) {
      ctx.save();
      ctx.font = `700 ${Math.max(12, Math.round(chipH * 0.38))}px system-ui, sans-serif`;
      const roundW = Math.ceil(ctx.measureText(roundText).width) + 28;
      ctx.restore();
      drawMovesChip(ctx, opts.w - roundW - 8, chipY, chipH, roundText);
    }
  }

  if (opts.showCoins) {
    const coinSize = Math.max(14, Math.min(18, chipH * 0.68));
    const label = `${roundText}  ${opts.earnedLabel}`;
    ctx.save();
    ctx.font = `700 ${fontPx}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const padX = 8;
    const rewardW = Math.ceil(ctx.measureText(label).width) + coinSize + padX * 2 + 6;
    const x = opts.showMoves ? 8 + movesW + 6 : 8;
    if (opts.payoutActive) {
      ctx.globalAlpha = Math.min(0.5, (pop - 1) * 1.4);
      ctx.fillStyle = "#e2b13a";
      ctx.beginPath();
      ctx.arc(x + padX + coinSize / 2, cy, coinSize * 1.15 * pop, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    ctx.roundRect(x, chipY, rewardW, chipH, chipH / 2);
    ctx.fillStyle = "#fffaf3";
    ctx.shadowColor = "rgba(31,51,71,0.14)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.save();
    ctx.translate(x + padX + coinSize / 2, cy);
    ctx.scale(pop, pop);
    ctx.translate(-(x + padX + coinSize / 2), -cy);
    drawCoinIcon(ctx, opts.coinImage, x + padX, cy - coinSize / 2, coinSize);
    ctx.fillStyle = opts.rewardTextColor;
    ctx.fillText(label, x + padX + coinSize + 6, cy + 0.5);
    ctx.restore();
    ctx.restore();
    targetX = x + padX + coinSize / 2;
    targetY = cy;
  }

  return { targetX, targetY };
}

export function drawHint(
  ctx: CanvasRenderingContext2D,
  w: number,
  y: number,
  text: string,
  alpha: number,
) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = "600 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const width = Math.min(w - 32, ctx.measureText(text).width + 28);
  const h = 28;
  const x = (w - width) / 2;
  ctx.beginPath();
  ctx.roundRect(x, y - h / 2, width, h, 14);
  ctx.fillStyle = "rgba(255,250,243,0.92)";
  ctx.shadowColor = "rgba(31,51,71,0.12)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "#1f3347";
  ctx.fillText(text, w / 2, y + 0.5);
  ctx.restore();
}

function drawLiquid(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  layers: Tube,
  colors: string[],
) {
  if (!layers.length) return;

  const inset = Math.max(3, w * 0.08);
  const innerX = x + inset;
  const innerW = w - inset * 2;
  const rimH = Math.max(3, w * 0.09);
  const innerTop = y + rimH + h * 0.05;
  const tubeBottom = y + h - inset * 0.2;
  const innerH = Math.max(8, tubeBottom - innerTop);
  const headroom = innerH * 0.14;
  const fillH = innerH - headroom;
  const layerH = fillH / TUBE_CAPACITY;
  const bowlR = Math.min(innerW * 0.42, h * 0.1, layerH * 0.5);

  ctx.save();
  addTubePath(ctx, x, y, w, h, inset * 0.35);
  ctx.clip();

  const left = innerX;
  const right = innerX + innerW;

  layers.forEach((color, li) => {
    const top = tubeBottom - (li + 1) * layerH;
    const bot = li === 0 ? tubeBottom + bowlR + 6 : top + layerH + 1;
    const hex = colorAt(colors, color);
    const grad = ctx.createLinearGradient(left, top, left + innerW, bot);
    grad.addColorStop(0, mix(hex, [255, 255, 255], 0.12));
    grad.addColorStop(0.4, hex);
    grad.addColorStop(1, mix(hex, [20, 30, 50], 0.12));
    ctx.fillStyle = grad;
    const isTop = li === layers.length - 1;
    ctx.beginPath();
    if (isTop) {
      const bump = Math.min(6, Math.max(3, layerH * 0.28));
      ctx.moveTo(left, bot);
      ctx.lineTo(left, top + bump);
      ctx.quadraticCurveTo(left + innerW * 0.5, top - bump, right, top + bump);
      ctx.lineTo(right, bot);
    } else {
      ctx.rect(left, top - 0.5, innerW, bot - top + 0.5);
    }
    ctx.closePath();
    ctx.fill();
  });

  const shine = ctx.createLinearGradient(innerX, innerTop, innerX + innerW * 0.35, tubeBottom);
  shine.addColorStop(0, "rgba(255,255,255,0.14)");
  shine.addColorStop(0.35, "rgba(255,255,255,0)");
  ctx.fillStyle = shine;
  ctx.beginPath();
  ctx.roundRect(innerX + 2, innerTop, innerW * 0.2, fillH, bowlR * 0.3);
  ctx.fill();

  ctx.restore();
}

export function drawTube(
  ctx: CanvasRenderingContext2D,
  opts: {
    x: number;
    y: number;
    w: number;
    h: number;
    layers: Tube;
    colors: string[];
    selected?: boolean;
    complete?: boolean;
  },
) {
  const { x, y, w, h, layers, colors, selected, complete } = opts;
  ctx.save();

  if (selected || complete) {
    addTubePath(ctx, x, y, w, h);
    ctx.shadowColor = selected ? "rgba(37, 99, 235, 0.45)" : "rgba(234, 179, 8, 0.4)";
    ctx.shadowBlur = selected ? 16 : 12;
    ctx.fillStyle = selected ? "rgba(191, 219, 254, 0.18)" : "rgba(253, 224, 71, 0.12)";
    ctx.fill();
    ctx.shadowColor = "transparent";
  }

  addTubePath(ctx, x, y, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.38)";
  ctx.fill();

  drawLiquid(ctx, x, y, w, h, layers, colors);

  addTubePath(ctx, x, y, w, h);
  ctx.strokeStyle = selected ? "rgba(37, 99, 235, 0.9)" : "rgba(70, 110, 145, 0.72)";
  ctx.lineWidth = selected ? 2.6 : 1.8;
  ctx.stroke();

  const rimH = Math.max(3, w * 0.09);
  const lip = Math.max(2.4, w * 0.09);
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + rimH * 0.45, w / 2 + lip * 0.15, rimH * 0.7, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fill();
  ctx.strokeStyle = selected ? "rgba(37, 99, 235, 0.85)" : "rgba(90, 130, 160, 0.7)";
  ctx.lineWidth = 1.7;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + rimH * 0.35, w / 2 + lip * 0.05, rimH * 0.45, 0, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + w * 0.18, y + rimH + 4);
  ctx.lineTo(x + w * 0.18, y + h * 0.72);
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = Math.max(1.5, w * 0.045);
  ctx.lineCap = "round";
  ctx.stroke();

  ctx.restore();
}

export function drawStream(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  hex: string,
  thickness: number,
  t: number,
) {
  const [r, g, b] = parseHex(hex);
  const mx = (x0 + x1) / 2;
  const my = Math.min(y0, y1) - Math.abs(x1 - x0) * 0.12;
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = rgb(r, g, b, 0.55 + 0.35 * t);
  ctx.lineWidth = thickness;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(mx, my, x1, y1);
  ctx.stroke();
  ctx.strokeStyle = rgb(Math.min(255, r + 40), Math.min(255, g + 40), Math.min(255, b + 40), 0.5);
  ctx.lineWidth = thickness * 0.4;
  ctx.stroke();
  ctx.restore();
}

export function spawnSparkles(rect: { x: number; y: number; w: number; h: number }, now: number): Spark[] {
  const sparks: Spark[] = [];
  for (let i = 0; i < 11; i++) {
    sparks.push({
      x: rect.x + rect.w * (0.15 + Math.random() * 0.7),
      y: rect.y + rect.h * (0.15 + Math.random() * 0.7),
      vx: (Math.random() - 0.5) * 55,
      vy: -18 - Math.random() * 50,
      born: now,
      life: 420 + Math.random() * 380,
      size: 1.4 + Math.random() * 2.2,
    });
  }
  return sparks;
}

export function drawSparkles(ctx: CanvasRenderingContext2D, sparks: Spark[], now: number) {
  for (const s of sparks) {
    const u = (now - s.born) / s.life;
    if (u <= 0 || u >= 1) continue;
    const x = s.x + s.vx * u;
    const y = s.y + s.vy * u + 28 * u * u;
    ctx.save();
    ctx.globalAlpha = 1 - u;
    ctx.fillStyle = "#fff8dc";
    ctx.beginPath();
    ctx.arc(x, y, s.size * (1 - u * 0.4), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
