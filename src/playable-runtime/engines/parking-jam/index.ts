import { Color, Group, Mesh, MeshStandardMaterial, PlaneGeometry, Raycaster, Vector2 } from "three";
import type { ParkingCar, ParkingJamConfig } from "@/types/project";
import type { EngineInitContext, Playable3DEngine } from "@/playable-runtime/engines/types";
import { ThreeHost } from "@/playable-runtime/three/host";
import { applyLivePresentation } from "@/playable-runtime/three/presentation";
import { attachPointer } from "@/playable-runtime/three/input";
import { blobShadow, createProceduralModel } from "@/playable-runtime/models/procedural";

type CarActor = {
  spec: ParkingCar;
  group: Group;
};

function cellsFor(car: ParkingCar): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let i = 0; i < car.length; i++) {
    cells.push(car.axis === "h" ? [car.col + i, car.row] : [car.col, car.row + i]);
  }
  return cells;
}

function occupied(cars: ParkingCar[], skipId?: string) {
  const set = new Set<string>();
  for (const c of cars) {
    if (c.id === skipId) continue;
    for (const [x, y] of cellsFor(c)) set.add(`${x},${y}`);
  }
  return set;
}

export function createParkingJamEngine(): Playable3DEngine {
  let host: ThreeHost | null = null;
  let config: ParkingJamConfig | null = null;
  let cars: CarActor[] = [];
  let state: ParkingCar[] = [];
  let selected: CarActor | null = null;
  let dragStart: { col: number; row: number; clientX: number; clientY: number } | null = null;
  let moves = 0;
  let started = false;
  let ended = false;
  let onWin: () => void = () => undefined;
  let onLose: () => void = () => undefined;
  let detach: (() => void) | null = null;
  let root: Group | null = null;
  let ctx: EngineInitContext | null = null;
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const cell = 1.15;

  function worldOf(col: number, row: number, length: number, axis: "h" | "v") {
    const x = (col + (axis === "h" ? (length - 1) / 2 : 0) - (config!.gridCols - 1) / 2) * cell;
    const z = (row + (axis === "v" ? (length - 1) / 2 : 0) - (config!.gridRows - 1) / 2) * cell;
    return { x, z };
  }

  function syncMeshes() {
    for (const actor of cars) {
      const spec = state.find((c) => c.id === actor.spec.id);
      if (!spec) {
        actor.group.visible = false;
        continue;
      }
      actor.spec = spec;
      const { x, z } = worldOf(spec.col, spec.row, spec.length, spec.axis);
      actor.group.position.set(x, 0.2, z);
      actor.group.rotation.y = spec.axis === "h" ? 0 : Math.PI / 2;
    }
  }

  function finish(kind: "win" | "lose") {
    if (ended) return;
    ended = true;
    started = false;
    if (kind === "win") onWin();
    else onLose();
  }

  function tryMove(car: ParkingCar, dCol: number, dRow: number) {
    if (car.axis === "h" && dRow) return false;
    if (car.axis === "v" && dCol) return false;
    const next = { ...car, col: car.col + dCol, row: car.row + dRow };
    const occ = occupied(state, car.id);
    for (const [x, y] of cellsFor(next)) {
      if (x < 0 || y < 0 || y >= config!.gridRows) return false;
      if (x >= config!.gridCols) {
        if (car.isHero) return "exit";
        return false;
      }
      if (occ.has(`${x},${y}`)) return false;
    }
    car.col = next.col;
    car.row = next.row;
    return true;
  }

  function build() {
    if (!host || !config || !root) return;
    while (root.children.length) root.remove(root.children[0]);
    cars = [];
    state = config.cars.map((c) => ({ ...c }));
    moves = 0;
    ended = false;

    const lotW = config.gridCols * cell + 0.4;
    const lotH = config.gridRows * cell + 0.4;
    const lotGeo = new PlaneGeometry(lotW, lotH);
    host.tracker.track(lotGeo);
    const lotMat = new MeshStandardMaterial({
      color: config.lotTextureUrl ? "#4a4e58" : "#3a3e48",
      roughness: 0.9,
    });
    host.tracker.track(lotMat);
    const lot = new Mesh(lotGeo, lotMat);
    lot.rotation.x = -Math.PI / 2;
    root.add(lot);

    const exitGeo = new PlaneGeometry(1.2, cell * 1.2);
    host.tracker.track(exitGeo);
    const exitMat = new MeshStandardMaterial({ color: new Color("#e07a3d"), roughness: 0.5 });
    host.tracker.track(exitMat);
    const exit = new Mesh(exitGeo, exitMat);
    exit.rotation.x = -Math.PI / 2;
    exit.position.set(((config.gridCols) / 2) * cell, 0.03, (2 - (config.gridRows - 1) / 2) * cell);
    root.add(exit);

    for (const spec of state) {
      const group = createProceduralModel("sedan", host.tracker, spec.color);
      group.scale.set(0.55 + spec.length * 0.12, 0.7, 0.7);
      group.add(blobShadow(host.tracker, 0.55));
      root.add(group);
      cars.push({ spec, group });
    }
    syncMeshes();
  }

  function pick(ndcX: number, ndcY: number) {
    if (!host) return null;
    pointer.set(ndcX, ndcY);
    raycaster.setFromCamera(pointer, host.camera);
    const meshes: Array<{ mesh: Mesh; actor: CarActor }> = [];
    for (const actor of cars) {
      actor.group.traverse((ch) => {
        if (ch instanceof Mesh) meshes.push({ mesh: ch, actor });
      });
    }
    const hits = raycaster.intersectObjects(meshes.map((m) => m.mesh));
    if (!hits.length) return null;
    return meshes.find((m) => m.mesh === hits[0].object)?.actor ?? null;
  }

  return {
    id: "parking-jam",
    name: "Parking Jam",
    initialize(init) {
      ctx = init;
      config = ((init as EngineInitContext & { parkingJam?: ParkingJamConfig }).parkingJam) ?? null;
      if (!config) {
        config = {
          lotTextureUrl: "",
          carColors: ["#e07a3d"],
          movesLimit: 24,
          difficulty: "medium",
          gridCols: 6,
          gridRows: 6,
          cars: [],
        };
      }
      host = new ThreeHost(init.container);
      host.applyLighting(init.lighting);
      host.applyCamera(init.camera, init.orientation, host.camera.aspect);
      root = new Group();
      host.scene.add(root);
      build();
      detach = attachPointer(host.canvas, (e) => {
        if (!started || ended) return;
        if (e.kind === "down") {
          selected = pick(e.ndcX, e.ndcY) ?? null;
          if (selected) {
            dragStart = {
              col: selected.spec.col,
              row: selected.spec.row,
              clientX: e.clientX,
              clientY: e.clientY,
            };
          }
        }
        if (e.kind === "up" && selected && dragStart && config) {
          const dx = e.clientX - dragStart.clientX;
          const dy = e.clientY - dragStart.clientY;
          const car = state.find((c) => c.id === selected!.spec.id);
          if (car) {
            let moved = false;
            if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 18) {
              const step = dx > 0 ? 1 : -1;
              const result = tryMove(car, step, 0);
              if (result === "exit") {
                state = state.filter((c) => c.id !== car.id);
                syncMeshes();
                finish("win");
                return;
              }
              moved = result === true;
            } else if (Math.abs(dy) > 18) {
              const step = dy > 0 ? 1 : -1;
              moved = tryMove(car, 0, step) === true;
            }
            if (moved) {
              moves += 1;
              syncMeshes();
              if (moves >= config.movesLimit) finish("lose");
            }
          }
          selected = null;
          dragStart = null;
        }
      });
    },
    start() {
      started = true;
      host?.start(() => undefined);
    },
    pause() {
      started = false;
      host?.pause();
    },
    reset() {
      started = true;
      build();
    },
    destroy() {
      detach?.();
      host?.destroy();
      host = null;
      ctx = null;
    },
    onWin(cb) {
      onWin = cb;
    },
    onLose(cb) {
      onLose = cb;
    },
    setOptions(options) {
      const next = options.parkingJam as ParkingJamConfig | undefined;
      if (next) config = next;
      if (ctx) applyLivePresentation(host, options, ctx);
    },
    resize(w, h) {
      host?.resize(w, h);
    },
  };
}
