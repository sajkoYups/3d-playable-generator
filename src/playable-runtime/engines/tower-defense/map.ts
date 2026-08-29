/** Kenney TD Kit 2.1 tiles are 1×1 slabs. Spacing must match or the board gaps. */
export const TILE_SIZE = 1;
export const MAP_COLS = 8;
export const MAP_ROWS = 8;

export type TileKind = "grass" | "straight" | "corner" | "spawn" | "end" | "tree" | "rock" | "build";

export type MapCell = {
  col: number;
  row: number;
  kind: TileKind;
  rot: number;
  model: string;
};

export type TdMap = {
  cols: number;
  rows: number;
  tileSize: number;
  cells: MapCell[];
  path: Array<{ col: number; row: number }>;
  pads: Array<{ col: number; row: number }>;
  spawn: { col: number; row: number };
  base: { col: number; row: number };
};

type Dir = { dc: number; dr: number };

const PATH: Array<{ col: number; row: number }> = [
  { col: 0, row: 2 },
  { col: 1, row: 2 },
  { col: 2, row: 2 },
  { col: 3, row: 2 },
  { col: 4, row: 2 },
  { col: 5, row: 2 },
  { col: 5, row: 3 },
  { col: 5, row: 4 },
  { col: 4, row: 4 },
  { col: 3, row: 4 },
  { col: 2, row: 4 },
  { col: 2, row: 5 },
  { col: 2, row: 6 },
  { col: 3, row: 6 },
  { col: 4, row: 6 },
  { col: 5, row: 6 },
  { col: 6, row: 6 },
  { col: 7, row: 6 },
];

const PADS: Array<{ col: number; row: number }> = [
  { col: 1, row: 1 },
  { col: 3, row: 1 },
  { col: 4, row: 3 },
  { col: 3, row: 3 },
  { col: 1, row: 3 },
  { col: 3, row: 5 },
  { col: 4, row: 5 },
  { col: 6, row: 5 },
];

const TREES: Array<{ col: number; row: number }> = [
  { col: 0, row: 0 },
  { col: 2, row: 0 },
  { col: 6, row: 0 },
  { col: 7, row: 0 },
  { col: 0, row: 7 },
  { col: 7, row: 7 },
  { col: 0, row: 4 },
  { col: 4, row: 0 },
];

const ROCKS: Array<{ col: number; row: number }> = [
  { col: 7, row: 1 },
  { col: 0, row: 6 },
  { col: 6, row: 2 },
  { col: 7, row: 3 },
];

function dirBetween(a: { col: number; row: number }, b: { col: number; row: number }): Dir {
  return { dc: Math.sign(b.col - a.col), dr: Math.sign(b.row - a.row) };
}

function edgeBit(d: Dir) {
  if (d.dr < 0) return 1;
  if (d.dc > 0) return 2;
  if (d.dr > 0) return 4;
  return 8;
}

function straightRot(dir: Dir) {
  return dir.dc !== 0 ? 0 : 1;
}

/** Kenney corner-round at rot 0 connects east (+X) and south (+Z). */
function cornerRot(inDir: Dir, outDir: Dir) {
  const entry = { dc: -inDir.dc, dr: -inDir.dr };
  const bits = edgeBit(entry) | edgeBit(outDir);
  const map: Record<number, number> = {
    6: 0,
    12: 1,
    9: 2,
    3: 3,
  };
  return map[bits] ?? 0;
}

function headingRot(dir: Dir) {
  if (dir.dc > 0) return 0;
  if (dir.dr > 0) return 1;
  if (dir.dc < 0) return 2;
  return 3;
}

function keyOf(col: number, row: number) {
  return `${col},${row}`;
}

export function cellToWorld(col: number, row: number, cols = MAP_COLS, rows = MAP_ROWS, tileSize = TILE_SIZE) {
  return {
    x: (col - (cols - 1) / 2) * tileSize,
    z: (row - (rows - 1) / 2) * tileSize,
  };
}

export function buildDefaultMap(): TdMap {
  const padSet = new Set(PADS.map((p) => keyOf(p.col, p.row)));
  const treeSet = new Set(TREES.map((p) => keyOf(p.col, p.row)));
  const rockSet = new Set(ROCKS.map((p) => keyOf(p.col, p.row)));
  const pathMeta = new Map<string, { kind: TileKind; rot: number; model: string }>();

  for (let i = 0; i < PATH.length; i++) {
    const cur = PATH[i];
    const prev = PATH[i - 1];
    const next = PATH[i + 1];
    if (i === 0 && next) {
      pathMeta.set(keyOf(cur.col, cur.row), {
        kind: "spawn",
        rot: headingRot(dirBetween(cur, next)),
        model: "tile-spawn",
      });
      continue;
    }
    if (i === PATH.length - 1 && prev) {
      pathMeta.set(keyOf(cur.col, cur.row), {
        kind: "end",
        rot: headingRot(dirBetween(prev, cur)),
        model: "tile-end",
      });
      continue;
    }
    if (!prev || !next) continue;
    const inDir = dirBetween(prev, cur);
    const outDir = dirBetween(cur, next);
    const turn = inDir.dc !== outDir.dc || inDir.dr !== outDir.dr;
    pathMeta.set(keyOf(cur.col, cur.row), turn
      ? { kind: "corner", rot: cornerRot(inDir, outDir), model: "tile-corner-round" }
      : { kind: "straight", rot: straightRot(outDir), model: "tile-straight" });
  }

  const cells: MapCell[] = [];
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      const k = keyOf(col, row);
      const path = pathMeta.get(k);
      if (path) {
        cells.push({ col, row, ...path });
        continue;
      }
      if (padSet.has(k)) {
        cells.push({ col, row, kind: "build", rot: 0, model: "tile" });
        continue;
      }
      if (treeSet.has(k)) {
        cells.push({ col, row, kind: "tree", rot: (col + row) % 4, model: "tile-tree" });
        continue;
      }
      if (rockSet.has(k)) {
        cells.push({ col, row, kind: "rock", rot: (col * 3 + row) % 4, model: "tile-rock" });
        continue;
      }
      cells.push({ col, row, kind: "grass", rot: 0, model: "tile" });
    }
  }

  return {
    cols: MAP_COLS,
    rows: MAP_ROWS,
    tileSize: TILE_SIZE,
    cells,
    path: PATH.map((p) => ({ ...p })),
    pads: PADS.map((p) => ({ ...p })),
    spawn: { ...PATH[0] },
    base: { ...PATH[PATH.length - 1] },
  };
}

export function pathWaypoints(map: TdMap) {
  return map.path.map((p) => {
    const { x, z } = cellToWorld(p.col, p.row, map.cols, map.rows, map.tileSize);
    return { x, z };
  });
}
