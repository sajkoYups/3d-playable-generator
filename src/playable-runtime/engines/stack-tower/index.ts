import {
  BoxGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  TextureLoader,
} from "three";
import type { StackTowerConfig } from "@/types/project";
import type { EngineInitContext, Playable3DEngine, PointerEvent3D } from "@/playable-runtime/engines/types";
import { ThreeHost } from "@/playable-runtime/three/host";
import { applyLivePresentation } from "@/playable-runtime/three/presentation";
import { attachPointer } from "@/playable-runtime/three/input";
import { blobShadow } from "@/playable-runtime/models/procedural";
import { resolveRuntimeUrl } from "@/playable-runtime/models/assets";
import { createPayoutHud, DEFAULT_COIN_URL } from "@/playable-runtime/engines/parking-jam/payout";
import { listStackRounds, stackCoinsTotal } from "@/playable-runtime/engines/stack-tower/rounds";

type Layer = {
  mesh: Mesh;
  x: number;
  z: number;
  w: number;
  d: number;
  y: number;
};

export function createStackTowerEngine(): Playable3DEngine {
  let host: ThreeHost | null = null;
  let config: StackTowerConfig | null = null;
  let moving: Mesh | null = null;
  let dir = 1;
  let axis: "x" | "z" = "x";
  let speed = 1.4;
  let layers: Layer[] = [];
  let misses = 0;
  let combo = 0;
  let started = false;
  let ended = false;
  let onWin: () => void = () => undefined;
  let onLose: () => void = () => undefined;
  let detach: (() => void) | null = null;
  let textureUrl = "";
  let root: Group | null = null;
  let ctx: EngineInitContext | null = null;
  let playAllRounds = true;
  let roundIndex = 0;
  let lastEditorRoundIndex: number | null = null;
  let earned = 0;
  const hud = createPayoutHud();

  const blockH = 0.42;

  function liveRound(cfg = config!) {
    const rounds = listStackRounds(cfg);
    const index = Math.max(0, Math.min(roundIndex, rounds.length - 1));
    return { round: rounds[index], index, total: rounds.length };
  }

  function layoutKey(cfg: StackTowerConfig, idx: number, playAll: boolean) {
    const { round, index, total } = liveRound(cfg);
    return JSON.stringify({
      playAll,
      index,
      total,
      blocks: round.blocksToWin,
      speed: round.speed,
      ramp: round.speedRamp,
      miss: round.missLimit,
      palette: cfg.palette,
      finish: cfg.materialFinish,
      tex: cfg.faceTextureUrl,
    });
  }

  function syncHud() {
    if (!config) return;
    const url = resolveRuntimeUrl(config.coinImageUrl || DEFAULT_COIN_URL, ctx?.assets ?? {});
    hud.setCoinUrl(url || DEFAULT_COIN_URL);
    hud.setState(earned, stackCoinsTotal(config));
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
    hud.setState(earned, stackCoinsTotal(config));
    hud.startPayout({
      from,
      to: earned,
      reward,
      nextRound: hasNext ? index + 2 : null,
      onDone: (kind) => {
        if (kind === "next") {
          roundIndex = index + 1;
          build();
          return;
        }
        finish("win");
      },
    });
  }

  function stackLift() {
    return Math.max(0, layers.length - 1) * blockH * 0.55;
  }

  function applyStackCamera() {
    if (!host || !ctx) return;
    host.applyCamera(ctx.camera, ctx.orientation, host.camera.aspect);
    const lift = stackLift();
    host.camera.position.y += lift;
    const top = layers[layers.length - 1];
    host.camera.lookAt(
      top?.x ?? ctx.camera.target.x,
      ctx.camera.target.y + lift,
      top?.z ?? ctx.camera.target.z,
    );
  }

  function applyLights(preset: EngineInitContext["lighting"]) {
    host?.applyParkingJamLighting(preset);
  }

  function makeMat(color: string) {
    const finish = config?.materialFinish ?? "glossy";
    const mat = new MeshStandardMaterial({
      color: new Color(color),
      roughness: finish === "matte" ? 0.86 : finish === "metallic" ? 0.28 : 0.32,
      metalness: finish === "metallic" ? 0.72 : 0.12,
      envMapIntensity: finish === "matte" ? 0.4 : 1.15,
    });
    host?.tracker.track(mat);
    if (textureUrl) {
      const tex = new TextureLoader().load(textureUrl);
      host?.tracker.trackTexture(tex);
      mat.map = tex;
    }
    return mat;
  }

  function addLayer(x: number, z: number, w: number, d: number, y: number, color: string) {
    const geo = new BoxGeometry(w, blockH, d);
    host!.tracker.track(geo);
    const mesh = new Mesh(geo, makeMat(color));
    mesh.position.set(x, y, z);
    root!.add(mesh);
    const shadow = blobShadow(host!.tracker, Math.max(w, d) * 0.55);
    shadow.position.set(x, 0.02, z);
    root!.add(shadow);
    const layer: Layer = { mesh, x, z, w, d, y };
    layers.push(layer);
    return layer;
  }

  function spawnMover() {
    const prev = layers[layers.length - 1];
    axis = layers.length % 2 === 0 ? "x" : "z";
    dir = Math.random() > 0.5 ? 1 : -1;
    const color = config!.palette[layers.length % config!.palette.length];
    const geo = new BoxGeometry(prev.w, blockH, prev.d);
    host!.tracker.track(geo);
    moving = new Mesh(geo, makeMat(color));
    moving.position.set(prev.x, prev.y + blockH, prev.z);
    if (axis === "x") moving.position.x = prev.x + dir * 3.2;
    else moving.position.z = prev.z + dir * 3.2;
    root!.add(moving);
  }

  function drop() {
    if (!moving || !started || ended || hud.busy() || !config) return;
    const { round } = liveRound();
    const prev = layers[layers.length - 1];
    const mx = moving.position.x;
    const mz = moving.position.z;
    let w = prev.w;
    let d = prev.d;
    let x = prev.x;
    let z = prev.z;
    const perfectThreshold = 0.08;

    if (axis === "x") {
      const delta = mx - prev.x;
      const overlap = prev.w - Math.abs(delta);
      if (overlap <= 0.04) {
        misses += 1;
        combo = 0;
        root!.remove(moving);
        moving = null;
        if (misses >= round.missLimit) finish("lose");
        else spawnMover();
        return;
      }
      if (Math.abs(delta) < perfectThreshold) {
        combo += 1;
        x = prev.x;
        w = prev.w;
      } else {
        combo = 0;
        w = overlap;
        x = prev.x + delta / 2;
      }
    } else {
      const delta = mz - prev.z;
      const overlap = prev.d - Math.abs(delta);
      if (overlap <= 0.04) {
        misses += 1;
        combo = 0;
        root!.remove(moving);
        moving = null;
        if (misses >= round.missLimit) finish("lose");
        else spawnMover();
        return;
      }
      if (Math.abs(delta) < perfectThreshold) {
        combo += 1;
        z = prev.z;
        d = prev.d;
      } else {
        combo = 0;
        d = overlap;
        z = prev.z + delta / 2;
      }
    }

    root!.remove(moving);
    moving = null;
    const color = config.palette[layers.length % config.palette.length];
    addLayer(x, z, w, d, prev.y + blockH, color);
    applyStackCamera();
    speed += round.speedRamp;
    if (layers.length - 1 >= round.blocksToWin) completeRound();
    else spawnMover();
  }

  function build() {
    if (!host || !config || !root) return;
    while (root.children.length) root.remove(root.children[0]);
    layers = [];
    moving = null;
    misses = 0;
    combo = 0;
    ended = false;
    const { round } = liveRound();
    speed = round.speed;
    addLayer(0, 0, 2.4, 2.4, blockH / 2, "#2a2e3a");
    spawnMover();
    applyStackCamera();
    syncHud();
  }

  return {
    id: "stack-tower",
    name: "Stack Tower",
    initialize(init) {
      ctx = init;
      const extra = init as EngineInitContext & {
        stackTower?: StackTowerConfig;
        playAllRounds?: boolean;
        parkingRoundIndex?: number;
      };
      config = extra.stackTower ?? ({} as StackTowerConfig);
      if (!config.palette) {
        config = {
          palette: ["#e07a3d", "#2bb5a0", "#f3ede0", "#7c5cff", "#e85d4c"],
          materialFinish: "glossy",
          faceTextureUrl: "",
          speed: 1.4,
          speedRamp: 0.08,
          blocksToWin: 10,
          missLimit: 3,
          rounds: [],
          coinImageUrl: "",
        };
      }
      playAllRounds = extra.playAllRounds !== false;
      roundIndex = typeof extra.parkingRoundIndex === "number" ? extra.parkingRoundIndex : 0;
      roundIndex = Math.max(0, Math.min(roundIndex, listStackRounds(config).length - 1));
      lastEditorRoundIndex = roundIndex;
      textureUrl = config.faceTextureUrl || "";
      host = new ThreeHost(init.container);
      host.enableStudioEnvironment();
      applyLights(init.lighting);
      host.applyCamera(init.camera, init.orientation, host.camera.aspect);
      const floorGeo = new PlaneGeometry(18, 18);
      host.tracker.track(floorGeo);
      const floorMat = new MeshStandardMaterial({ color: "#1c2230", roughness: 0.92, metalness: 0.04, envMapIntensity: 0.35 });
      host.tracker.track(floorMat);
      const floor = new Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      host.scene.add(floor);
      root = new Group();
      host.scene.add(root);
      hud.mount(init.container);
      syncHud();
      build();
      detach = attachPointer(host.canvas, (e) => {
        if (e.kind === "tap") drop();
      });
    },
    start() {
      if (!host) return;
      started = true;
      host.start((dt) => {
        hud.tick(performance.now());
        if (!moving || !started || ended || hud.busy()) return;
        const prev = layers[layers.length - 1];
        const limit = 3.4;
        if (axis === "x") {
          moving.position.x += dir * speed * dt;
          if (Math.abs(moving.position.x - prev.x) > limit) dir *= -1;
        } else {
          moving.position.z += dir * speed * dt;
          if (Math.abs(moving.position.z - prev.z) > limit) dir *= -1;
        }
      });
    },
    pause() {
      started = false;
      host?.pause();
    },
    reset() {
      ended = false;
      started = true;
      hud.cancel();
      earned = 0;
      if (playAllRounds) roundIndex = 0;
      build();
    },
    destroy() {
      detach?.();
      hud.destroy();
      host?.destroy();
      host = null;
      root = null;
      ctx = null;
    },
    onWin(cb) {
      onWin = cb;
    },
    onLose(cb) {
      onLose = cb;
    },
    setOptions(options) {
      const next = options.stackTower as StackTowerConfig | undefined;
      const prevKey = config ? layoutKey(config, roundIndex, playAllRounds) : "";
      if (next) {
        config = next;
        textureUrl = next.faceTextureUrl || "";
      }
      if (typeof options.playAllRounds === "boolean") playAllRounds = options.playAllRounds;
      if (typeof options.parkingRoundIndex === "number" && config) {
        const n = listStackRounds(config).length;
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
        if (!prevKey || prevKey !== nextKey) build();
        else syncHud();
      }
      if (ctx) applyLivePresentation(host, options, ctx);
      if (typeof options.lighting === "string") {
        applyLights(options.lighting as EngineInitContext["lighting"]);
      }
      applyStackCamera();
    },
    handlePointer(e: PointerEvent3D) {
      if (e.kind === "tap") drop();
    },
    resize(w, h) {
      host?.resize(w, h);
      hud.resize();
      applyStackCamera();
    },
  };
}
