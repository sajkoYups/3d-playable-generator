import type { ParkingCar, ParkingJamConfig, ParkingRound } from "@/types/project";
import {
  cloneParkingRound,
  defaultParkingRoundsPack,
  DEFAULT_PARKING_ROUNDS,
} from "@/playable-runtime/engines/parking-jam/rounds";

export function parkingCells(car: ParkingCar): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let i = 0; i < car.length; i++) {
    cells.push(car.axis === "h" ? [car.col + i, car.row] : [car.col, car.row + i]);
  }
  return cells;
}

export function parkingOccupied(cars: ParkingCar[], skipId?: string) {
  const set = new Set<string>();
  for (const c of cars) {
    if (c.id === skipId) continue;
    for (const [x, y] of parkingCells(c)) set.add(`${x},${y}`);
  }
  return set;
}

/** Push overlapping cars along their axis so two vehicles never share a cell. */
export function repairParkingCars(cars: ParkingCar[], cols: number, rows: number): ParkingCar[] {
  const next = cars.map((c) => ({ ...c }));
  for (let i = 0; i < next.length; i++) {
    const car = next[i];
    for (let n = 0; n < cols + rows; n++) {
      const occ = parkingOccupied(next, car.id);
      const clash = parkingCells(car).some(
        ([x, y]) => x < 0 || y < 0 || x >= cols || y >= rows || occ.has(`${x},${y}`),
      );
      if (!clash) break;
      if (car.axis === "h") car.row = Math.min(rows - 1, car.row + 1);
      else car.col = Math.min(cols - 1, car.col + 1);
    }
  }
  return next;
}

export { DEFAULT_PARKING_ROUNDS, defaultParkingRoundAt, defaultParkingRoundsPack, cloneParkingRound } from "@/playable-runtime/engines/parking-jam/rounds";

export const DEFAULT_PARKING_CARS: ParkingCar[] = DEFAULT_PARKING_ROUNDS[0].cars.map((c) => ({ ...c }));

export const DEFAULT_ROUND_COINS = 50;

function roundCoins(value: number | undefined) {
  if (!Number.isFinite(value)) return DEFAULT_ROUND_COINS;
  return Math.min(9999, Math.max(0, Math.round(value as number)));
}

export function listParkingRounds(jam: ParkingJamConfig): ParkingRound[] {
  if (jam.rounds?.length) {
    return jam.rounds.slice(0, 9).map((r) => ({
      gridCols: r.gridCols,
      gridRows: r.gridRows,
      movesLimit: r.movesLimit,
      coins: roundCoins(r.coins),
      cars: r.cars.map((c) => ({ ...c })),
    }));
  }
  return [
    {
      gridCols: jam.gridCols,
      gridRows: jam.gridRows,
      movesLimit: jam.movesLimit,
      coins: DEFAULT_ROUND_COINS,
      cars: jam.cars.map((c) => ({ ...c })),
    },
  ];
}

export function parkingCoinsTotal(jam: ParkingJamConfig) {
  return listParkingRounds(jam).reduce((sum, r) => sum + r.coins, 0);
}

const MAX_PARKING_ROUNDS = 9;

function applyParkingRoundCount(jam: ParkingJamConfig, count: number) {
  const pack = defaultParkingRoundsPack();
  const n = Math.min(MAX_PARKING_ROUNDS, Math.max(1, Math.round(count)));
  const prev = jam.rounds ?? [];
  jam.rounds = pack.slice(0, n).map((p, i) => {
    const existing = prev[i];
    if (existing) {
      const next = cloneParkingRound(existing);
      next.coins = roundCoins(existing.coins);
      return next;
    }
    return cloneParkingRound(p);
  });
}

/** Keep the current round count (1–9). Empty lists hydrate to the full pack. */
export function ensureParkingRounds(jam: ParkingJamConfig) {
  const prev = jam.rounds ?? [];
  applyParkingRoundCount(jam, prev.length || defaultParkingRoundsPack().length);
}

/** Slice or grow the pack prefix so the playable has exactly `count` rounds. */
export function setParkingRoundCount(jam: ParkingJamConfig, count: number) {
  applyParkingRoundCount(jam, count);
}

export function syncParkingRound(jam: ParkingJamConfig, index: number) {
  const round = jam.rounds[Math.max(0, Math.min(index, jam.rounds.length - 1))];
  if (!round) return;
  jam.cars = round.cars;
  jam.gridCols = round.gridCols;
  jam.gridRows = round.gridRows;
  jam.movesLimit = round.movesLimit;
}
