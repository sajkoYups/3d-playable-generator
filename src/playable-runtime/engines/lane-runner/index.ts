import {
  BoxGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Fog,
  Group,
  Mesh,
  MeshStandardMaterial,
  DoubleSide,
  Object3D,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
} from "three";
import type { LaneRunnerConfig } from "@/types/project";
import type { EngineInitContext, Playable3DEngine } from "@/playable-runtime/engines/types";
import { ThreeHost } from "@/playable-runtime/three/host";
import { applyLivePresentation } from "@/playable-runtime/three/presentation";
import { attachPointer } from "@/playable-runtime/three/input";
import { blobShadow, createProceduralModel } from "@/playable-runtime/models/procedural";
import {
  cloneTintedModel,
  fitObjectToMax,
  KENNEY_ASPHALT,
  KENNEY_GRASS_URL,
  KENNEY_PAVEMENT,
  libraryCarKind,
  loadGltfScene,
  loadTexture,
  resolveRuntimeUrl,
  setRuntimeAssets,
  yawObjectTowardXZ,
} from "@/playable-runtime/models/assets";
import { createPayoutHud, DEFAULT_COIN_URL } from "@/playable-runtime/engines/parking-jam/payout";
import { laneCoinsTotal, listLaneRounds } from "@/playable-runtime/engines/lane-runner/rounds";

type Actor = {
  group: Group;
  lane: number;
  z: number;
  kind: "hazard" | "coin";
  wheels: Mesh[];
};

type ScrollPiece = { group: Object3D; z: number };

const LANE_GAP = 1.7;
const PLAYER_Z = 3.6;
const SEGMENT_LEN = 36;
const SEGMENT_COUNT = 3;
const WHEEL_R = 0.16;
const DIST_TO_WORLD = 4.2 / 4;
/** Hazards closer than this on Z form one blocking wall across lanes. */
const HAZARD_BLOCK_SPAN = 4.5;
/** No traffic/coins in the player's lane for this long after a round starts. */
const SPAWN_GRACE_SEC = 2;
const TRAFFIC_COLORS = ["#2bb5a0", "#7c5cff", "#e85d4c", "#3d7cff", "#e0b04a", "#c47a4a", "#8b95a8"];
const THEMES: Record<
  LaneRunnerConfig["environmentTheme"],
  { fog: string; shoulder: string; neon: boolean; trees: boolean }
> = {
  desert: { fog: "#e8d5b5", shoulder: "#c4a574", neon: false, trees: true },
  city: { fog: "#8aa0b4", shoulder: "#5cbf5a", neon: false, trees: true },
  neon: { fog: "#0a0614", shoulder: "#1a1024", neon: true, trees: true },
};

function laneX(i: number, count: number) {
  return (i - (count - 1) / 2) * LANE_GAP;
}

function collectWheels(root: Group) {
  const wheels: Mesh[] = [];
  root.traverse((ch) => {
    if (ch instanceof Mesh && /wheel/i.test(ch.name)) wheels.push(ch);
  });
  return wheels;
}

function createLaneRoadTexture(lanes: number) {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const empty = new CanvasTexture(canvas);
    empty.colorSpace = SRGBColorSpace;
    return empty;
  }
  ctx.fillStyle = KENNEY_ASPHALT;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const shade = 44 + Math.random() * 22;
    ctx.fillStyle = `rgba(${shade},${shade + 10},${shade + 12},${0.22 + Math.random() * 0.2})`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }
  const inset = 14;
  ctx.fillStyle = KENNEY_PAVEMENT;
  ctx.fillRect(0, 0, inset, size);
  ctx.fillRect(size - inset, 0, inset, size);
  const inner = size - inset * 2;
  const laneW = inner / Math.max(1, lanes);
  ctx.strokeStyle = "rgba(243, 237, 224, 0.88)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(inset + 4, 0);
  ctx.lineTo(inset + 4, size);
  ctx.moveTo(size - inset - 4, 0);
  ctx.lineTo(size - inset - 4, size);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.setLineDash([30, 22]);
  for (let i = 1; i < lanes; i++) {
    const x = inset + i * laneW;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.repeat.set(1, 4);
  tex.anisotropy = 2;
  tex.needsUpdate = true;
  return tex;
}

function createCheckeredTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const empty = new CanvasTexture(canvas);
    empty.colorSpace = SRGBColorSpace;
    return empty;
  }
  const cells = 8;
  const cell = size / cells;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#f4f1ea" : "#1a1a1a";
      ctx.fillRect(x * cell, y * cell, cell + 1, cell + 1);
    }
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
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

function isConeId(id: string) {
  return /(^|\/)cone(\.glb)?$/i.test(id.split("/").pop() || id);
}

const LEGACY_TRAFFIC: Record<string, string> = {
  crate: "suv",
  barrier: "taxi",
  runner: "sedan",
};

function normalizeTrafficId(id: string) {
  const key = (id.split("/").pop() || id).replace(/\.glb$/i, "").toLowerCase();
  if (LEGACY_TRAFFIC[key]) return LEGACY_TRAFFIC[key];
  return id;
}

export function createLaneRunnerEngine(): Playable3DEngine {
  let host: ThreeHost | null = null;
  let config: LaneRunnerConfig | null = null;
  let started = false;
  let ended = false;
  let lane = 1;
  let targetLane = 1;
  let distance = 0;
  let speed = 8;
  let roundElapsed = 0;
  let onWin: () => void = () => undefined;
  let onLose: () => void = () => undefined;
  let detach: (() => void) | null = null;
  let world: Group | null = null;
  let ctx: EngineInitContext | null = null;
  let player: Group | null = null;
  let playerWheels: Mesh[] = [];
  let actors: Actor[] = [];
  let roads: ScrollPiece[] = [];
  let shoulders: ScrollPiece[] = [];
  let props: ScrollPiece[] = [];
  let finishLine: Group | null = null;
  let buildGen = 0;
  let roundIndex = 0;
  let playAllRounds = true;
  let building = false;
  let earned = 0;
  let lastEditorRoundIndex: number | null = null;
  const hud = createPayoutHud();
  const templates = new Map<string, Group>();

  function liveRound(cfg = config!) {
    const rounds = listLaneRounds(cfg);
    const index = Math.max(0, Math.min(roundIndex, rounds.length - 1));
    return { round: rounds[index], index, total: rounds.length };
  }

  function layoutKey(cfg: LaneRunnerConfig, idx: number, playAll: boolean) {
    const rounds = listLaneRounds(cfg);
    const i = Math.max(0, Math.min(idx, rounds.length - 1));
    const round = rounds[i];
    return JSON.stringify({
      model: cfg.characterModelUrl,
      obstacles: cfg.obstacleSet,
      theme: cfg.environmentTheme,
      lanes: cfg.laneCount,
      road: cfg.roadTextureUrl,
      grass: cfg.grassTextureUrl,
      round: i,
      playAll,
      dist: round.winDistance,
      speed: round.startSpeed,
      ramp: round.speedRamp,
      laneSwitch: cfg.laneSwitchSpeed,
    });
  }

  function steerRate(cfg = config!) {
    const s = cfg.laneSwitchSpeed;
    if (!Number.isFinite(s)) return 10;
    return Math.min(24, Math.max(4, s));
  }

  function inSpawnGrace() {
    return roundElapsed < SPAWN_GRACE_SEC;
  }

  function playerLaneIndex() {
    return Math.max(0, Math.min((config?.laneCount ?? 3) - 1, Math.round(targetLane)));
  }

  function syncHud() {
    if (!config) return;
    const url = resolveRuntimeUrl(config.coinImageUrl || DEFAULT_COIN_URL, ctx?.assets ?? {});
    hud.setCoinUrl(url || DEFAULT_COIN_URL);
    hud.setState(earned, laneCoinsTotal(config));
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
    if (!config || hud.busy() || ended) return;
    const { round, index, total } = liveRound();
    const reward = round.coins;
    const from = earned;
    earned += reward;
    const hasNext = playAllRounds && index < total - 1;
    hud.setState(earned, laneCoinsTotal(config));
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

  function makeFallback(id: string, tint: string) {
    if (!host) return new Group();
    if (isConeId(id)) return createProceduralModel("cone", host.tracker, tint);
    return createProceduralModel(libraryCarKind(id), host.tracker, tint);
  }

  function stampModel(id: string, tint: string, size: number, facingZ: boolean) {
    if (!host) return new Group();
    const group = new Group();
    const source = templates.get(id);
    const inner = new Group();
    if (source) {
      try {
        inner.add(cloneTintedModel(source, tint, host.tracker));
      } catch {
        inner.add(makeFallback(id, tint));
      }
    } else {
      inner.add(makeFallback(id, tint));
    }
    fitObjectToMax(inner, size);
    if (facingZ && !isConeId(id)) yawObjectTowardXZ(inner, 0, -1);
    group.add(inner);
    const shadow = blobShadow(host.tracker, isConeId(id) ? 0.32 : 0.5);
    shadow.scale.set(isConeId(id) ? 1 : 1.4, 1, 0.82);
    shadow.position.set(0.14, 0.02, 0.06);
    group.add(shadow);
    return group;
  }

  function makeCoin() {
    if (!host) return new Group();
    return createProceduralModel("coin", host.tracker, "#e0b04a");
  }

  function makeProp(theme: (typeof THEMES)[keyof typeof THEMES], index: number) {
    if (!host) return new Group();
    const g = new Group();
    if (!theme.trees) {
      const w = 1.05 + (index % 3) * 0.28;
      const d = 1.05 + (index % 2) * 0.25;
      const h = 1.8 + (index % 5) * 0.7;
      const geo = new BoxGeometry(w, h, d);
      host.tracker.track(geo);
      const palette = theme.neon
        ? ["#7c5cff", "#e07a3d", "#2bb5a0", "#3d7cff"]
        : ["#6b7380", "#8a909c", "#5c6570", "#74808c"];
      const mat = new MeshStandardMaterial({
        color: palette[index % palette.length],
        roughness: 0.88,
        metalness: theme.neon ? 0.18 : 0.04,
        emissive: theme.neon ? new Color(palette[index % palette.length]) : new Color("#000000"),
        emissiveIntensity: theme.neon ? 0.22 : 0,
      });
      host.tracker.track(mat);
      const mesh = new Mesh(geo, mat);
      mesh.position.y = h / 2;
      g.add(mesh);
    } else {
      const trunkGeo = new CylinderGeometry(0.12, 0.16, 0.7, 8);
      host.tracker.track(trunkGeo);
      const trunkMat = new MeshStandardMaterial({ color: "#6b4423", roughness: 0.9 });
      host.tracker.track(trunkMat);
      const trunk = new Mesh(trunkGeo, trunkMat);
      trunk.position.y = 0.35;
      g.add(trunk);
      const leafGeo = new ConeGeometry(0.7, 1.6, 8);
      host.tracker.track(leafGeo);
      const leafMat = new MeshStandardMaterial({ color: "#6a8f3d", roughness: 0.85 });
      host.tracker.track(leafMat);
      const leaf = new Mesh(leafGeo, leafMat);
      leaf.position.y = 1.35;
      g.add(leaf);
    }
    return g;
  }

  function finishWorldZ() {
    const { round } = liveRound();
    return PLAYER_Z - Math.max(0, round.winDistance - distance) * DIST_TO_WORLD;
  }

  function makeFinishLine(roadW: number) {
    if (!host) return new Group();
    const g = new Group();
    const tex = createCheckeredTexture();
    host.tracker.track(tex);
    const poleGeo = new BoxGeometry(0.14, 2.5, 0.14);
    host.tracker.track(poleGeo);
    const poleMat = new MeshStandardMaterial({ color: "#f3ede0", roughness: 0.55, metalness: 0.08 });
    host.tracker.track(poleMat);
    const left = new Mesh(poleGeo, poleMat);
    const right = new Mesh(poleGeo, poleMat);
    left.position.set(-roadW / 2, 1.25, 0);
    right.position.set(roadW / 2, 1.25, 0);
    g.add(left, right);

    const bannerGeo = new PlaneGeometry(roadW, 1.15);
    host.tracker.track(bannerGeo);
    const bannerMat = new MeshStandardMaterial({
      map: tex,
      roughness: 0.85,
      metalness: 0,
      side: DoubleSide,
    });
    host.tracker.track(bannerMat);
    const banner = new Mesh(bannerGeo, bannerMat);
    banner.position.set(0, 1.65, 0);
    g.add(banner);

    const stripeGeo = new PlaneGeometry(roadW, 1.1);
    host.tracker.track(stripeGeo);
    const stripeMat = new MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0, side: DoubleSide });
    host.tracker.track(stripeMat);
    const stripe = new Mesh(stripeGeo, stripeMat);
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.y = 0.03;
    g.add(stripe);
    return g;
  }

  function wrapZ(z: number, front: number, span: number) {
    let next = z;
    while (next > front) next -= span;
    while (next < front - span) next += span;
    return next;
  }

  function hazardLanesNear(z: number, ignore?: Actor) {
    const blocked = new Set<number>();
    for (const a of actors) {
      if (a === ignore || a.kind !== "hazard" || !a.group.visible) continue;
      if (Math.abs(a.z - z) < HAZARD_BLOCK_SPAN) blocked.add(a.lane);
    }
    return blocked;
  }

  /** Lane that still leaves ≥1 open path through this Z band, or -1 if none. */
  function pickPassableLane(z: number, count: number, ignore?: Actor) {
    const blocked = hazardLanesNear(z, ignore);
    const reserved = inSpawnGrace() ? playerLaneIndex() : -1;
    const open: number[] = [];
    for (let i = 0; i < count; i++) {
      if (blocked.has(i) || i === reserved) continue;
      open.push(i);
    }
    // Placing fills one open lane — need ≥2 free overall so one remains clear.
    const freeCount = count - blocked.size;
    if (open.length < 1 || freeCount < 2) return -1;
    return open[Math.floor(Math.random() * open.length)]!;
  }

  function pickCoinLane(count: number) {
    const reserved = inSpawnGrace() ? playerLaneIndex() : -1;
    const choices: number[] = [];
    for (let i = 0; i < count; i++) {
      if (i !== reserved) choices.push(i);
    }
    if (!choices.length) return Math.floor(Math.random() * count);
    return choices[Math.floor(Math.random() * choices.length)]!;
  }

  function findPassableSpawn(behind: number, count: number, ignore?: Actor) {
    const finishLimit = finishWorldZ() + 4;
    for (let attempt = 0; attempt < 14; attempt++) {
      const z = behind - 6 - Math.random() * 10 - attempt * 2.8;
      if (z < finishLimit) continue;
      const lane = pickPassableLane(z, count, ignore);
      if (lane >= 0) return { lane, z };
    }
    return null;
  }

  function recycleActor(actor: Actor, behind: number) {
    if (!config) return;
    const count = config.laneCount;
    if (actor.kind === "coin") {
      const spawnZ = behind - 6 - Math.random() * 10;
      if (spawnZ < finishWorldZ() + 4) {
        actor.group.visible = false;
        actor.z = spawnZ;
        actor.group.position.z = spawnZ;
        return;
      }
      actor.lane = pickCoinLane(count);
      actor.z = spawnZ;
      actor.group.visible = true;
      actor.group.position.set(laneX(actor.lane, count), 0.55, actor.z);
      return;
    }
    const spot = findPassableSpawn(behind, count, actor);
    if (!spot) {
      actor.group.visible = false;
      actor.z = behind - SEGMENT_LEN;
      actor.group.position.z = actor.z;
      return;
    }
    actor.lane = spot.lane;
    actor.z = spot.z;
    actor.group.visible = true;
    actor.group.position.set(laneX(actor.lane, count), 0, actor.z);
  }

  function tickScroll(dt: number) {
    if (!config || !player) return;
    const { round } = liveRound();
    roundElapsed += dt;
    speed += round.speedRamp * dt;
    const scroll = speed * dt * 4.2;
    distance += speed * dt * 4;
    const span = SEGMENT_COUNT * SEGMENT_LEN;
    const camZ = host?.camera.position.z ?? PLAYER_Z;
    const front = camZ + SEGMENT_LEN * 0.5 + 14;

    for (const piece of [...roads, ...shoulders, ...props]) {
      piece.z += scroll;
      piece.z = wrapZ(piece.z, front, span);
      piece.group.position.z = piece.z;
    }

    lane += (targetLane - lane) * Math.min(1, dt * steerRate());
    player.position.x = laneX(lane, config.laneCount);
    const rolled = scroll / WHEEL_R;
    for (const wheel of playerWheels) wheel.rotateX(rolled);

    if (finishLine) {
      const z = finishWorldZ();
      finishLine.position.z = z;
      finishLine.visible = z > PLAYER_Z - 52;
    }

    for (const actor of actors) {
      actor.z += scroll;
      actor.group.position.z = actor.z;
      if (actor.kind === "coin") actor.group.rotation.y += dt * 2.4;
      for (const wheel of actor.wheels) wheel.rotateX(rolled);
      if (actor.z > PLAYER_Z + 3.2) recycleActor(actor, PLAYER_Z - SEGMENT_LEN * 1.15);
      if (!actor.group.visible) continue;
      const sameLane = Math.abs(actor.lane - targetLane) < 0.5;
      if (inSpawnGrace() && sameLane) continue;
      const near = Math.abs(actor.z - PLAYER_Z) < (actor.kind === "coin" ? 0.85 : 1.35);
      if (!sameLane || !near) continue;
      if (actor.kind === "hazard") {
        finish("lose");
        return;
      }
      actor.group.visible = false;
      earned += 1;
      syncHud();
    }

    if (distance >= round.winDistance) completeRound();
  }

  function build() {
    void rebuild();
  }

  async function rebuild() {
    if (!host || !config || !world) return;
    const gen = ++buildGen;
    building = true;
    try {
      const cfg = config;
      const { round } = liveRound(cfg);
      const assets = ctx?.assets ?? {};
      setRuntimeAssets(assets);
      const theme = THEMES[cfg.environmentTheme] ?? THEMES.city;
      const playerId =
        !cfg.characterModelUrl || cfg.characterModelUrl === "runner" ? "sedan" : cfg.characterModelUrl;
      const rawObstacles = cfg.obstacleSet.filter(Boolean).map(normalizeTrafficId);
      const obstacleIds = rawObstacles.length ? rawObstacles : ["suv", "taxi", "truck", "cone"];
      const needed = [playerId, ...obstacleIds];
      await Promise.all(
        needed.map(async (id) => {
          if (templates.has(id)) return;
          const url = resolveRuntimeUrl(id, assets);
          const scene = await loadTemplate(url);
          if (scene) templates.set(id, scene);
        }),
      );

      let roadMap: Texture | null = null;
      const roadUrl = resolveRuntimeUrl(cfg.roadTextureUrl, assets);
      if (roadUrl) {
        try {
          roadMap = await Promise.race([
            loadTexture(roadUrl),
            new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("tex timeout")), 8000)),
          ]);
        } catch {
          roadMap = null;
        }
      }
      let grassMap: Texture | null = null;
      const grassUrl = resolveRuntimeUrl(cfg.grassTextureUrl || (cfg.environmentTheme === "city" ? KENNEY_GRASS_URL : ""), assets);
      if (grassUrl) {
        try {
          grassMap = await Promise.race([
            loadTexture(grassUrl),
            new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("tex timeout")), 8000)),
          ]);
        } catch {
          grassMap = null;
        }
      }
      if (gen !== buildGen || !host || !world || config !== cfg) return;
      const root = world;

      while (root.children.length) root.remove(root.children[0]);
      actors = [];
      roads = [];
      shoulders = [];
      props = [];
      finishLine = null;
      player = null;
      playerWheels = [];
      ended = false;
      distance = 0;
      roundElapsed = 0;
      speed = round.startSpeed;
      lane = Math.floor((cfg.laneCount - 1) / 2);
      targetLane = lane;
      syncHud();

      host.setBackgroundColor(theme.fog);
      host.scene.fog = new Fog(theme.fog, 28, 72);

      const roadW = cfg.laneCount * LANE_GAP + 0.55;
      const painted = roadMap ? null : createLaneRoadTexture(cfg.laneCount);
      if (painted) host.tracker.track(painted);
      const roadTex = roadMap ? roadMap.clone() : painted!;
      roadTex.wrapS = RepeatWrapping;
      roadTex.wrapT = RepeatWrapping;
      roadTex.repeat.set(1, 4);
      const wrapFront = host.camera.position.z + SEGMENT_LEN * 0.5 + 14;

      for (let i = 0; i < SEGMENT_COUNT; i++) {
        const z = wrapFront - SEGMENT_LEN * 0.5 - i * SEGMENT_LEN;
        const geo = new PlaneGeometry(roadW, SEGMENT_LEN);
        host.tracker.track(geo);
        const mat = new MeshStandardMaterial({
          map: roadTex,
          color: roadMap ? "#ffffff" : "#ffffff",
          roughness: 0.92,
          metalness: 0.04,
        });
        host.tracker.track(mat);
        const mesh = new Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(0, 0, z);
        root.add(mesh);
        roads.push({ group: mesh, z });

        const shoulderGeo = new PlaneGeometry(18, SEGMENT_LEN);
        host.tracker.track(shoulderGeo);
        const gTex = grassMap ? grassMap.clone() : null;
        if (gTex) gTex.repeat.set(4, 6);
        const shoulderMat = new MeshStandardMaterial(
          gTex
            ? { map: gTex, color: cfg.environmentTheme === "neon" ? "#8899aa" : "#ffffff", roughness: 0.96, metalness: 0 }
            : { color: theme.shoulder, roughness: 0.96, metalness: 0 },
        );
        host.tracker.track(shoulderMat);
        const shoulder = new Mesh(shoulderGeo, shoulderMat);
        shoulder.rotation.x = -Math.PI / 2;
        shoulder.position.set(0, -0.03, z);
        root.add(shoulder);
        shoulders.push({ group: shoulder, z });
      }

      const coverGeo = new PlaneGeometry(40, 48);
      host.tracker.track(coverGeo);
      const coverMat = new MeshStandardMaterial({
        color: theme.shoulder,
        roughness: 1,
        metalness: 0,
      });
      host.tracker.track(coverMat);
      const cover = new Mesh(coverGeo, coverMat);
      cover.rotation.x = -Math.PI / 2;
      cover.position.set(0, -0.06, (host.camera.position.z + PLAYER_Z) * 0.5);
      root.add(cover);

      const side = roadW / 2 + 1.7;
      const wrapSpan = SEGMENT_COUNT * SEGMENT_LEN;
      for (let i = 0; i < 8; i++) {
        const prop = makeProp(theme, i);
        const z = wrapZ(PLAYER_Z - 2 - (i % 4) * (SEGMENT_LEN / 1.35), wrapFront, wrapSpan);
        const x = i < 4 ? -side : side;
        prop.position.set(x, 0, z);
        root.add(prop);
        props.push({ group: prop, z });
      }

      player = stampModel(playerId, "#e07a3d", 2.05, true);
      player.position.set(laneX(lane, cfg.laneCount), 0, PLAYER_Z);
      root.add(player);
      playerWheels = collectWheels(player);

      finishLine = makeFinishLine(roadW);
      finishLine.position.set(0, 0, finishWorldZ());
      root.add(finishLine);

      const hazards = obstacleIds.slice(0, 6);
      while (hazards.length < 6) hazards.push(obstacleIds[hazards.length % obstacleIds.length] || "suv");
      const graceWorld = round.startSpeed * SPAWN_GRACE_SEC * 4.2;
      const firstZ = PLAYER_Z - Math.max(14, graceWorld + 4);
      hazards.forEach((id, i) => {
        const tint = TRAFFIC_COLORS[i % TRAFFIC_COLORS.length];
        const size = isConeId(id) ? 0.78 : 2.0;
        const group = stampModel(id, tint, size, true);
        const baseZ = firstZ - i * 5.5;
        let laneIndex = pickPassableLane(baseZ, cfg.laneCount);
        let z = baseZ;
        if (laneIndex < 0) {
          const spot = findPassableSpawn(firstZ - i * 5.5, cfg.laneCount);
          if (spot) {
            laneIndex = spot.lane;
            z = spot.z;
          } else {
            group.visible = false;
            laneIndex = 0;
            z = baseZ - SEGMENT_LEN;
          }
        }
        group.position.set(laneX(laneIndex, cfg.laneCount), 0, z);
        root.add(group);
        actors.push({ group, lane: laneIndex, z, kind: "hazard", wheels: collectWheels(group) });
      });

      for (let i = 0; i < 4; i++) {
        const group = makeCoin();
        const laneIndex = pickCoinLane(cfg.laneCount);
        const z = firstZ + 4 - i * 7;
        group.position.set(laneX(laneIndex, cfg.laneCount), 0.55, z);
        root.add(group);
        actors.push({ group, lane: laneIndex, z, kind: "coin", wheels: [] });
      }
    } finally {
      if (gen === buildGen) building = false;
    }
  }

  return {
    id: "lane-runner",
    name: "Endless Car Driving",
    initialize(init) {
      ctx = init;
      const extra = init as EngineInitContext & {
        laneRunner?: LaneRunnerConfig;
        playAllRounds?: boolean;
        parkingRoundIndex?: number;
      };
      config = extra.laneRunner ?? {
        characterModelUrl: "sedan",
        obstacleSet: ["suv", "taxi", "truck", "cone"],
        environmentTheme: "city",
        laneCount: 3,
        startSpeed: 4,
        speedRamp: 0.5,
        laneSwitchSpeed: 10,
        winDistance: 160,
        roadTextureUrl: "",
        grassTextureUrl: "",
        coinImageUrl: "",
        rounds: [],
      };
      playAllRounds = extra.playAllRounds !== false;
      roundIndex = typeof extra.parkingRoundIndex === "number" ? extra.parkingRoundIndex : 0;
      roundIndex = Math.max(0, Math.min(roundIndex, listLaneRounds(config).length - 1));
      lastEditorRoundIndex = roundIndex;
      host = new ThreeHost(init.container);
      host.enableStudioEnvironment();
      host.applyParkingJamLighting(init.lighting);
      host.applyCamera(init.camera, init.orientation, host.camera.aspect);
      world = new Group();
      host.scene.add(world);
      hud.mount(init.container);
      syncHud();
      build();
      detach = attachPointer(host.canvas, (e) => {
        if (!config || ended || hud.busy() || building) return;
        if (e.kind === "swipe" && e.swipe) {
          if (Math.abs(e.swipe.dx) > Math.abs(e.swipe.dy)) {
            targetLane = Math.max(0, Math.min(config.laneCount - 1, targetLane + (e.swipe.dx > 0 ? 1 : -1)));
          }
        }
      });
    },
    start() {
      started = true;
      host?.start((dt) => {
        hud.tick(performance.now());
        if (!started || ended || !config || !player || hud.busy() || building) return;
        tickScroll(dt);
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
      templates.clear();
    },
    onWin(cb) {
      onWin = cb;
    },
    onLose(cb) {
      onLose = cb;
    },
    setOptions(options) {
      const next = options.laneRunner as LaneRunnerConfig | undefined;
      const prevKey = config ? layoutKey(config, roundIndex, playAllRounds) : "";
      if (next) config = next;
      if (typeof options.playAllRounds === "boolean") playAllRounds = options.playAllRounds;
      if (typeof options.parkingRoundIndex === "number" && config) {
        const n = listLaneRounds(config).length;
        const nextIdx = Math.max(0, Math.min(Math.floor(options.parkingRoundIndex), n - 1));
        if (lastEditorRoundIndex !== null && nextIdx !== lastEditorRoundIndex) {
          hud.cancel();
          earned = 0;
          roundIndex = nextIdx;
        }
        lastEditorRoundIndex = nextIdx;
      }
      if (config) {
        const nextKey = layoutKey(config, roundIndex, playAllRounds);
        if (!prevKey || prevKey !== nextKey) void rebuild();
        else syncHud();
      }
      if (ctx) applyLivePresentation(host, options, ctx);
      if (typeof options.lighting === "string") {
        host?.applyParkingJamLighting(options.lighting as EngineInitContext["lighting"]);
      }
    },
    resize(w, h) {
      host?.resize(w, h);
      hud.resize();
    },
  };
}
