import type { Orientation } from "@/types/project";

export type TubeRect = {
  i: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type BoardLayout = {
  hudH: number;
  rects: TubeRect[];
  tubeW: number;
  tubeH: number;
};

const HUD_MIN = 52;
const HUD_MAX = 66;
const HIT_PAD = 10;

export function hudHeight(canvasH: number): number {
  return Math.round(Math.min(HUD_MAX, Math.max(HUD_MIN, canvasH * 0.072)));
}

export function rowSizes(count: number, maxCols: number): number[] {
  if (count <= 0) return [];
  if (count <= maxCols) return [count];
  const rowCount = Math.ceil(count / maxCols);
  const base = Math.floor(count / rowCount);
  const extra = count % rowCount;
  const rows: number[] = [];
  for (let i = 0; i < rowCount; i++) {
    rows.push(base + (i < extra ? 1 : 0));
  }
  return rows;
}

export function maxColsFor(
  count: number,
  w: number,
  h: number,
  orientation: Orientation,
): number {
  if (count <= 1) return 1;
  if (orientation === "landscape") {
    const availW = w * 0.92;
    const oneRowW = (availW - 16 * (count - 1)) / count;
    if (oneRowW >= 46 && h >= 280) return count;
    return Math.min(count, Math.max(4, Math.ceil(count / 2)));
  }
  if (count <= 4) return count;
  return 4;
}

export function layoutTubes(
  count: number,
  w: number,
  h: number,
  orientation: Orientation,
): BoardLayout {
  const hudH = hudHeight(h);
  const boardTop = hudH;
  const boardH = Math.max(1, h - hudH);
  const cols = maxColsFor(count, w, h, orientation);
  const rows = rowSizes(count, cols);
  const rowCount = Math.max(1, rows.length);
  const maxInRow = Math.max(1, ...rows);

  const padX = Math.max(16, w * 0.055);
  const padY = Math.max(12, boardH * 0.04);
  const liftRoom = Math.min(40, Math.max(22, boardH * 0.07));
  const hGapMin = 14;
  const vGapMin = 18;

  const availW = Math.max(40, w - padX * 2);
  const availH = Math.max(40, boardH - padY * 2 - liftRoom);
  const vGap = rowCount > 1 ? Math.max(vGapMin, availH * 0.06) : 0;
  const hGap = Math.max(hGapMin, Math.min(28, availW * 0.035));

  const maxTubeW = (availW - hGap * (maxInRow - 1)) / maxInRow;
  const maxTubeH = (availH - vGap * (rowCount - 1)) / rowCount;
  const aspect = 2.72;

  let tubeW = Math.min(76, maxTubeW);
  let tubeH = tubeW * aspect;
  if (tubeH > maxTubeH) {
    tubeH = maxTubeH;
    tubeW = tubeH / aspect;
  }
  tubeW = Math.max(28, Math.min(tubeW, maxTubeW));
  tubeH = Math.max(72, Math.min(tubeH, maxTubeH, tubeW * 3.1));

  const contentH = rowCount * tubeH + (rowCount - 1) * vGap;
  const originY = boardTop + liftRoom + padY + Math.max(0, (availH - contentH) / 2);

  const rects: TubeRect[] = [];
  let index = 0;
  for (let r = 0; r < rowCount; r++) {
    const n = rows[r];
    const rowW = n * tubeW + (n - 1) * hGap;
    const originX = (w - rowW) / 2;
    const y = originY + r * (tubeH + vGap);
    for (let c = 0; c < n; c++) {
      rects.push({
        i: index,
        x: originX + c * (tubeW + hGap),
        y,
        w: tubeW,
        h: tubeH,
      });
      index++;
    }
  }

  return { hudH, rects, tubeW, tubeH };
}

export function hitTubeIndex(x: number, y: number, rects: TubeRect[], pad = HIT_PAD): number {
  let best = -1;
  let bestD = Infinity;
  for (const r of rects) {
    if (x < r.x - pad || x > r.x + r.w + pad || y < r.y - pad || y > r.y + r.h + pad) continue;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
    if (d < bestD) {
      bestD = d;
      best = r.i;
    }
  }
  return best;
}
