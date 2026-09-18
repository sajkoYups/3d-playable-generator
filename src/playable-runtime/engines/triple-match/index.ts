import {
  Box3,
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  Quaternion,
  Raycaster,
  TorusGeometry,
  Vector2,
  Vector3,
  type CanvasTexture,
} from "three";
import type { TripleMatchConfig } from "@/types/project";
import type { EngineInitContext, Playable3DEngine } from "@/playable-runtime/engines/types";
import { ThreeHost } from "@/playable-runtime/three/host";
import { applyLivePresentation } from "@/playable-runtime/three/presentation";
import { attachPointer } from "@/playable-runtime/three/input";
import { blobShadow } from "@/playable-runtime/models/procedural";
import {
  cloneTexturedModel,
  createWoodGrainTexture,
  fitObjectToXZ,
  loadGltfScene,
  resolveRuntimeUrl,
  setRuntimeAssets,
} from "@/playable-runtime/models/assets";
import { createPayoutHud, DEFAULT_COIN_URL } from "@/playable-runtime/engines/parking-jam/payout";
import { listMatchRounds, matchCoinsTotal } from "@/playable-runtime/engines/triple-match/rounds";

type Item = {
  id: string;
  kind: string;
  group: Group;
  taken: boolean;
  flying: boolean;
  slotIndex: number;
  baseScale: number;
};

type Fly = {
  item: Item;
  from: Vector3;
  fromQ: Quaternion;
  t: number;
  duration: number;
};

type Pop = {
  item: Item;
  t: number;
  duration: number;
};

const DEFAULT_ITEMS = ["apple", "donut", "taco", "burger"];
const MAX_KINDS = 4;
const ITEM_SIZE = 0.56;
const TRAY_SIZE = 0.4;
const TRAY_Z = 1.78;
const TRAY_DEPTH = 0.72;
const SLOT_GAP = 0.46;
const SLOT_WELL_R = 0.18;
const SLOT_RIM_R = 0.2;
const BOARD_WELL_R = 0.26;
const BOARD_LIP_R = 0.28;
const BOARD_ITEM_Y = 0.014;
const TRAY_ITEM_LIFT = 0.055;
const COLS = 3;
const CELL_X = 0.78;
const CELL_Z = 0.92;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function kindsFromSlots(slots: string[], assets: Record<string, string>) {
  const kinds: string[] = [];
  for (const raw of slots) {
    const kind = raw.trim();
    if (!kind) continue;
    if (!resolveRuntimeUrl(kind, assets)) continue;
    kinds.push(kind);
    if (kinds.length >= MAX_KINDS) break;
  }
  return kinds.length ? kinds : DEFAULT_ITEMS;
}

function solvableDeck(kinds: string[], triples: number): string[] {
  const pool = kinds.length ? kinds : DEFAULT_ITEMS;
  const deck: string[] = [];
  for (let i = 0; i < triples; i++) {
    deck.push(pool[i % pool.length], pool[i % pool.length], pool[i % pool.length]);
  }
  return shuffle(deck);
}

function matchLayoutKey(cfg: TripleMatchConfig, idx: number, playAll: boolean) {
  const rounds = listMatchRounds(cfg);
  const i = Math.max(0, Math.min(idx, rounds.length - 1));
  const round = rounds[i];
  return JSON.stringify({
    round: i,
    playAll,
    slots: round.itemSlots,
    tray: round.trayColor,
    bar: round.barSlots,
    win: round.triplesToWin,
  });
}

function easeOutCubic(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return 1 - (1 - x) ** 3;
}

async function loadTemplate(url: string) {
  if (!url) return null;
  try {
    return await Promise.race([
      loadGltfScene(url),
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error("gltf timeout")), 8000);
      }),
    ]);
  } catch {
    return null;
  }
}

export function createTripleMatchEngine(): Playable3DEngine {
  let host: ThreeHost | null = null;
  let config: TripleMatchConfig | null = null;
  let items: Item[] = [];
  let bar: Item[] = [];
  let barSlots: Group[] = [];
  let slotMats: MeshStandardMaterial[] = [];
  let templates = new Map<string, Group>();
  let cleared = 0;
  let started = false;
  let ended = false;
  let hover: Item | null = null;
  let flies: Fly[] = [];
  let pops: Pop[] = [];
  let animTime = 0;
  let onWin: () => void = () => undefined;
  let onLose: () => void = () => undefined;
  let detach: (() => void) | null = null;
  let root: Group | null = null;
  let ctx: EngineInitContext | null = null;
  let buildGen = 0;
  let roundIndex = 0;
  let playAllRounds = true;
  let building = false;
  let earned = 0;
  let lastEditorRoundIndex: number | null = null;
  const hud = createPayoutHud();
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const tmp = new Vector3();
  const upQ = new Quaternion();

  function applyEditorCamera() {
    if (!host || !ctx) return;
    host.applyCamera(ctx.camera, ctx.orientation, host.camera.aspect);
    frameBoard();
  }

  function frameBoard() {
    if (!host || !ctx) return;
    const scene = host;
    const round = config ? liveRound().round : null;
    const rows = Math.max(
      5,
      items.length ? Math.ceil(items.length / COLS) : Math.min(9, (round?.triplesToWin ?? 3) + 2),
    );
    const layout = boardLayout(rows);
    const slots = Math.max(3, barSlots.length || round?.barSlots || 7);
    const trayHalf = (slots * SLOT_GAP + 0.28) / 2;
    const halfW = Math.max(layout.width / 2 + 0.42, trayHalf + 0.12);
    const minZ = layout.farZ - 0.28;
    const maxZ = TRAY_Z + TRAY_DEPTH / 2 + 0.22;
    const look = new Vector3(0, 0.1, minZ * 0.35 + maxZ * 0.65);
    const corners = [
      new Vector3(-halfW, 0.88, minZ),
      new Vector3(halfW, 0.88, minZ),
      new Vector3(-halfW, 0.48, maxZ),
      new Vector3(halfW, 0.48, maxZ),
      new Vector3(-halfW, 0.02, maxZ),
      new Vector3(halfW, 0.02, maxZ),
    ];
    const landscape = ctx.orientation === "landscape";
    const fov = ctx.camera.fov;
    const camera = scene.camera;
    const aspect = Math.max(camera.aspect, 0.2);
    const dir = new Vector3(0, landscape ? 0.82 : 1, 1).normalize();
    camera.fov = fov;
    camera.aspect = aspect;
    camera.near = 0.12;
    camera.far = 80;

    const fitOverflow = (pad: number) => {
      let overflow = -1;
      for (const corner of corners) {
        tmp.copy(corner).project(camera);
        overflow = Math.max(overflow, Math.abs(tmp.x) - (1 - pad), Math.abs(tmp.y) - (1 - pad));
      }
      return overflow;
    };

    let dist = landscape ? 6.8 : 5.8;
    const margin = landscape ? 0.08 : 0.1;
    for (let i = 0; i < 24; i++) {
      camera.position.copy(look).addScaledVector(dir, dist);
      camera.lookAt(look);
      camera.updateProjectionMatrix();
      const overflow = fitOverflow(margin);
      if (overflow <= 0) break;
      dist *= 1 + Math.min(0.4, overflow * 0.8);
    }
    dist *= 1.08;
    camera.position.copy(look).addScaledVector(dir, dist);
    camera.lookAt(look);
    camera.far = Math.max(80, dist + 40);
    camera.updateProjectionMatrix();
  }

  function liveRound(cfg = config!) {
    const rounds = listMatchRounds(cfg);
    const index = Math.max(0, Math.min(roundIndex, rounds.length - 1));
    return { round: rounds[index], index, total: rounds.length };
  }

  function syncHud() {
    if (!config) return;
    const url = resolveRuntimeUrl(config.coinImageUrl || DEFAULT_COIN_URL, ctx?.assets ?? {});
    hud.setCoinUrl(url || DEFAULT_COIN_URL);
    hud.setState(earned, matchCoinsTotal(config));
  }

  function finish(kind: "win" | "lose") {
    if (ended) return;
    ended = true;
    started = false;
    if (kind === "lose") hud.cancel();
    if (kind === "win") onWin();
    else onLose();
  }

  function completeRound() {
    if (!config || hud.busy()) return;
    const { round, index, total } = liveRound();
    const reward = round.coins;
    const from = earned;
    earned += reward;
    const hasNext = playAllRounds && index < total - 1;
    hud.setState(earned, matchCoinsTotal(config));
    hud.startPayout({
      from,
      to: earned,
      reward,
      nextRound: hasNext ? index + 2 : null,
      onDone: (kind) => {
        if (kind === "next") {
          roundIndex = index + 1;
          void rebuild();
          return;
        }
        finish("win");
      },
    });
  }

  function makeModel(kind: string, maxSize: number) {
    const source = templates.get(kind);
    if (!source || !host) return null;
    const model = cloneTexturedModel(source, host.tracker);
    standUpIfFlat(model);
    fitObjectToXZ(model, maxSize, maxSize * 1.35);
    polishFood(model);
    return model;
  }

  function polishFood(object: Group) {
    object.traverse((ch) => {
      const mesh = ch as Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (!(m instanceof MeshStandardMaterial)) continue;
        m.envMapIntensity = 1.05;
        m.roughness = Math.min(m.roughness, 0.48);
        m.needsUpdate = true;
      }
    });
  }

  function standUpIfFlat(object: Group) {
    object.updateWorldMatrix(true, true);
    const size = new Box3().setFromObject(object).getSize(new Vector3());
    if (size.y >= Math.min(size.x, size.z) * 0.5) return;
    if (size.x >= size.z) object.rotateZ(Math.PI / 2);
    else object.rotateX(-Math.PI / 2);
  }

  function slotWorldLocal(index: number) {
    const slot = barSlots[Math.max(0, Math.min(index, barSlots.length - 1))];
    tmp.copy(slot.position);
    tmp.y += TRAY_ITEM_LIFT;
    return tmp.clone();
  }

  function paintHover(item: Item | null, on: boolean) {
    const scale = item ? item.baseScale * (on ? 1.14 : 1) : 1;
    if (item) item.group.scale.setScalar(scale);
    item?.group.traverse((ch) => {
      const mesh = ch as Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (!(m instanceof MeshStandardMaterial)) continue;
        m.emissive.set(on ? "#5a3a10" : "#000000");
        m.emissiveIntensity = on ? 0.65 : 0;
      }
    });
  }

  function setHover(next: Item | null) {
    if (hover === next) return;
    if (hover) paintHover(hover, false);
    hover = next;
    if (hover) paintHover(hover, true);
  }

  function pickItem(ndcX: number, ndcY: number) {
    if (!host) return null;
    pointer.set(ndcX, ndcY);
    raycaster.setFromCamera(pointer, host.camera);
    const live = items.filter((it) => !it.taken);
    const meshes: Array<{ mesh: Mesh; item: Item }> = [];
    for (const it of live) {
      it.group.traverse((ch) => {
        if (ch instanceof Mesh) meshes.push({ mesh: ch, item: it });
      });
    }
    const hits = raycaster.intersectObjects(
      meshes.map((m) => m.mesh),
      false,
    );
    if (!hits.length) return null;
    return meshes.find((m) => m.mesh === hits[0].object)?.item ?? null;
  }

  function reindexBar() {
    bar.forEach((it, i) => {
      it.slotIndex = i;
    });
  }

  function insertIntoBar(item: Item) {
    let at = bar.length;
    for (let i = bar.length - 1; i >= 0; i--) {
      if (bar[i].kind === item.kind) {
        at = i + 1;
        break;
      }
    }
    bar.splice(at, 0, item);
    reindexBar();
  }

  function tryClearMatches() {
    if (!config || ended || hud.busy()) return;
    const round = liveRound().round;
    const kinds = new Set(bar.map((it) => it.kind));
    for (const kind of kinds) {
      const group = bar.filter((it) => it.kind === kind && !it.flying);
      if (group.length < 3) continue;
      const remove = group.slice(0, 3);
      bar = bar.filter((it) => !remove.includes(it));
      reindexBar();
      for (const it of remove) {
        it.taken = true;
        pops.push({ item: it, t: 0, duration: 0.22 });
      }
      cleared += 1;
      if (cleared >= round.triplesToWin) {
        completeRound();
        return;
      }
    }
    if (bar.length >= round.barSlots && !flies.length) finish("lose");
  }

  function take(item: Item) {
    if (item.taken || item.flying || ended || !started || !config) return;
    if (hud.busy() || building) return;
    const round = liveRound().round;
    if (bar.length >= round.barSlots) return;
    setHover(null);
    item.taken = true;
    item.flying = true;
    if (item.group.children[1]) item.group.children[1].visible = false;
    insertIntoBar(item);
    flies.push({
      item,
      from: item.group.position.clone(),
      fromQ: item.group.quaternion.clone(),
      t: 0,
      duration: 0.32,
    });
  }

  function tickAnims(dt: number) {
    animTime += dt;
    const pulse = 0.16 + Math.sin(animTime * 2.6) * 0.1;
    slotMats.forEach((m, i) => {
      const occupied = bar.some((it) => it.slotIndex === i);
      m.emissive.set(occupied ? "#000000" : "#ffe8c0");
      m.emissiveIntensity = occupied ? 0 : pulse;
    });

    for (const fly of [...flies]) {
      fly.t += dt / fly.duration;
      const k = easeOutCubic(fly.t);
      const dest = slotWorldLocal(fly.item.slotIndex);
      fly.item.group.position.lerpVectors(fly.from, dest, k);
      fly.item.group.position.y += Math.sin(k * Math.PI) * 0.45;
      fly.item.group.quaternion.slerpQuaternions(fly.fromQ, upQ, k);
      fly.item.group.scale.setScalar(ITEM_SIZE + (TRAY_SIZE - ITEM_SIZE) * k);
      if (fly.t >= 1) {
        fly.item.flying = false;
        fly.item.group.position.copy(slotWorldLocal(fly.item.slotIndex));
        fly.item.group.quaternion.copy(upQ);
        fly.item.group.scale.setScalar(TRAY_SIZE);
        flies = flies.filter((f) => f !== fly);
        tryClearMatches();
      }
    }
    for (const pop of [...pops]) {
      pop.t += dt / pop.duration;
      const k = Math.min(1, pop.t);
      pop.item.group.scale.setScalar(TRAY_SIZE * (1 - k));
      if (pop.t >= 1) {
        pop.item.group.visible = false;
        pops = pops.filter((p) => p !== pop);
      }
    }
    for (const it of bar) {
      if (it.flying) continue;
      const dest = slotWorldLocal(it.slotIndex);
      it.group.position.lerp(dest, Math.min(1, dt * 12));
    }
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.taken || it.flying) continue;
      const wave = animTime * 1.35 + i * 0.7;
      it.group.rotation.y = Math.sin(wave * 0.45) * 0.09;
      it.group.position.y = BOARD_ITEM_Y + Math.sin(wave) * 0.01;
    }
  }

  function boardLayout(rows: number) {
    const depth = (rows - 1) * CELL_Z;
    const nearZ = TRAY_Z - 0.95;
    const farZ = nearZ - depth;
    return {
      cols: COLS,
      rows,
      farZ,
      nearZ,
      zCenter: (farZ + nearZ) / 2,
      width: (COLS - 1) * CELL_X,
      depth,
    };
  }

  function layoutGrid(list: Item[], rows: number) {
    const { farZ } = boardLayout(rows);
    for (let i = 0; i < list.length; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = (col - (COLS - 1) / 2) * CELL_X;
      const z = farZ + row * CELL_Z;
      list[i].group.position.set(x, BOARD_ITEM_Y, z);
      list[i].group.rotation.set(0, 0, 0);
      list[i].group.scale.setScalar(ITEM_SIZE);
    }
  }

  function woodMat(map: CanvasTexture, tint: Color, roughness: number, env = 0.55) {
    const mat = new MeshStandardMaterial({
      map,
      color: tint,
      roughness,
      metalness: 0.04,
      envMapIntensity: env,
    });
    host!.tracker.track(mat);
    return mat;
  }

  function addBoard(color: string, rows: number, woodMap: CanvasTexture) {
    if (!host || !root) return;
    const layout = boardLayout(rows);
    const wood = new Color(color).multiplyScalar(0.92);
    const floorW = layout.width + 0.55;
    const floorD = layout.depth + 0.55;

    const floorGeo = new BoxGeometry(floorW, 0.08, floorD);
    host.tracker.track(floorGeo);
    const floor = new Mesh(floorGeo, woodMat(woodMap, wood, 0.78, 0.45));
    floor.position.set(0, -0.04, layout.zCenter);
    root.add(floor);

    const rimMat = woodMat(woodMap, wood.clone().multiplyScalar(0.52), 0.7, 0.35);
    const rimH = 0.12;
    const rimT = 0.08;
    const specs: Array<[number, number, number, number, number]> = [
      [floorW + rimT, rimH, rimT, 0, layout.zCenter + floorD / 2],
      [floorW + rimT, rimH, rimT, 0, layout.zCenter - floorD / 2],
      [rimT, rimH, floorD, floorW / 2, layout.zCenter],
      [rimT, rimH, floorD, -floorW / 2, layout.zCenter],
    ];
    for (const [w, h, d, x, z] of specs) {
      const geo = new BoxGeometry(w, h, d);
      host.tracker.track(geo);
      const mesh = new Mesh(geo, rimMat);
      mesh.position.set(x, h / 2 - 0.04, z);
      root.add(mesh);
    }

    const dishGeo = new CylinderGeometry(BOARD_WELL_R, BOARD_WELL_R, 0.01, 24);
    host.tracker.track(dishGeo);
    const dishMat = woodMat(woodMap, wood.clone().multiplyScalar(1.14), 0.62, 0.5);
    const lipGeo = new TorusGeometry(BOARD_LIP_R, 0.016, 7, 28);
    host.tracker.track(lipGeo);
    const lipMat = woodMat(woodMap, wood.clone().multiplyScalar(0.72), 0.66, 0.4);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < COLS; col++) {
        const x = (col - (COLS - 1) / 2) * CELL_X;
        const z = layout.farZ + row * CELL_Z;
        const dish = new Mesh(dishGeo, dishMat);
        dish.position.set(x, 0.002, z);
        root.add(dish);
        const lip = new Mesh(lipGeo, lipMat);
        lip.rotation.x = -Math.PI / 2;
        lip.position.set(x, 0.01, z);
        root.add(lip);
      }
    }

    const fill = new PointLight(0xfff2dd, 0.55, 10);
    fill.position.set(1.2, 2.4, layout.zCenter + 1.2);
    root.add(fill);
    const bounce = new PointLight(0xcbb6ff, 0.28, 9);
    bounce.position.set(-1.3, 1.8, layout.zCenter - 0.6);
    root.add(bounce);
  }

  function addTray(slots: number, color: string, woodMap: CanvasTexture) {
    if (!host || !root) return;
    const width = slots * SLOT_GAP + 0.28;
    const depth = TRAY_DEPTH;
    const wood = new Color(color).multiplyScalar(0.92);
    const shelfH = 0.16;
    const shelfY = 0.04;
    const shelfTop = shelfY + shelfH / 2;

    const shelfGeo = new BoxGeometry(width, shelfH, depth);
    host.tracker.track(shelfGeo);
    const shelf = new Mesh(shelfGeo, woodMat(woodMap, wood, 0.76, 0.45));
    shelf.position.set(0, shelfY, TRAY_Z);
    root.add(shelf);

    const railGeo = new BoxGeometry(width + 0.04, 0.045, 0.045);
    host.tracker.track(railGeo);
    const railMat = woodMat(woodMap, wood.clone().multiplyScalar(0.58), 0.62, 0.35);
    const front = new Mesh(railGeo, railMat);
    front.position.set(0, shelfTop + 0.01, TRAY_Z + depth / 2 - 0.03);
    root.add(front);
    const back = new Mesh(railGeo, railMat);
    back.position.set(0, shelfTop + 0.01, TRAY_Z - depth / 2 + 0.03);
    root.add(back);

    const wellGeo = new CylinderGeometry(SLOT_WELL_R, SLOT_WELL_R, 0.04, 24);
    host.tracker.track(wellGeo);
    const wellMat = new MeshStandardMaterial({
      color: "#c4a882",
      roughness: 0.55,
      metalness: 0.04,
      envMapIntensity: 0.4,
    });
    host.tracker.track(wellMat);
    const rimGeo = new TorusGeometry(SLOT_RIM_R, 0.014, 7, 26);
    host.tracker.track(rimGeo);
    const rimMat = woodMat(woodMap, wood.clone().multiplyScalar(0.7), 0.6, 0.4);
    const padGeo = new CylinderGeometry(SLOT_WELL_R * 0.92, SLOT_WELL_R * 0.92, 0.016, 24);
    host.tracker.track(padGeo);

    for (let i = 0; i < slots; i++) {
      const slot = new Group();
      slot.position.set((i - (slots - 1) / 2) * SLOT_GAP, shelfTop, TRAY_Z);

      const well = new Mesh(wellGeo, wellMat);
      well.position.y = -0.01;
      slot.add(well);

      const rim = new Mesh(rimGeo, rimMat);
      rim.rotation.x = -Math.PI / 2;
      rim.position.y = 0.012;
      slot.add(rim);

      const padMat = new MeshStandardMaterial({
        color: "#f3ead8",
        roughness: 0.32,
        metalness: 0.04,
        envMapIntensity: 0.55,
        emissive: "#ffe8c0",
        emissiveIntensity: 0.28,
      });
      host.tracker.track(padMat);
      const pad = new Mesh(padGeo, padMat);
      pad.position.y = 0.01;
      slot.add(pad);

      root.add(slot);
      barSlots.push(slot);
      slotMats.push(padMat);
    }
  }

  function build() {
    void rebuild();
  }

  async function rebuild() {
    if (!host || !config || !root) return;
    const gen = ++buildGen;
    building = true;
    try {
    const cfg = config;
    const round = liveRound(cfg).round;
    const assets = ctx?.assets ?? {};
    setRuntimeAssets(assets);
    const requested = kindsFromSlots(round.itemSlots, assets);
    const nextTemplates = new Map<string, Group>();
    await Promise.all(
      requested.map(async (kind) => {
        const url = resolveRuntimeUrl(kind, assets);
        const scene = await loadTemplate(url);
        if (scene) nextTemplates.set(kind, scene);
      }),
    );
    if (gen !== buildGen || !host || !root || config !== cfg) return;

    templates = nextTemplates;
    const liveKinds = requested.filter((k) => nextTemplates.has(k));
    const kinds = liveKinds.length ? liveKinds : DEFAULT_ITEMS;
    if (!liveKinds.length) {
      await Promise.all(
        kinds.map(async (kind) => {
          if (nextTemplates.has(kind)) return;
          const url = resolveRuntimeUrl(kind, assets);
          const scene = await loadTemplate(url);
          if (scene) nextTemplates.set(kind, scene);
        }),
      );
      if (gen !== buildGen || !host || !root || config !== cfg) return;
      templates = nextTemplates;
    }

    while (root.children.length) root.remove(root.children[0]);
    items = [];
    bar = [];
    barSlots = [];
    slotMats = [];
    flies = [];
    pops = [];
    hover = null;
    cleared = 0;
    ended = false;
    animTime = 0;
    root.position.set(0, 0, 0);
    root.scale.setScalar(1);
    syncHud();

    const rows = Math.max(5, Math.min(9, round.triplesToWin + 2));
    const cells = COLS * rows;
    const pileTriples = Math.max(Math.ceil(cells / 3), round.triplesToWin + 2);
    const deck = solvableDeck(
      kinds.filter((k) => templates.has(k)),
      pileTriples,
    ).slice(0, cells);

    const woodHex = round.trayColor || "#b87914";
    const woodMap = createWoodGrainTexture();
    host.tracker.trackTexture(woodMap);
    addBoard(woodHex, rows, woodMap);
    addTray(round.barSlots, woodHex, woodMap);

    deck.forEach((kind, i) => {
      const inner = makeModel(kind, 1);
      if (!inner) return;
      const group = new Group();
      group.add(inner);
      const shadow = blobShadow(host!.tracker, 0.32);
      shadow.position.y = 0.01;
      group.add(shadow);
      root!.add(group);
      items.push({
        id: `i${i}`,
        kind,
        group,
        taken: false,
        flying: false,
        slotIndex: -1,
        baseScale: ITEM_SIZE,
      });
    });
    layoutGrid(items, rows);
    applyEditorCamera();
    } finally {
      if (gen === buildGen) building = false;
    }
  }

  return {
    id: "triple-match",
    name: "Triple Stack 3D",
    initialize(init) {
      ctx = init;
      const extra = init as EngineInitContext & {
        tripleMatch?: TripleMatchConfig;
        playAllRounds?: boolean;
        parkingRoundIndex?: number;
      };
      config = extra.tripleMatch ?? {
        itemSlots: DEFAULT_ITEMS,
        trayColor: "#b87914",
        barSlots: 7,
        triplesToWin: 4,
        difficulty: "medium",
        rounds: [],
        coinImageUrl: "",
      };
      playAllRounds = extra.playAllRounds !== false;
      roundIndex = typeof extra.parkingRoundIndex === "number" ? extra.parkingRoundIndex : 0;
      roundIndex = Math.max(0, Math.min(roundIndex, listMatchRounds(config).length - 1));
      lastEditorRoundIndex = roundIndex;
      host = new ThreeHost(init.container);
      host.enableStudioEnvironment();
      host.applyParkingJamLighting(init.lighting);
      applyEditorCamera();
      root = new Group();
      host.scene.add(root);
      hud.mount(init.container);
      syncHud();
      build();
      detach = attachPointer(host.canvas, (e) => {
        if (ended || hud.busy() || building) return;
        if (e.kind === "move" || e.kind === "down") {
          const hit = pickItem(e.ndcX, e.ndcY);
          setHover(hit);
        }
        if (e.kind !== "tap") return;
        const hit = pickItem(e.ndcX, e.ndcY);
        if (hit) take(hit);
      });
    },
    start() {
      started = true;
      host?.start((dt) => {
        tickAnims(dt);
        hud.tick(performance.now());
      });
    },
    pause() {
      started = false;
      host?.pause();
    },
    reset() {
      started = true;
      hud.cancel();
      earned = 0;
      if (playAllRounds) roundIndex = 0;
      build();
    },
    destroy() {
      buildGen += 1;
      detach?.();
      hud.destroy();
      host?.destroy();
      host = null;
      ctx = null;
      templates = new Map();
    },
    onWin(cb) {
      onWin = cb;
    },
    onLose(cb) {
      onLose = cb;
    },
    setOptions(options) {
      const next = options.tripleMatch as TripleMatchConfig | undefined;
      const prevKey = config ? matchLayoutKey(config, roundIndex, playAllRounds) : "";
      if (next) config = next;
      if (typeof options.playAllRounds === "boolean") playAllRounds = options.playAllRounds;
      if (typeof options.parkingRoundIndex === "number" && config) {
        const n = listMatchRounds(config).length;
        const nextIdx = Math.max(0, Math.min(Math.floor(options.parkingRoundIndex), n - 1));
        if (lastEditorRoundIndex !== null && nextIdx !== lastEditorRoundIndex) {
          hud.cancel();
          earned = 0;
          roundIndex = nextIdx;
        }
        lastEditorRoundIndex = nextIdx;
      }
      if (config) {
        const nextKey = matchLayoutKey(config, roundIndex, playAllRounds);
        if (!prevKey || prevKey !== nextKey) build();
        else syncHud();
      }
      if (ctx) applyLivePresentation(host, options, ctx);
      if (typeof options.lighting === "string") {
        host?.applyParkingJamLighting(options.lighting as EngineInitContext["lighting"]);
      }
      applyEditorCamera();
    },
    resize(w, h) {
      host?.resize(w, h);
      hud.resize();
      applyEditorCamera();
    },
  };
}
