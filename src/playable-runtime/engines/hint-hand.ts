export function drawHintHand(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  x: number,
  y: number,
  size: number,
  now: number,
) {
  const bob = Math.sin(now / 220) * Math.max(3, size * 0.06);
  const dx = x - size * 0.15;
  const dy = y - size * 0.1 + bob;
  if (image && image.complete && image.naturalWidth) {
    ctx.drawImage(image, Math.round(dx), Math.round(dy), size, size);
    return;
  }
  ctx.fillStyle = "rgba(248,250,252,0.95)";
  ctx.beginPath();
  ctx.ellipse(x, y + bob, size * 0.18, size * 0.28, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(15,23,42,0.45)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
