import { Group, Mesh, MeshStandardMaterial, PlaneGeometry, Raycaster, Texture, Vector2 } from "three";
import type { ParkingCar, ParkingJamConfig } from "@/types/project";
import type { EngineInitContext, Playable3DEngine } from "@/playable-runtime/engines/types";
import { ThreeHost } from "@/playable-runtime/three/host";
import { applyLivePresentation } from "@/playable-runtime/three/presentation";
import { attachPointer } from "@/playable-runtime/three/input";
import { blobShadow, createProceduralModel } from "@/playable-runtime/models/procedural";
import {
  cloneTintedModel,
  createAsphaltTexture,
  fitObjectToFootprint,
  KENNEY_GRASS_URL,
  KENNEY_PAVEMENT,
  libraryCarKind,
  loadGltfScene,
  loadTexture,
  longCarUrl,
  orientCarAlongX,
  resolveRuntimeUrl,
  tintCarMaterials,
} from "@/playable-runtime/models/assets";
import { parkingCells, parkingOccupied, repairParkingCars } from "@/playable-runtime/engines/parking-jam/layout";

type CarActor = {
  spec: ParkingCar;
  group: Group;
  wheels: Mesh[];
};

type SlideAnim = {
  actor: CarActor;
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  t: number;
  duration: number;
  distance: number;
  prevEased: number;
  onDone?: () => void;
};

function easeOutCubic(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return 1 - (1 - x) ** 3;
}

function collectWheels(root: Group) {
  const wheels: Mesh[] = [];
  root.traverse((ch) => {
    if (ch instanceof Mesh && /wheel/i.test(ch.name)) wheels.push(ch);
  });
  return wheels;
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
  const zPad = 0.24;
  const wheelRadius = 0.28;
  let buildGen = 0;
  let slideAnim: SlideAnim | null = null;

  function parkingLayoutKey(cfg: ParkingJamConfig) {
    return JSON.stringify({
      lot: cfg.lotTextureUrl,
      grass: cfg.grassTextureUrl,
      pavement: cfg.pavementTextureUrl,
      model: cfg.carModelUrl,
      cols: cfg.gridCols,
      rows: cfg.gridRows,
      cars: cfg.cars.map((c) => ({
        id: c.id,
        col: c.col,
        row: c.row,
        length: c.length,
        axis: c.axis,
        isHero: c.isHero,
      })),
    });
  }

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
      actor.group.position.set(x, 0, z);
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
    const occ = parkingOccupied(state, car.id);
    for (const [x, y] of parkingCells(next)) {
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

  function slide(car: ParkingCar, dCol: number, dRow: number) {
    let cells = 0;
    for (let i = 0; i < 12; i++) {
      const result = tryMove(car, dCol, dRow);
      if (result === "exit") return { kind: "exit" as const, cells };
      if (result !== true) break;
      cells += 1;
    }
    return { kind: cells ? ("moved" as const) : ("blocked" as const), cells };
  }

  function playSlide(
    actor: CarActor,
    from: { x: number; z: number },
    to: { x: number; z: number },
    cells: number,
    onDone?: () => void,
  ) {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const distance = Math.hypot(dx, dz);
    actor.group.position.set(from.x, 0, from.z);
    slideAnim = {
      actor,
      fromX: from.x,
      fromZ: from.z,
      toX: to.x,
      toZ: to.z,
      t: 0,
      duration: Math.min(0.24, 0.07 * Math.max(1, cells)),
      distance,
      prevEased: 0,
      onDone,
    };
  }

  function tickSlide(dt: number) {
    const anim = slideAnim;
    if (!anim) return;
    anim.t += dt;
    const eased = easeOutCubic(anim.t / anim.duration);
    anim.actor.group.position.set(
      anim.fromX + (anim.toX - anim.fromX) * eased,
      0,
      anim.fromZ + (anim.toZ - anim.fromZ) * eased,
    );
    const rolled = ((eased - anim.prevEased) * anim.distance) / wheelRadius;
    anim.prevEased = eased;
    if (rolled) {
      for (const wheel of anim.actor.wheels) wheel.rotateX(rolled);
    }
    if (anim.t < anim.duration) return;
    anim.actor.group.position.set(anim.toX, 0, anim.toZ);
    slideAnim = null;
    anim.onDone?.();
  }

  function build() {
    void rebuild();
  }

  async function rebuild() {
    if (!host || !config || !root) return;
    const gen = ++buildGen;
    const cfg = config;
    const assets = ctx?.assets ?? {};
    const exitRow = cfg.cars.find((c) => c.isHero)?.row ?? 2;
    const kind = libraryCarKind(cfg.carModelUrl || "sedan");
    const compactUrl = resolveRuntimeUrl(cfg.carModelUrl || "sedan", assets);
    const stretchedUrl = longCarUrl(cfg.carModelUrl || "sedan", assets);
    const lotUrl = resolveRuntimeUrl(cfg.lotTextureUrl, assets);
    const grassUrl = resolveRuntimeUrl(cfg.grassTextureUrl, assets) || KENNEY_GRASS_URL;
    const pavementUrl = resolveRuntimeUrl(cfg.pavementTextureUrl, assets);

    async function loadTemplate(url: string) {
      if (!url) return null;
      try {
        return await loadGltfScene(url);
      } catch {
        return null;
      }
    }
    const compactGltf = await loadTemplate(compactUrl);
    const longGltf = stretchedUrl === compactUrl ? compactGltf : await loadTemplate(stretchedUrl);
    let lotMap: Texture = createAsphaltTexture(
      cfg.gridCols,
      cfg.gridRows,
      exitRow,
      zPad / (cfg.gridRows * cell + zPad * 2),
    );
    const paintedLot = lotMap;
    if (lotUrl) {
      try {
        lotMap = await loadTexture(lotUrl);
      } catch {
        /* keep painted asphalt */
      }
    }
    let grassMap: Texture | null = null;
    try {
      grassMap = await loadTexture(grassUrl);
    } catch {
      grassMap = null;
    }
    let pavementMap: Texture | null = null;
    if (pavementUrl) {
      try {
        pavementMap = await loadTexture(pavementUrl);
      } catch {
        pavementMap = null;
      }
    }
    if (gen !== buildGen || !host || !root) return;

    if (lotMap === paintedLot) host.tracker.track(lotMap);
    while (root.children.length) root.remove(root.children[0]);
    cars = [];
    slideAnim = null;
    state = repairParkingCars(
      cfg.cars.map((c) => ({ ...c })),
      cfg.gridCols,
      cfg.gridRows,
    );
    moves = 0;
    ended = false;

    const lotW = cfg.gridCols * cell;
    const lotH = cfg.gridRows * cell;
    const lotDepth = lotH + zPad * 2;

    if (grassMap) {
      const grassTex = grassMap.clone();
      grassTex.repeat.set(10, 10);
      const grassGeo = new PlaneGeometry(lotW + 10, lotDepth + 10);
      host.tracker.track(grassGeo);
      const grassMat = new MeshStandardMaterial({
        map: grassTex,
        roughness: 0.95,
        metalness: 0,
      });
      host.tracker.track(grassMat);
      const grass = new Mesh(grassGeo, grassMat);
      grass.rotation.x = -Math.PI / 2;
      grass.position.y = -0.03;
      root.add(grass);
    }

    const walkGeo = new PlaneGeometry(lotW + 0.72, lotDepth + 0.72);
    host.tracker.track(walkGeo);
    const walkMat = new MeshStandardMaterial(
      pavementMap
        ? { map: pavementMap, color: "#ffffff", roughness: 0.88, metalness: 0.02 }
        : { color: KENNEY_PAVEMENT, roughness: 0.88, metalness: 0.02 },
    );
    host.tracker.track(walkMat);
    const walk = new Mesh(walkGeo, walkMat);
    walk.rotation.x = -Math.PI / 2;
    walk.position.y = -0.015;
    root.add(walk);

    const lotGeo = new PlaneGeometry(lotW, lotDepth);
    host.tracker.track(lotGeo);
    const lotMat = new MeshStandardMaterial({
      map: lotMap,
      color: "#ffffff",
      roughness: 0.92,
      metalness: 0.04,
    });
    host.tracker.track(lotMat);
    const lot = new Mesh(lotGeo, lotMat);
    lot.rotation.x = -Math.PI / 2;
    root.add(lot);

    for (const spec of state) {
      const inner = new Group();
      const source = spec.length >= 3 ? longGltf : compactGltf;
      if (source) {
        const model = cloneTintedModel(source, spec.color, host.tracker);
        orientCarAlongX(model);
        inner.add(model);
      } else {
        inner.add(createProceduralModel(kind, host.tracker, spec.color));
      }
      fitObjectToFootprint(inner, cell * spec.length * 0.92, cell * 0.78);
      const group = new Group();
      group.add(inner);
      const shadow = blobShadow(host.tracker, 0.42 + spec.length * 0.08);
      shadow.position.y = 0.02;
      group.add(shadow);
      root.add(group);
      cars.push({ spec, group, wheels: collectWheels(group) });
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
          grassTextureUrl: "",
          pavementTextureUrl: "",
          carModelUrl: "sedan",
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
        if (!started || ended || slideAnim) return;
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
          const actor = selected;
          const car = state.find((c) => c.id === actor.spec.id);
          if (car) {
            const from = worldOf(car.col, car.row, car.length, car.axis);
            let result: ReturnType<typeof slide> | { kind: "blocked"; cells: number } = { kind: "blocked", cells: 0 };
            if (car.axis === "h" && Math.abs(dx) > 18) {
              result = slide(car, dx > 0 ? 1 : -1, 0);
            } else if (car.axis === "v" && Math.abs(dy) > 18) {
              result = slide(car, 0, dy > 0 ? 1 : -1);
            }
            if (result.kind === "exit") {
              const parked = worldOf(car.col, car.row, car.length, car.axis);
              playSlide(actor, from, { x: parked.x + cell * 1.65, z: parked.z }, result.cells + 1, () => {
                state = state.filter((c) => c.id !== car.id);
                actor.group.visible = false;
                finish("win");
              });
              selected = null;
              dragStart = null;
              return;
            }
            if (result.kind === "moved") {
              moves += 1;
              const to = worldOf(car.col, car.row, car.length, car.axis);
              const limit = config.movesLimit;
              playSlide(actor, from, to, result.cells, () => {
                if (moves >= limit) finish("lose");
              });
            }
          }
          selected = null;
          dragStart = null;
        }
      });
    },
    start() {
      started = true;
      host?.start((dt) => tickSlide(dt));
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
      if (next) {
        const prev = config;
        config = next;
        if (!prev || parkingLayoutKey(prev) !== parkingLayoutKey(next)) {
          void rebuild();
        } else {
          for (const actor of cars) {
            const spec = next.cars.find((c) => c.id === actor.spec.id);
            if (!spec) continue;
            actor.spec = spec;
            const live = state.find((c) => c.id === spec.id);
            if (live) live.color = spec.color;
            tintCarMaterials(actor.group, spec.color);
          }
        }
      }
      if (ctx) applyLivePresentation(host, options, ctx);
    },
    resize(w, h) {
      host?.resize(w, h);
    },
  };
}
