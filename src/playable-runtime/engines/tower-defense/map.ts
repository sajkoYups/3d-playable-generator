/** Kenney tower-defense tiles are 1×1. Dirt runs north-south at rot 0. */
export const TILE_SIZE = 1;
export const MAP_COLS = 8;
export const MAP_ROWS = 14;

export type TileKind = "grass" | "straight" | "corner" | "spawn" | "end" | "river" | "bridge" | "build";

export type MapCell = {
  col: number;
  row: number;
  kind: TileKind;
  rot: number;
  model: string;
  y?: number;
  support?: { model: string; rot: number };
};

export type MapProp = {
  col: number;
  row: number;
  model: string;
  rot: number;
  scale: number;
  y?: number;
  ox?: number;
  oz?: number;
};

export type TdMap = {
  cols: number;
  rows: number;
  tileSize: number;
  cells: MapCell[];
  props: MapProp[];
  path: Array<{ col: number; row: number }>;
  pads: Array<{ col: number; row: number }>;
  spawn: { col: number; row: number };
  base: { col: number; row: number };
};

type Cell = { col: number; row: number };
type Dir = { dc: number; dr: number };

/**
 * Portrait village. Row 0 is the far mountains. The path leaves the castle gate,
 * snakes through the houses, crosses the gap, and ends at the near edge.
 * Letters: # path, o pad, H hill, C castle, R house, T/D/Q trees, F fence, S slope, K rock, G grass.
 */
const VILLAGE = [
  "HHHHHHHH",
  "CCC#CCCC",
  "RTG#oDQT",
  "o###RTDQ",
  "T#oFGRTT",
  "T#####oQ",
  "DFGRo#TQ",
  "QT####DR",
  "TG#oTFDQ",
  "TT####RD",
  "SSSSS#oS",
  "QTKG##TD",
  "DRTT#oQT",
  "TDQG#RTD",
];

const GROUND: Record<string, { model: string; kind: TileKind }> = {
  H: { model: "tile", kind: "grass" },
  C: { model: "tower-square-bottom-a", kind: "grass" },
  T: { model: "tile-tree", kind: "grass" },
  D: { model: "tile-tree-double", kind: "grass" },
  Q: { model: "tile-tree-quad", kind: "grass" },
  F: { model: "wood-structure", kind: "grass" },
  S: { model: "tile-slope", kind: "grass" },
  K: { model: "tile-rock", kind: "grass" },
  G: { model: "tile", kind: "grass" },
  R: { model: "tile", kind: "grass" },
  o: { model: "tower-round-base", kind: "build" },
};

function keyOf(col: number, row: number) {
  return `${col},${row}`;
}

function dirBetween(a: Cell, b: Cell): Dir {
  return { dc: Math.sign(b.col - a.col), dr: Math.sign(b.row - a.row) };
}

function edgeBit(d: Dir) {
  if (d.dr < 0) return 1;
  if (d.dc > 0) return 2;
  if (d.dr > 0) return 4;
  return 8;
}

/** Straight tile runs along Z at rot 0. */
function straightRot(dir: Dir) {
  return dir.dr !== 0 ? 0 : 1;
}

/** Corner at rot 0 joins east (+X) and south (+Z). */
function cornerRot(inDir: Dir, outDir: Dir) {
  const entry = { dc: -inDir.dc, dr: -inDir.dr };
  const bits = edgeBit(entry) | edgeBit(outDir);
  const map: Record<number, number> = { 6: 0, 3: 1, 9: 2, 12: 3 };
  return map[bits] ?? 0;
}

/** End tile opens toward local +Z. */
function endRot(dir: Dir) {
  if (dir.dr > 0) return 0;
  if (dir.dc < 0) return 1;
  if (dir.dr < 0) return 2;
  return 3;
}

function pathFromVillage(): Cell[] {
  const cells: Cell[] = [];
  VILLAGE.forEach((line, row) => {
    for (let col = 0; col < line.length; col++) {
      if (line[col] === "#") cells.push({ col, row });
    }
  });
  const byKey = new Map(cells.map((c) => [keyOf(c.col, c.row), c]));
  const start = cells.find((c) => c.row === 1);
  if (!start) return cells;
  const ordered: Cell[] = [start];
  const used = new Set<string>([keyOf(start.col, start.row)]);
  while (ordered.length < cells.length) {
    const cur = ordered[ordered.length - 1];
    const next = [
      { col: cur.col, row: cur.row + 1 },
      { col: cur.col + 1, row: cur.row },
      { col: cur.col - 1, row: cur.row },
      { col: cur.col, row: cur.row - 1 },
    ].find((n) => byKey.has(keyOf(n.col, n.row)) && !used.has(keyOf(n.col, n.row)));
    if (!next) break;
    used.add(keyOf(next.col, next.row));
    ordered.push(next);
  }
  return ordered;
}

function classifyPath(path: Cell[]) {
  const meta = new Map<string, { kind: TileKind; rot: number; model: string }>();
  for (let i = 0; i < path.length; i++) {
    const cur = path[i];
    const prev = path[i - 1];
    const next = path[i + 1];
    if (!prev && next) {
      meta.set(keyOf(cur.col, cur.row), { kind: "spawn", rot: endRot(dirBetween(cur, next)), model: "tile-spawn" });
      continue;
    }
    if (!next && prev) {
      meta.set(keyOf(cur.col, cur.row), { kind: "end", rot: endRot(dirBetween(cur, prev)), model: "tile-end" });
      continue;
    }
    if (!prev || !next) continue;
    const inDir = dirBetween(prev, cur);
    const outDir = dirBetween(cur, next);
    const turn = inDir.dc !== outDir.dc || inDir.dr !== outDir.dr;
    meta.set(keyOf(cur.col, cur.row), turn
      ? { kind: "corner", rot: cornerRot(inDir, outDir), model: "tile-corner-round" }
      : { kind: "straight", rot: straightRot(outDir), model: "tile-straight" });
  }
  return meta;
}

export function cellToWorld(col: number, row: number, cols = MAP_COLS, rows = MAP_ROWS, tileSize = TILE_SIZE) {
  return {
    x: (col - (cols - 1) / 2) * tileSize,
    z: (row - (rows - 1) / 2) * tileSize,
  };
}

export function buildTdMap(_roundIndex: number): TdMap {
  const path = pathFromVillage();
  const pathMeta = classifyPath(path);
  const pads: Cell[] = [];
  const cells: MapCell[] = [];
  const props: MapProp[] = [];
  let houses = 0;

  VILLAGE.forEach((line, row) => {
    for (let col = 0; col < MAP_COLS; col++) {
      const mark = line[col] ?? "G";
      const onPath = pathMeta.get(keyOf(col, row));
      if (onPath) {
        const bridge = row === 10;
        cells.push(bridge
          ? { col, row, kind: "bridge", rot: onPath.rot, model: "tile-straight" }
          : { col, row, ...onPath });
        if (bridge) {
          props.push({ col, row, model: "wood-structure-part", rot: 1, scale: 1, y: 0.2, ox: -0.42 });
          props.push({ col, row, model: "wood-structure-part", rot: 1, scale: 1, y: 0.2, ox: 0.42 });
        }
        continue;
      }
      if (mark === "o") pads.push({ col, row });
      const ground = GROUND[mark] ?? GROUND.G;
      cells.push({ col, row, kind: ground.kind, rot: 0, model: ground.model });
      if (mark === "H" && col % 2 === 0) {
        props.push({
          col,
          row,
          model: col % 4 === 0 ? "cliff-large" : "rock-peak",
          rot: 0,
          scale: col % 4 === 0 ? 1.35 : 1.15,
          y: 0.2,
        });
      }
      if (mark === "C") {
        const tower = col === 0 || col === MAP_COLS - 1;
        if (tower) {
          props.push({ col, row, model: "tower-square-middle-a", rot: col === 0 ? 1 : 3, scale: 1, y: 0.5 });
          props.push({ col, row, model: "tower-square-top-a", rot: col === 0 ? 1 : 3, scale: 1, y: 1 });
        } else {
          props.push({ col, row, model: "tower-square-top-a", rot: 0, scale: 1, y: 0.5 });
        }
      }
      if (mark === "R") {
        props.push({
          col,
          row,
          model: houses % 2 === 0 ? "tower-square-roof-a" : "tower-square-roof-b",
          rot: (col + row) % 4,
          scale: 0.78,
          y: 0.2,
        });
        houses += 1;
      }
    }
  });

  const flowers = ["flower-red", "flower-yellow", "flower-purple"] as const;
  const accents: Array<[number, number, string]> = [
    [2, 2, "detail-tree"],
    [2, 6, "detail-tree-large"],
    [1, 8, "detail-tree"],
    [6, 13, flowers[0]],
    [3, 11, flowers[1]],
    [6, 12, flowers[2]],
    [3, 13, "detail-rocks"],
    [4, 4, flowers[0]],
  ];
  for (const [col, row, model] of accents) {
    const tiny = model.startsWith("flower") || model.startsWith("detail");
    props.push({ col, row, model, rot: (col + row) % 4, scale: tiny ? 0.85 : 1, y: 0.2 });
  }

  return {
    cols: MAP_COLS,
    rows: MAP_ROWS,
    tileSize: TILE_SIZE,
    cells,
    props,
    path: path.map((p) => ({ ...p })),
    pads: pads.map((p) => ({ ...p })),
    spawn: { ...path[0] },
    base: { ...path[path.length - 1] },
  };
}

export function buildDefaultMap(): TdMap {
  return buildTdMap(0);
}

export function pathWaypoints(map: TdMap) {
  return map.path.map((p) => {
    const { x, z } = cellToWorld(p.col, p.row, map.cols, map.rows, map.tileSize);
    return { x, z };
  });
}
