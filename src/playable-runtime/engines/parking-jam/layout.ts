import type { ParkingCar } from "@/types/project";

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

export const DEFAULT_PARKING_CARS: ParkingCar[] = [
  { id: "hero", col: 0, row: 2, length: 2, axis: "h", color: "#e07a3d", isHero: true },
  { id: "c1", col: 2, row: 0, length: 3, axis: "v", color: "#2bb5a0", isHero: false },
  { id: "c2", col: 3, row: 1, length: 2, axis: "h", color: "#7c5cff", isHero: false },
  { id: "c3", col: 4, row: 3, length: 3, axis: "v", color: "#e85d4c", isHero: false },
  { id: "c4", col: 0, row: 5, length: 2, axis: "h", color: "#f3ede0", isHero: false },
  { id: "c5", col: 1, row: 3, length: 2, axis: "v", color: "#3d7cff", isHero: false },
];
