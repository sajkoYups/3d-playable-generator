export const TUBE_CAPACITY = 4;

export type Tube = number[];

export function cloneTubes(tubes: Tube[]): Tube[] {
  return tubes.map((tube) => tube.slice());
}

export function buildLevel(colorCount: number): Tube[] {
  const n = Math.max(1, Math.min(5, colorCount || 5));
  const stack: number[] = [];
  for (let c = 0; c < n; c++) {
    for (let i = 0; i < TUBE_CAPACITY; i++) stack.push(c);
  }
  for (let i = stack.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [stack[i], stack[j]] = [stack[j], stack[i]];
  }
  const result: Tube[] = [];
  for (let t = 0; t < n; t++) {
    result.push(stack.slice(t * TUBE_CAPACITY, t * TUBE_CAPACITY + TUBE_CAPACITY));
  }
  result.push([]);
  result.push([]);
  return result;
}

export function isComplete(tube: Tube): boolean {
  return tube.length === TUBE_CAPACITY && tube.every((c) => c === tube[0]);
}

export function isSolved(tubes: Tube[]): boolean {
  return tubes.every((tube) => tube.length === 0 || isComplete(tube));
}

export type PourMove = { color: number; count: number };

/** Same legality as the original engine: nonempty source, dest has space, empty or matching top. */
export function canPour(from: number, to: number, tubes: Tube[]): PourMove | null {
  if (from === to) return null;
  const src = tubes[from];
  const dst = tubes[to];
  if (!src?.length || !dst || dst.length >= TUBE_CAPACITY) return null;
  const color = src[src.length - 1];
  if (dst.length && dst[dst.length - 1] !== color) return null;
  let count = 0;
  for (let i = src.length - 1; i >= 0 && src[i] === color && dst.length + count < TUBE_CAPACITY; i--) {
    count++;
  }
  return count > 0 ? { color, count } : null;
}

export function applyPour(from: number, to: number, tubes: Tube[]): number {
  const move = canPour(from, to, tubes);
  if (!move) return 0;
  const src = tubes[from];
  const dst = tubes[to];
  for (let i = 0; i < move.count; i++) src.pop();
  for (let i = 0; i < move.count; i++) dst.push(move.color);
  return move.count;
}
