export const CANVAS_HUD_H = 44;

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
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#b45309";
  ctx.font = `700 ${Math.max(8, size * 0.45)}px system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("$", x + size / 2, y + size / 2 + 0.5);
}

export function drawCanvasHud(
  ctx: CanvasRenderingContext2D,
  opts: {
    w: number;
    roundText: string;
    coinsText: string;
    extraText?: string;
    coinImage: HTMLImageElement | null;
    transparent?: boolean;
    coinPop?: number;
    hideCoin?: boolean;
  },
) {
  const { w, roundText, coinsText, extraText, coinImage, transparent, hideCoin } = opts;
  const pop = opts.coinPop ?? 1;
  if (!transparent) {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, w, CANVAS_HUD_H);
  }
  const coinSize = 18;
  const y = CANVAS_HUD_H / 2;
  const coinX = 8 + coinSize / 2;
  ctx.save();
  if (transparent) {
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
  }
  if (!hideCoin) {
    if (pop > 1) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.5, (pop - 1) * 1.5);
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(coinX, y, coinSize * 1.15 * pop, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(coinX, y);
    ctx.scale(pop, pop);
    ctx.translate(-coinX, -y);
    drawCoinIcon(ctx, coinImage, 8, y - coinSize / 2, coinSize);
    ctx.fillStyle = "#fbbf24";
    ctx.font = "600 12px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(coinsText, 8 + coinSize + 6, y);
    ctx.restore();
  }
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "600 12px system-ui";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(roundText, w - 10, extraText ? y - 8 : y);
  if (extraText) {
    ctx.font = "11px system-ui";
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(extraText, w - 10, y + 8);
  }
  ctx.restore();
  return { coinX, coinY: y };
}
