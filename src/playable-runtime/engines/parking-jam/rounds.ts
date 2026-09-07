import type { ParkingCar, ParkingRound } from "@/types/project";

const C = {
  hero: "#ff3b30",
  teal: "#2bb5a0",
  purple: "#7c5cff",
  red: "#e85d4c",
  cream: "#f3ede0",
  blue: "#3d7cff",
  yellow: "#e8c547",
  pink: "#e85aad",
  green: "#5cbf5a",
  brown: "#c47a4a",
  cyan: "#4ecdc4",
  slate: "#8b95a8",
};

function car(
  id: string,
  col: number,
  row: number,
  length: 2 | 3 | 4,
  axis: "h" | "v",
  color: string,
  isHero = false,
): ParkingCar {
  return { id, col, row, length, axis, color, isHero };
}

function round(
  cars: ParkingCar[],
  opts: { movesLimit: number; coins: number; gridCols?: number; gridRows?: number },
): ParkingRound {
  return {
    gridCols: opts.gridCols ?? 6,
    gridRows: opts.gridRows ?? 6,
    movesLimit: opts.movesLimit,
    coins: opts.coins,
    cars,
  };
}

function occKey(x: number, y: number) {
  return `${x},${y}`;
}

function occupancy(cars: ParkingCar[], skipId: string) {
  const set = new Set<string>();
  for (const c of cars) {
    if (c.id === skipId) continue;
    for (let i = 0; i < c.length; i++) {
      set.add(c.axis === "h" ? occKey(c.col + i, c.row) : occKey(c.col, c.row + i));
    }
  }
  return set;
}

function encode(cars: ParkingCar[]) {
  return cars
    .map((c) => `${c.id}:${c.col},${c.row}`)
    .sort()
    .join("|");
}

function step(
  cars: ParkingCar[],
  id: string,
  dCol: number,
  dRow: number,
  cols: number,
  rows: number,
): "exit" | ParkingCar[] | null {
  const target = cars.find((c) => c.id === id);
  if (!target) return null;
  if (target.axis === "h" && dRow) return null;
  if (target.axis === "v" && dCol) return null;
  const ncol = target.col + dCol;
  const nrow = target.row + dRow;
  const occ = occupancy(cars, id);
  for (let i = 0; i < target.length; i++) {
    const x = target.axis === "h" ? ncol + i : ncol;
    const y = target.axis === "v" ? nrow + i : nrow;
    if (y < 0 || y >= rows || x < 0) return null;
    if (x >= cols) return target.isHero ? "exit" : null;
    if (occ.has(occKey(x, y))) return null;
  }
  return cars.map((c) => (c.id === id ? { ...c, col: ncol, row: nrow } : c));
}

/** BFS: min 1-cell moves to drive the hero off the right edge, or null if impossible. */
export function parkingRoundMinMoves(lot: ParkingRound): number | null {
  const cols = lot.gridCols;
  const rows = lot.gridRows;
  const start = lot.cars.map((c) => ({ ...c }));
  const seen = new Set<string>([encode(start)]);
  const queue: Array<{ cars: ParkingCar[]; dist: number }> = [{ cars: start, dist: 0 }];
  const dirs: Array<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  let head = 0;
  while (head < queue.length && head < 80000) {
    const cur = queue[head++];
    for (const c of cur.cars) {
      for (const [dx, dy] of dirs) {
        const next = step(cur.cars, c.id, dx, dy, cols, rows);
        if (next === "exit") return cur.dist + 1;
        if (!next) continue;
        const key = encode(next);
        if (seen.has(key)) continue;
        seen.add(key);
        queue.push({ cars: next, dist: cur.dist + 1 });
      }
    }
  }
  return null;
}

/**
 * Nine distinct Rush-Hour lots. Only vertical cars sit on the hero row (horizontals
 * on that row can never leave it, which made earlier rounds unsolvable).
 */
export const DEFAULT_PARKING_ROUNDS: ParkingRound[] = [
  round(
    [
      car("hero", 0, 2, 2, "h", C.hero, true),
      car("c1", 3, 0, 3, "v", C.teal),
      car("c2", 0, 5, 2, "h", C.purple),
      car("c3", 4, 4, 2, "v", C.red),
    ],
    { movesLimit: 18, coins: 40 },
  ),
  round(
    [
      car("hero", 0, 2, 2, "h", C.hero, true),
      car("c1", 2, 0, 3, "v", C.blue),
      car("c2", 4, 0, 2, "v", C.yellow),
      car("c3", 1, 4, 2, "h", C.pink),
      car("c4", 4, 4, 2, "v", C.green),
      car("c5", 0, 5, 3, "h", C.cream),
    ],
    { movesLimit: 20, coins: 45 },
  ),
  round(
    [
      car("hero", 0, 2, 2, "h", C.hero, true),
      car("c1", 2, 0, 3, "v", C.teal),
      car("c2", 4, 2, 2, "v", C.purple),
      car("c3", 0, 0, 2, "h", C.red),
      car("c4", 3, 0, 2, "h", C.cream),
      car("c5", 5, 1, 2, "v", C.blue),
      car("c6", 0, 5, 2, "h", C.yellow),
    ],
    { movesLimit: 22, coins: 50 },
  ),
  round(
    [
      car("hero", 0, 2, 2, "h", C.hero, true),
      car("c1", 2, 0, 3, "v", C.teal),
      car("c2", 4, 2, 2, "v", C.purple),
      car("c3", 5, 1, 2, "v", C.red),
      car("c4", 0, 4, 2, "h", C.cream),
      car("c5", 3, 4, 2, "h", C.blue),
      car("c6", 0, 5, 2, "h", C.yellow),
      car("c7", 3, 0, 2, "h", C.pink),
    ],
    { movesLimit: 24, coins: 55 },
  ),
  round(
    [
      car("hero", 0, 2, 2, "h", C.hero, true),
      car("c1", 2, 0, 3, "v", C.teal),
      car("c2", 4, 2, 2, "v", C.purple),
      car("c3", 5, 1, 2, "v", C.red),
      car("c4", 0, 0, 2, "h", C.cream),
      car("c5", 3, 0, 2, "h", C.blue),
      car("c6", 0, 4, 2, "h", C.yellow),
      car("c7", 3, 4, 2, "v", C.pink),
      car("c8", 0, 5, 2, "h", C.green),
    ],
    { movesLimit: 26, coins: 60 },
  ),
  round(
    [
      car("hero", 0, 2, 2, "h", C.hero, true),
      car("c1", 2, 0, 3, "v", C.teal),
      car("c2", 3, 2, 2, "v", C.purple),
      car("c3", 5, 0, 3, "v", C.red),
      car("c4", 0, 0, 2, "h", C.cream),
      car("c5", 3, 0, 2, "h", C.blue),
      car("c6", 0, 1, 2, "h", C.yellow),
      car("c7", 0, 4, 2, "h", C.pink),
      car("c8", 0, 5, 2, "h", C.green),
      car("c9", 4, 4, 2, "v", C.brown),
    ],
    { movesLimit: 28, coins: 70 },
  ),
  round(
    [
      car("hero", 0, 2, 2, "h", C.hero, true),
      car("c1", 2, 0, 3, "v", C.teal),
      car("c2", 4, 2, 2, "v", C.purple),
      car("c3", 5, 1, 2, "v", C.red),
      car("c4", 0, 0, 2, "h", C.cream),
      car("c5", 3, 0, 2, "h", C.blue),
      car("c6", 0, 1, 2, "h", C.yellow),
      car("c7", 0, 3, 2, "h", C.pink),
      car("c8", 0, 4, 2, "h", C.green),
      car("c9", 0, 5, 2, "h", C.brown),
      car("c10", 3, 4, 2, "v", C.cyan),
    ],
    { movesLimit: 30, coins: 80 },
  ),
  round(
    [
      car("hero", 0, 2, 2, "h", C.hero, true),
      car("c1", 2, 0, 3, "v", C.teal),
      car("c2", 4, 2, 2, "v", C.purple),
      car("c3", 5, 1, 3, "v", C.red),
      car("c4", 0, 0, 2, "h", C.cream),
      car("c5", 3, 0, 2, "h", C.blue),
      car("c6", 0, 1, 2, "h", C.yellow),
      car("c7", 0, 3, 2, "h", C.pink),
      car("c8", 0, 4, 2, "h", C.green),
      car("c9", 0, 5, 2, "h", C.brown),
      car("c10", 3, 4, 2, "v", C.cyan),
      car("c11", 4, 5, 2, "h", C.slate),
    ],
    { movesLimit: 32, coins: 90 },
  ),
  round(
    [
      car("hero", 0, 2, 2, "h", C.hero, true),
      car("c1", 2, 0, 3, "v", C.teal),
      car("c2", 3, 1, 2, "v", C.purple),
      car("c3", 4, 2, 2, "v", C.red),
      car("c4", 5, 0, 3, "v", C.cream),
      car("c5", 0, 0, 2, "h", C.blue),
      car("c6", 3, 0, 2, "h", C.yellow),
      car("c7", 0, 1, 2, "h", C.pink),
      car("c8", 0, 3, 2, "h", C.green),
      car("c9", 0, 4, 2, "h", C.brown),
      car("c10", 0, 5, 2, "h", C.cyan),
      car("c11", 3, 5, 2, "h", C.slate),
    ],
    { movesLimit: 36, coins: 100 },
  ),
];

export function cloneParkingRound(src: ParkingRound): ParkingRound {
  return {
    gridCols: src.gridCols,
    gridRows: src.gridRows,
    movesLimit: src.movesLimit,
    coins: src.coins,
    cars: src.cars.map((c) => ({ ...c })),
  };
}

export function defaultParkingRoundAt(index: number): ParkingRound {
  const i = Math.max(0, Math.min(index, DEFAULT_PARKING_ROUNDS.length - 1));
  return cloneParkingRound(DEFAULT_PARKING_ROUNDS[i]);
}

export function defaultParkingRoundsPack(): ParkingRound[] {
  return DEFAULT_PARKING_ROUNDS.map(cloneParkingRound);
}

export function parkingRoundOverlap(lot: ParkingRound): string | null {
  const seen = new Map<string, string>();
  let heroes = 0;
  for (const c of lot.cars) {
    if (c.isHero) {
      heroes += 1;
      if (c.axis !== "h") return `${c.id} hero must be horizontal`;
    }
    for (let i = 0; i < c.length; i++) {
      const x = c.axis === "h" ? c.col + i : c.col;
      const y = c.axis === "v" ? c.row + i : c.row;
      if (x < 0 || y < 0 || x >= lot.gridCols || y >= lot.gridRows) {
        return `${c.id} out of bounds at ${x},${y}`;
      }
      const key = occKey(x, y);
      const other = seen.get(key);
      if (other) return `${c.id} overlaps ${other} at ${key}`;
      seen.set(key, c.id);
    }
  }
  if (heroes !== 1) return `expected 1 hero, got ${heroes}`;
  return null;
}

export function parkingRoundFingerprint(lot: ParkingRound) {
  return lot.cars
    .map((c) => `${c.id}:${c.col},${c.row},${c.length},${c.axis}`)
    .sort()
    .join(";");
}
