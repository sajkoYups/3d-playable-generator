import { BoxGeometry, Color, Group, Mesh, MeshStandardMaterial, PlaneGeometry } from "three";
import type { LaneRunnerConfig } from "@/types/project";
import type { EngineInitContext, Playable3DEngine } from "@/playable-runtime/engines/types";
import { ThreeHost } from "@/playable-runtime/three/host";
import { applyLivePresentation } from "@/playable-runtime/three/presentation";
import { attachPointer } from "@/playable-runtime/three/input";
import { blobShadow, createProceduralModel } from "@/playable-runtime/models/procedural";

type Obstacle = { group: Group; lane: number; z: number; kind: "hazard" | "coin" };

const THEMES: Record<LaneRunnerConfig["environmentTheme"], { ground: string; fog: string }> = {
  desert: { ground: "#c4a574", fog: "#e8d5b5" },
  city: { ground: "#2a2e3a", fog: "#1c1f2a" },
  neon: { ground: "#14081f", fog: "#0a0614" },
};

export function createLaneRunnerEngine(): Playable3DEngine {
  let host: ThreeHost | null = null;
  let config: LaneRunnerConfig | null = null;
  let started = false;
  let ended = false;
  let lane = 1;
  let targetLane = 1;
  let distance = 0;
  let speed = 8;
  let obstacles: Obstacle[] = [];
  let spawnT = 0;
  let onWin: () => void = () => undefined;
  let onLose: () => void = () => undefined;
  let detach: (() => void) | null = null;
  let world: Group | null = null;
  let ctx: EngineInitContext | null = null;
  let player: Group | null = null;

  function laneX(i: number, count: number) {
    const mid = (count - 1) / 2;
    return (i - mid) * 1.6;
  }

  function finish(kind: "win" | "lose") {
    if (ended) return;
    ended = true;
    started = false;
    if (kind === "win") onWin();
    else onLose();
  }

  function spawn(kind: "hazard" | "coin") {
    if (!host || !config || !world) return;
    const count = config.laneCount;
    const laneIndex = Math.floor(Math.random() * count);
    const modelId = kind === "coin" ? "coin" : config.obstacleSet[Math.floor(Math.random() * config.obstacleSet.length)] || "crate";
    const group = createProceduralModel(modelId, host.tracker);
    group.position.set(laneX(laneIndex, count), kind === "coin" ? 0.7 : 0.45, -28);
    if (kind === "hazard") group.add(blobShadow(host.tracker, 0.45));
    world.add(group);
    obstacles.push({ group, lane: laneIndex, z: -28, kind });
  }

  function build() {
    if (!host || !config || !world) return;
    while (world.children.length) world.remove(world.children[0]);
    obstacles = [];
    distance = 0;
    speed = config.startSpeed;
    ended = false;
    lane = Math.floor((config.laneCount - 1) / 2);
    targetLane = lane;

    const theme = THEMES[config.environmentTheme];
    host.setBackgroundColor(theme.fog);
    const groundGeo = new PlaneGeometry(12, 80);
    host.tracker.track(groundGeo);
    const groundMat = new MeshStandardMaterial({ color: new Color(theme.ground), roughness: 0.95 });
    host.tracker.track(groundMat);
    const ground = new Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -20;
    world.add(ground);

    for (let i = 0; i < config.laneCount; i++) {
      const stripeGeo = new BoxGeometry(0.08, 0.02, 80);
      host.tracker.track(stripeGeo);
      const stripeMat = new MeshStandardMaterial({ color: "#f3ede0", roughness: 0.6 });
      host.tracker.track(stripeMat);
      const stripe = new Mesh(stripeGeo, stripeMat);
      stripe.position.set(laneX(i, config.laneCount) - 0.7, 0.03, -20);
      world.add(stripe);
    }

    player = createProceduralModel(config.characterModelUrl || "runner", host.tracker);
    player.position.set(laneX(lane, config.laneCount), 0.2, 4);
    player.add(blobShadow(host.tracker, 0.4));
    world.add(player);
  }

  return {
    id: "lane-runner",
    name: "Lane Runner",
    initialize(init) {
      ctx = init;
      config = ((init as EngineInitContext & { laneRunner?: LaneRunnerConfig }).laneRunner) ?? {
        characterModelUrl: "runner",
        obstacleSet: ["crate", "barrier", "cone"],
        environmentTheme: "city",
        laneCount: 3,
        startSpeed: 8,
        speedRamp: 0.6,
        winDistance: 180,
      };
      host = new ThreeHost(init.container);
      host.applyLighting(init.lighting);
      host.applyCamera(init.camera, init.orientation, host.camera.aspect);
      world = new Group();
      host.scene.add(world);
      build();
      detach = attachPointer(host.canvas, (e) => {
        if (!config) return;
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
        if (!started || ended || !config || !player) return;
        speed += config.speedRamp * dt;
        distance += speed * dt * 4;
        spawnT += dt;
        if (spawnT > Math.max(0.45, 1.1 - speed * 0.04)) {
          spawnT = 0;
          spawn(Math.random() > 0.72 ? "coin" : "hazard");
        }
        lane += (targetLane - lane) * Math.min(1, dt * 10);
        player.position.x = laneX(lane, config.laneCount);
        player.position.y = 0.2 + Math.sin(distance * 0.2) * 0.05;
        for (const ob of obstacles) {
          ob.z += speed * dt * 4.2;
          ob.group.position.z = ob.z;
          if (ob.z > 6.5) ob.group.visible = false;
          const sameLane = Math.abs(ob.lane - targetLane) < 0.5 && Math.abs(ob.z - player.position.z) < 0.8;
          if (sameLane && ob.group.visible) {
            if (ob.kind === "hazard") finish("lose");
            else ob.group.visible = false;
          }
        }
        obstacles = obstacles.filter((o) => o.z < 8);
        if (distance >= config.winDistance) finish("win");
      });
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
      const next = options.laneRunner as LaneRunnerConfig | undefined;
      if (next) config = next;
      if (ctx) applyLivePresentation(host, options, ctx);
    },
    resize(w, h) {
      host?.resize(w, h);
    },
  };
}
