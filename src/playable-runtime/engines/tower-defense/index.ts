import {
  AnimationClip,
  AnimationMixer,
  Box3,
  BoxGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  LoopOnce,
  LoopRepeat,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Raycaster,
  RingGeometry,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderTarget,
} from "three";
import type { TowerDefenseConfig, TowerDefenseTowerStats } from "@/types/project";
import type { EngineInitContext, Playable3DEngine } from "@/playable-runtime/engines/types";
import { AudioBus } from "@/playable-runtime/audio/bus";
import { pickSoundUrl, PLAYABLE_SOUNDS } from "@/playable-runtime/audio/defaults";
import { ThreeHost } from "@/playable-runtime/three/host";
import { applyLivePresentation } from "@/playable-runtime/three/presentation";
import { attachPointer } from "@/playable-runtime/three/input";
import { blobShadow } from "@/playable-runtime/models/procedural";
import type { ResourceTracker } from "@/playable-runtime/three/resources";
import {
  cloneSkinnedModel,
  cloneTexturedModel,
  fitObjectToMax,
  LIBRARY_BESTIARY_URLS,
  LIBRARY_TD_URLS,
  loadGltfScene,
  resolveRuntimeUrl,
  setRuntimeAssets,
} from "@/playable-runtime/models/assets";
import { createPayoutHud, DEFAULT_COIN_URL } from "@/playable-runtime/engines/parking-jam/payout";
import { listTdRounds, tdCoinsTotal } from "@/playable-runtime/engines/tower-defense/rounds";
import { buildTdMap, cellToWorld, MAP_COLS, MAP_ROWS, pathWaypoints, TILE_SIZE, type TdMap } from "@/playable-runtime/engines/tower-defense/map";
import {
  ENEMY_BASE,
  ENEMY_LOOK,
  ENEMY_MESH,
  firstInRange,
  polylineLength,
  samplePath,
  spawnWaveQueue,
  TOWER_RECIPES,
  type CombatEnemy,
  type CombatShot,
  type CombatTower,
  type EnemyKind,
  type TowerKind,
  type Waypoint,
} from "@/playable-runtime/engines/tower-defense/combat";
import { createTdHud } from "@/playable-runtime/engines/tower-defense/hud";

type PadActor = {
  col: number;
  row: number;
  x: number;
  z: number;
  hit: Mesh;
  marker: Group;
  ringMat: MeshBasicMaterial;
  tower: CombatTower | null;
  towerGroup: Group | null;
  weapon: Group | null;
};

/** Kenney tile slabs are 0.2 tall; markers must sit on the top face, not at y=0. */
const TILE_TOP = 0.2;
const TOWER_SCALE = 1.25;

type EnemyActor = CombatEnemy & {
  group: Group;
  glowMats: MeshStandardMaterial[];
  hitFlash: number;
  mixer: AnimationMixer | null;
  baseScale: { x: number; y: number; z: number };
  fell: boolean;
  headY: number;
  hpBar: Group;
  hpFill: Mesh;
  hpFillMat: MeshBasicMaterial;
  hpWidth: number;
};

const _muzzle = new Vector3();

const SHOT_SPEED = 14;
const HIT_FLASH = 0.12;

function emptyConfig(): TowerDefenseConfig {
  return {
    lives: 8,
    startingGold: 80,
    coinImageUrl: "",
    towers: {
      arrow: { cost: 50, damage: 8, range: 1.8, fireRate: 1.5 },
      cannon: { cost: 80, damage: 20, range: 1.7, fireRate: 0.65 },
      turret: { cost: 110, damage: 4, range: 1.4, fireRate: 5 },
    },
    sounds: {
      arrowFireUrl: "",
      cannonFireUrl: "",
      turretFireUrl: "",
      hitUrl: "",
      deathUrl: "",
      leakUrl: "",
      placeUrl: "",
      waveUrl: "",
    },
    rounds: [],
  };
}

const FIRE_SFX: Record<TowerKind, string> = {
  arrow: "arrowFire",
  cannon: "cannonFire",
  turret: "turretFire",
};

const FIRE_GAP: Record<TowerKind, number> = {
  arrow: 70,
  cannon: 40,
  turret: 90,
};

function tdSoundUrls(cfg: TowerDefenseConfig, assets: Record<string, string>) {
  const s = cfg.sounds ?? emptyConfig().sounds;
  const pick = (url: string) => resolveRuntimeUrl(url, assets) || url;
  return {
    arrowFire: pick(pickSoundUrl(s.arrowFireUrl, PLAYABLE_SOUNDS.arrowFire)),
    cannonFire: pick(pickSoundUrl(s.cannonFireUrl, PLAYABLE_SOUNDS.cannonFire)),
    turretFire: pick(pickSoundUrl(s.turretFireUrl, PLAYABLE_SOUNDS.turretFire)),
    hit: pick(s.hitUrl),
    death: pick(s.deathUrl),
    leak: pick(s.leakUrl),
    place: pick(s.placeUrl),
    wave: pick(s.waveUrl),
  };
}

async function loadTemplate(url: string) {
  if (!url) return null;
  try {
    return await Promise.race([
      loadGltfScene(url),
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error("gltf timeout")), 20000);
      }),
    ]);
  } catch {
    return null;
  }
}

function seatOnGround(object: Group) {
  object.updateWorldMatrix(true, true);
  const box = new Box3().setFromObject(object);
  if (Number.isFinite(box.min.y)) object.position.y -= box.min.y;
}

function dressPiece(object: Object3D, model: string) {
  const roof = model.startsWith("tower-square-roof");
  const wall = model.startsWith("tower-square-bottom") || model.startsWith("tower-square-middle") || model.startsWith("tower-square-top");
  const lawn = model === "tile" || model.startsWith("tile-tree") || model === "tile-slope" || model === "tile-hill" || model.startsWith("tile-straight") || model.startsWith("tile-corner") || model === "tile-spawn" || model === "tile-end";
  if (!roof && !wall && !lawn) return;
  object.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of list) {
      if (!(m instanceof MeshStandardMaterial)) continue;
      if (roof) {
        m.map = null;
        m.color.set("#c24b3a");
      } else if (wall) {
        m.map = null;
        m.color.set("#c6a37a");
      } else if (!m.userData.lawnShift) {
        m.userData.lawnShift = true;
        m.onBeforeCompile = (shader) => {
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <color_fragment>",
            `#include <color_fragment>
            if (diffuseColor.g > diffuseColor.r + 0.02) {
              float g = diffuseColor.g;
              diffuseColor.rgb = vec3(g * 0.42, g * 0.92, g * 0.88);
            }`,
          );
        };
      }
      m.needsUpdate = true;
    }
  });
}

function flatColors(object: Object3D) {
  object.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of list) {
      if (!(m instanceof MeshStandardMaterial)) continue;
      m.metalness = 0;
      m.roughness = Math.max(m.roughness, 0.72);
      m.envMapIntensity = 0;
    }
  });
}

function fallbackTile(tracker: ResourceTracker, color: string) {
  const g = new Group();
  const geo = new BoxGeometry(TILE_SIZE * 0.98, 0.18, TILE_SIZE * 0.98);
  const mat = new MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });
  tracker.track(geo);
  tracker.track(mat);
  const mesh = new Mesh(geo, mat);
  mesh.position.y = 0.09;
  g.add(mesh);
  return g;
}

function fallbackTower(tracker: ResourceTracker, color: string) {
  const g = new Group();
  const geo = new CylinderGeometry(0.38, 0.46, 1.1, 10);
  const mat = new MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.08 });
  tracker.track(geo);
  tracker.track(mat);
  const mesh = new Mesh(geo, mat);
  mesh.position.y = 0.55;
  g.add(mesh);
  return g;
}

function applyEnemyPaint(mats: MeshStandardMaterial[], kind: EnemyKind, flashU = 0) {
  const look = ENEMY_LOOK[kind];
  for (const m of mats) {
    if (m.map) m.color.setRGB(look.exposure, look.exposure, look.exposure);
    else if (!m.userData.tdLit) {
      m.userData.tdLit = 1;
      const lin = m.color.r * 0.2126 + m.color.g * 0.7152 + m.color.b * 0.0722;
      if (lin > 0.0001 && lin < 0.4) m.color.multiplyScalar(Math.min(6.5, 0.58 / lin));
    }
    if (m.emissiveMap) {
      m.emissive.set("#ffffff");
      m.emissiveIntensity = look.glow + flashU * 1.8;
    } else {
      m.emissive.copy(m.color);
      m.emissiveIntensity = 0.4 + flashU * 0.85;
    }
    m.roughness = Math.min(m.roughness, look.roughness);
    m.metalness = 0;
    m.metalnessMap = null;
    m.envMapIntensity = 0;
    m.needsUpdate = true;
  }
}

function playNamedClip(group: Group, mixer: AnimationMixer, name: string, loop: boolean) {
  const clips = group.userData.clips as AnimationClip[] | undefined;
  const clip = clips?.find((c) => c.name === name);
  if (!clip) return false;
  mixer.stopAllAction();
  const action = mixer.clipAction(clip);
  action.reset();
  action.setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1);
  action.clampWhenFinished = !loop;
  action.play();
  return true;
}

function playEnemyClip(group: Group) {
  const clips = group.userData.clips as AnimationClip[] | undefined;
  if (!clips?.length) return null;
  const root = (group.userData.mixerRoot as Object3D | undefined) ?? group;
  const mixer = new AnimationMixer(root);
  const walked = playNamedClip(group, mixer, "Walk", true);
  if (walked) return mixer;
  const clip = clips.find((c) => /walk|run|move|locomotion/i.test(c.name)) ?? clips[0];
  if (!clip) return null;
  const action = mixer.clipAction(clip);
  action.setLoop(LoopRepeat, Infinity);
  action.play();
  return mixer;
}

function enemyHealthBar(tracker: ResourceTracker, width: number) {
  const group = new Group();
  group.name = "hp-bar";
  const barH = 0.14;
  const bgGeo = new PlaneGeometry(width + 0.06, barH + 0.03);
  const fillGeo = new PlaneGeometry(width, barH);
  const bgMat = new MeshBasicMaterial({ color: "#1a120c", depthTest: false, depthWrite: false });
  const fillMat = new MeshBasicMaterial({ color: "#b6ff4a", depthTest: false, depthWrite: false });
  tracker.track(bgGeo);
  tracker.track(fillGeo);
  tracker.track(bgMat);
  tracker.track(fillMat);
  const bg = new Mesh(bgGeo, bgMat);
  const fill = new Mesh(fillGeo, fillMat);
  fill.position.z = 0.004;
  bg.renderOrder = 3;
  fill.renderOrder = 4;
  group.add(bg, fill);
  return { group, fill, fillMat, width };
}

function syncHealthBar(enemy: EnemyActor) {
  const ratio = enemy.maxHp > 0 ? Math.max(0, Math.min(1, enemy.hp / enemy.maxHp)) : 0;
  enemy.hpFill.scale.x = Math.max(ratio, 0.001);
  enemy.hpFill.position.x = (ratio - 1) * enemy.hpWidth * 0.5;
  enemy.hpFillMat.color.set(ratio > 0.55 ? "#b6ff4a" : ratio > 0.28 ? "#ffd24a" : "#ff5a3c");
}

const barQuat = new Quaternion();

function billboardBar(bar: Object3D, camera: Object3D) {
  bar.quaternion.copy(camera.quaternion);
  const parent = bar.parent;
  if (!parent) return;
  parent.getWorldQuaternion(barQuat);
  bar.quaternion.premultiply(barQuat.invert());
}

function paintEnemy(object: Group, kind: EnemyKind) {
  const mats: MeshStandardMaterial[] = [];
  object.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of list) {
      if (!(m instanceof MeshStandardMaterial)) continue;
      mats.push(m);
    }
  });
  applyEnemyPaint(mats, kind, 0);
  return mats;
}

function fallbackEnemy(tracker: ResourceTracker, kind: EnemyKind) {
  const g = new Group();
  const look = ENEMY_LOOK[kind];
  const h = kind === "imp" ? 0.55 : 0.72;
  const geo = new CylinderGeometry(0.22, 0.28, h, 8);
  const mat = new MeshStandardMaterial({ color: look.tint, roughness: look.roughness, metalness: 0 });
  tracker.track(geo);
  tracker.track(mat);
  const mesh = new Mesh(geo, mat);
  mesh.position.y = h / 2;
  g.add(mesh);
  return g;
}

function fallbackAmmo(tracker: ResourceTracker) {
  const g = new Group();
  const geo = new SphereGeometry(0.08, 8, 8);
  const mat = new MeshStandardMaterial({ color: "#e0b04a", roughness: 0.4, metalness: 0.2 });
  tracker.track(geo);
  tracker.track(mat);
  g.add(new Mesh(geo, mat));
  return g;
}

function createPadBeacon(tracker: ResourceTracker) {
  const group = new Group();
  const ringGeo = new RingGeometry(TILE_SIZE * 0.38, TILE_SIZE * 0.46, 40);
  const ringMat = new MeshBasicMaterial({
    color: "#ffffff",
    transparent: true,
    opacity: 1,
    depthWrite: false,
  });
  tracker.track(ringGeo);
  tracker.track(ringMat);
  const ring = new Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = TILE_TOP + 0.02;
  group.add(ring);
  return { group, ringMat };
}

function clonePart(source: Group | null, tracker: ResourceTracker, skinned: boolean) {
  if (!source) return null;
  try {
    return skinned ? cloneSkinnedModel(source, tracker) : cloneTexturedModel(source, tracker);
  } catch {
    return null;
  }
}

export function createTowerDefenseEngine(): Playable3DEngine {
  let host: ThreeHost | null = null;
  let sfx: AudioBus | null = null;
  let sfxOwned = false;
  let config: TowerDefenseConfig | null = null;
  let ctx: EngineInitContext | null = null;
  let root: Group | null = null;
  let started = false;
  let ended = false;
  let building = false;
  let buildGen = 0;
  let onWin: () => void = () => undefined;
  let onLose: () => void = () => undefined;
  let detach: (() => void) | null = null;
  let playAllRounds = true;
  let roundIndex = 0;
  let lastEditorRoundIndex: number | null = null;
  let earned = 0;
  let gold = 80;
  let lives = 8;
  let selected: TowerKind = "arrow";
  let waveTime = 0;
  let waveStarted = false;
  let thumbsReady = false;
  let spawnQueue: Array<{ kind: EnemyKind; at: number }> = [];
  let spawnIndex = 0;
  let enemySeq = 1;
  let pathLen = 1;
  let waypoints: Waypoint[] = [];
  let map: TdMap = buildTdMap(0);
  const pads: PadActor[] = [];
  const enemies: EnemyActor[] = [];
  const shots: Array<CombatShot & { mesh: Group }> = [];
  const templates: Record<string, Group | null> = {};
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const hud = createPayoutHud();
  const tdHud = createTdHud();
  let rangeDisc: Mesh | null = null;
  let pulseT = 0;

  function liveRound(cfg = config!) {
    const rounds = listTdRounds(cfg);
    const index = Math.max(0, Math.min(roundIndex, rounds.length - 1));
    return { round: rounds[index], index, total: rounds.length };
  }

  function statsFor(kind: TowerKind): TowerDefenseTowerStats {
    const st = config?.towers[kind] ?? emptyConfig().towers[kind];
    // Old manifests used a 2-unit grid; those ranges are twice the tile coverage we want.
    const range = st.range >= 2.5 ? st.range * 0.5 : st.range;
    return { ...st, range };
  }

  const TOWER_KINDS: TowerKind[] = ["arrow", "cannon", "turret"];

  function cheapestCost() {
    return Math.min(...TOWER_KINDS.map((kind) => statsFor(kind).cost));
  }

  /** Selected tower when it is affordable, otherwise the best one the player can buy. */
  function kindForGold(): TowerKind | null {
    if (gold >= statsFor(selected).cost) return selected;
    let best: TowerKind | null = null;
    for (const kind of TOWER_KINDS) {
      if (gold < statsFor(kind).cost) continue;
      if (!best || statsFor(kind).cost > statsFor(best).cost) best = kind;
    }
    return best;
  }

  function wireSfx(cfg: TowerDefenseConfig) {
    sfx?.setExtraUrls(tdSoundUrls(cfg, ctx?.assets ?? {}));
  }

  function playCue(id: string, throttleMs = 0) {
    sfx?.playSfx(id, {
      throttleMs,
      rate: 0.94 + Math.random() * 0.12,
    });
  }

  function onSfxUnlock() {
    void sfx?.unlock();
  }

  /** Frame the board so it fills the play area. Landscape keeps a strip on the right for the tower column. */
  function fitPortraitCamera() {
    if (!host || !ctx) return;
    host.applyCamera(ctx.camera, ctx.orientation, host.camera.aspect);
    const cam = host.camera;
    const target = ctx.camera.target;
    const pos = ctx.camera.position;
    const ox = pos.x - target.x;
    const oy = pos.y - target.y;
    const oz = pos.z - target.z;
    if (ox * ox + oy * oy + oz * oz < 0.01) return;
    const landscape = ctx.orientation === "landscape";
    const viewW = Math.max(1, host.canvas.clientWidth);
    const gutter = landscape ? (118 / viewW) * 2 : 0;
    const minX = -0.98;
    const maxX = landscape ? 1 - gutter - 0.02 : 0.98;
    const minY = landscape ? -0.9 : -0.7;
    const maxY = landscape ? 0.9 : 0.9;
    const hx = (MAP_COLS * TILE_SIZE) / 2;
    const hz = (MAP_ROWS * TILE_SIZE) / 2;
    if (root) root.rotation.y = landscape ? Math.PI / 2 : 0;
    const raw: Array<[number, number, number]> = [
      [-hx, 1.1, -hz],
      [hx, 1.1, -hz],
      [-hx, 0, hz],
      [hx, 0, hz],
    ];
    const corners = landscape
      ? raw.map(([x, y, z]): [number, number, number] => [z, y, -x])
      : raw;
    const probe = new Vector3();
    const place = (scale: number, dx = 0, dz = 0) => {
      cam.position.set(target.x + ox * scale + dx, target.y + oy * scale, target.z + oz * scale + dz);
      cam.lookAt(target.x + dx, target.y, target.z + dz);
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
    };
    const span = () => {
      let loX = Infinity;
      let hiX = -Infinity;
      let loY = Infinity;
      let hiY = -Infinity;
      for (const [x, y, z] of corners) {
        probe.set(x, y, z).project(cam);
        loX = Math.min(loX, probe.x);
        hiX = Math.max(hiX, probe.x);
        loY = Math.min(loY, probe.y);
        hiY = Math.max(hiY, probe.y);
      }
      return { loX, hiX, loY, hiY };
    };
    const sizeFits = (scale: number) => {
      place(scale, 0, 0);
      const box = span();
      return box.hiX - box.loX <= maxX - minX - 0.02 && box.hiY - box.loY <= maxY - minY - 0.02;
    };
    let lo = 0.25;
    let hi = 1.5;
    while (!sizeFits(hi) && hi < 8) hi *= 1.35;
    for (let step = 0; step < 16; step++) {
      const mid = (lo + hi) / 2;
      if (sizeFits(mid)) hi = mid;
      else lo = mid;
    }
    let dx = 0;
    if (landscape) {
      const aim = (minX + maxX) / 2;
      let a = -8;
      let b = 8;
      const centerAt = (shift: number) => {
        place(hi, shift);
        const box = span();
        return (box.loX + box.hiX) / 2;
      };
      const grows = centerAt(1) > centerAt(0);
      for (let step = 0; step < 18; step++) {
        const mid = (a + b) / 2;
        const center = centerAt(mid);
        if (center > aim) {
          if (grows) b = mid;
          else a = mid;
        } else if (grows) a = mid;
        else b = mid;
      }
      dx = (a + b) / 2;
    }
    place(hi, dx, 0);
  }

  function captureTowerThumbs() {
    if (thumbsReady || !host) return;
    const renderer = host.renderer;
    const size = 160;
    const rt = new WebGLRenderTarget(size, size);
    const scene = new Scene();
    scene.add(new HemisphereLight(0xf3ede0, 0x243040, 1.15));
    const sun = new DirectionalLight(0xffffff, 1.35);
    sun.position.set(2.5, 6, 3);
    scene.add(sun);
    const cam = new PerspectiveCamera(28, 1, 0.05, 40);
    const urls: Partial<Record<TowerKind, string>> = {};
    const prevTarget = renderer.getRenderTarget();
    const prevColor = new Color();
    renderer.getClearColor(prevColor);
    const prevAlpha = renderer.getClearAlpha();
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx2d = canvas.getContext("2d");
    const pixels = new Uint8Array(size * size * 4);
    try {
      if (!ctx2d) return;
      for (const kind of Object.keys(TOWER_RECIPES) as TowerKind[]) {
        const recipe = TOWER_RECIPES[kind];
        const group = new Group();
        for (const part of recipe.parts) {
          const piece = clonePart(templates[part], host.tracker, false);
          if (!piece) continue;
          seatOnGround(piece);
          group.add(piece);
        }
        const weapon = clonePart(templates[recipe.weapon], host.tracker, false);
        if (weapon) {
          const box = new Box3().setFromObject(group);
          weapon.position.y = Number.isFinite(box.max.y) ? box.max.y : 1.1;
          group.add(weapon);
        }
        if (group.children.length === 0) continue;
        scene.add(group);
        group.updateWorldMatrix(true, true);
        const box = new Box3().setFromObject(group);
        const center = box.getCenter(new Vector3());
        const dims = box.getSize(new Vector3());
        const span = Math.max(dims.x, dims.z, 0.4);
        const weaponY = box.max.y;
        cam.fov = 34;
        cam.position.set(center.x, weaponY + span * 1.05, center.z - span * 0.42);
        cam.lookAt(center.x, weaponY - span * 0.2, center.z);
        cam.updateProjectionMatrix();
        renderer.setRenderTarget(rt);
        renderer.setClearColor(0x000000, 0);
        renderer.clear();
        renderer.render(scene, cam);
        renderer.readRenderTargetPixels(rt, 0, 0, size, size, pixels);
        const image = ctx2d.createImageData(size, size);
        for (let y = 0; y < size; y++) {
          const src = (size - 1 - y) * size * 4;
          image.data.set(pixels.subarray(src, src + size * 4), y * size * 4);
        }
        ctx2d.putImageData(image, 0, 0);
        urls[kind] = canvas.toDataURL("image/png");
        scene.remove(group);
      }
      if (Object.keys(urls).length > 0) {
        thumbsReady = true;
        tdHud.setThumbs(urls);
      }
    } catch {
      thumbsReady = false;
    } finally {
      renderer.setRenderTarget(prevTarget);
      renderer.setClearColor(prevColor, prevAlpha);
      rt.dispose();
    }
  }

  function costs() {
    return {
      arrow: statsFor("arrow").cost,
      cannon: statsFor("cannon").cost,
      turret: statsFor("turret").cost,
    };
  }

  function tdKey(cfg: TowerDefenseConfig, idx: number, playAll: boolean) {
    return JSON.stringify({
      lives: cfg.lives,
      gold: cfg.startingGold,
      towers: cfg.towers,
      coin: cfg.coinImageUrl,
      rounds: listTdRounds(cfg),
      round: idx,
      playAll,
    });
  }

  function syncHud() {
    if (!config) return;
    const url = resolveRuntimeUrl(config.coinImageUrl || DEFAULT_COIN_URL, ctx?.assets ?? {});
    hud.setCoinUrl(url || DEFAULT_COIN_URL);
    hud.setState(earned, tdCoinsTotal(config));
    const placed = pads.some((p) => p.tower);
    tdHud.setState({
      lives,
      gold,
      selected,
      costs: costs(),
      coinUrl: url || DEFAULT_COIN_URL,
      canStart: placed && !waveStarted && !ended,
      hint: placed ? "" : "PICK A TOWER, TAP A GLOWING PAD",
    });
  }

  function finish(kind: "win" | "lose") {
    if (ended) return;
    ended = true;
    started = false;
    if (kind === "lose") hud.cancel();
    if (kind === "win") onWin();
    else onLose();
  }

  function showRange(x: number, z: number, range: number) {
    if (!rangeDisc) return;
    rangeDisc.visible = true;
    rangeDisc.position.set(x, 0.06, z);
    const s = range / 2;
    rangeDisc.scale.set(s, s, 1);
  }

  function hideRange() {
    if (rangeDisc) rangeDisc.visible = false;
  }

  function completeRound() {
    if (!config || hud.busy()) return;
    const { round, index, total } = liveRound();
    const reward = round.coins;
    const from = earned;
    earned += reward;
    const hasNext = playAllRounds && index < total - 1;
    hud.setState(earned, tdCoinsTotal(config));
    hud.startPayout({
      from,
      to: earned,
      reward,
      nextRound: hasNext ? index + 2 : null,
      onDone: (kind) => {
        if (kind === "next") {
          roundIndex = index + 1;
          beginWave(true);
          return;
        }
        finish("win");
      },
    });
  }

  function beginWave(keepTowers: boolean) {
    if (!config) return;
    const { round } = liveRound();
    waveTime = 0;
    waveStarted = false;
    spawnQueue = spawnWaveQueue(round.impCount, round.puglinCount, round.spawnInterval);
    spawnIndex = 0;
    for (const e of enemies) {
      e.group.removeFromParent();
      e.hpBar.removeFromParent();
    }
    enemies.length = 0;
    for (const s of shots) s.mesh.visible = false;
    ended = false;
    if (!keepTowers) {
      for (const pad of pads) {
        pad.tower = null;
        pad.towerGroup?.removeFromParent();
        pad.towerGroup = null;
        pad.weapon = null;
      }
      gold = config.startingGold;
      lives = config.lives;
    } else {
      gold += round.goldBonus;
      const floor = cheapestCost();
      if (gold < floor) gold = floor;
    }
    hideRange();
    syncHud();
  }

  function startWave() {
    if (!config || waveStarted || ended || hud.busy()) return;
    if (!pads.some((p) => p.tower)) return;
    waveStarted = true;
    waveTime = 0;
    playCue("wave");
    syncHud();
  }

  function placeTower(pad: PadActor, kind: TowerKind) {
    if (!host || !root || pad.tower) return false;
    const st = statsFor(kind);
    if (gold < st.cost) return false;
    gold -= st.cost;
    const recipe = TOWER_RECIPES[kind];
    const group = new Group();
    group.position.set(pad.x, TILE_TOP, pad.z);
    let built = false;
    for (const part of recipe.parts) {
      const piece = clonePart(templates[part], host.tracker, false);
      if (!piece) continue;
      seatOnGround(piece);
      group.add(piece);
      built = true;
    }
    if (!built) group.add(fallbackTower(host.tracker, recipe.color));
    let weapon: Group | null = clonePart(templates[recipe.weapon], host.tracker, false);
    if (weapon) {
      const box = new Box3().setFromObject(group);
      weapon.position.y = Number.isFinite(box.max.y) ? box.max.y : 1.1;
      weapon.name = "weapon";
      group.add(weapon);
    }
    const shadow = blobShadow(host.tracker, 0.45);
    shadow.position.y = 0.02;
    group.add(shadow);
    group.scale.setScalar(TOWER_SCALE);
    root.add(group);
    pad.towerGroup = group;
    pad.weapon = weapon;
    pad.tower = {
      kind,
      x: pad.x,
      z: pad.z,
      range: st.range,
      damage: st.damage,
      fireRate: st.fireRate,
      cooldown: 0.2,
      splash: recipe.splash,
      yaw: 0,
    };
    pad.marker.visible = false;
    showRange(pad.x, pad.z, st.range);
    playCue("place");
    syncHud();
    return true;
  }

  function spawnEnemy(kind: EnemyKind) {
    if (!host || !root || !config) return;
    const { round } = liveRound();
    const base = ENEMY_BASE[kind];
    const look = ENEMY_LOOK[kind];
    const modelId = ENEMY_MESH[kind][enemySeq % 2];
    const group = clonePart(templates[modelId], host.tracker, true) ?? fallbackEnemy(host.tracker, kind);
    const glowMats = paintEnemy(group, kind);
    fitObjectToMax(group, base.height);
    group.position.y = TILE_TOP;
    group.updateWorldMatrix(true, true);
    const fitted = new Box3().setFromObject(group);
    const headY = (Number.isFinite(fitted.max.y) ? fitted.max.y : base.height) + 0.12;
    const mixer = playEnemyClip(group);
    const shadow = blobShadow(host.tracker, look.shadowRadius, look.shadow);
    group.add(shadow);
    const barWidth = kind === "puglin" ? 0.78 : 0.62;
    const bar = enemyHealthBar(host.tracker, barWidth);
    const sample = samplePath(waypoints, 0);
    group.position.set(sample.x, TILE_TOP, sample.z);
    bar.group.position.set(sample.x, headY, sample.z);
    root.add(group);
    root.add(bar.group);
    const actor: EnemyActor = {
      id: enemySeq++,
      kind,
      dist: 0,
      hp: base.hp * round.hpScale,
      maxHp: base.hp * round.hpScale,
      speed: base.speed * round.speedScale,
      gold: base.gold,
      leak: base.leak,
      x: sample.x,
      z: sample.z,
      tx: sample.tx,
      tz: sample.tz,
      alive: true,
      dying: 0,
      group,
      glowMats,
      hitFlash: 0,
      mixer,
      baseScale: { x: group.scale.x, y: group.scale.y, z: group.scale.z },
      fell: false,
      headY,
      hpBar: bar.group,
      hpFill: bar.fill,
      hpFillMat: bar.fillMat,
      hpWidth: bar.width,
    };
    syncHealthBar(actor);
    enemies.push(actor);
  }

  function obtainShot(ammo: string) {
    const idle = shots.find((s) => !s.alive);
    if (idle) {
      idle.ammo = ammo;
      idle.alive = true;
      idle.mesh.visible = true;
      return idle;
    }
    if (!host || !root) return null;
    const mesh = clonePart(templates[ammo], host.tracker, false) ?? fallbackAmmo(host.tracker);
    fitObjectToMax(mesh, 0.28);
    root.add(mesh);
    const shot: CombatShot & { mesh: Group } = {
      x: 0,
      z: 0,
      y: 1,
      vx: 0,
      vz: 1,
      speed: SHOT_SPEED,
      damage: 1,
      splash: 0,
      targetId: -1,
      ammo,
      alive: true,
      mesh,
    };
    shots.push(shot);
    return shot;
  }

  function hitEnemy(enemy: EnemyActor, damage: number) {
    if (!enemy.alive || enemy.dying > 0) return;
    enemy.hp -= damage;
    if (enemy.hp > 0) {
      enemy.hitFlash = HIT_FLASH;
      playCue("hit", 90);
      return;
    }
    enemy.hpBar.removeFromParent();
    enemy.dying = 0.001;
    gold += enemy.gold;
    playCue("death", 50);
    syncHud();
  }

  function applySplash(x: number, z: number, damage: number, radius: number) {
    const r2 = radius * radius;
    for (const e of enemies) {
      if (!e.alive || e.dying > 0) continue;
      const dx = e.x - x;
      const dz = e.z - z;
      if (dx * dx + dz * dz <= r2) hitEnemy(e, damage);
    }
  }

  function fire(pad: PadActor, target: CombatEnemy) {
    if (!pad.tower) return;
    const recipe = TOWER_RECIPES[pad.tower.kind];
    const shot = obtainShot(recipe.ammo);
    if (!shot) return;
    let muzzleY = 1.15 * TOWER_SCALE;
    if (pad.weapon) {
      pad.weapon.getWorldPosition(_muzzle);
      muzzleY = _muzzle.y;
    }
    shot.x = pad.x;
    shot.z = pad.z;
    shot.y = muzzleY;
    shot.damage = pad.tower.damage;
    shot.splash = pad.tower.splash;
    shot.targetId = target.id;
    const dx = target.x - pad.x;
    const dz = target.z - pad.z;
    const mag = Math.hypot(dx, dz) || 1;
    shot.vx = dx / mag;
    shot.vz = dz / mag;
    shot.mesh.position.set(shot.x, shot.y, shot.z);
    shot.mesh.visible = true;
    pad.tower.yaw = Math.atan2(dx, dz);
    if (pad.weapon) pad.weapon.rotation.y = pad.tower.yaw;
    playCue(FIRE_SFX[pad.tower.kind], FIRE_GAP[pad.tower.kind]);
  }

  function tickCombat(dt: number) {
    if (!config || ended || hud.busy()) return;
    if (!waveStarted) return;

    waveTime += dt;
    while (spawnIndex < spawnQueue.length && spawnQueue[spawnIndex].at <= waveTime) {
      spawnEnemy(spawnQueue[spawnIndex].kind);
      spawnIndex += 1;
    }

    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      if (enemy.dying > 0) {
        if (!enemy.fell && enemy.mixer) {
          enemy.fell = true;
          playNamedClip(enemy.group, enemy.mixer, "Death", false);
          enemy.mixer.timeScale = 1.6;
        }
        enemy.hpBar.removeFromParent();
        enemy.dying += dt;
        const u = Math.min(1, enemy.dying / 0.7);
        enemy.mixer?.update(dt);
        if (!enemy.mixer) {
          enemy.group.scale.y = enemy.baseScale.y * (1 - u * 0.85);
          enemy.group.position.y = TILE_TOP - u * 0.35;
        }
        if (u >= 1) {
          enemy.alive = false;
          enemy.group.visible = false;
        }
        continue;
      }
      if (enemy.hitFlash > 0) {
        enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
        applyEnemyPaint(enemy.glowMats, enemy.kind, enemy.hitFlash / HIT_FLASH);
      }
      enemy.dist += enemy.speed * dt;
      const sample = samplePath(waypoints, enemy.dist);
      enemy.x = sample.x;
      enemy.z = sample.z;
      enemy.tx = sample.tx;
      enemy.tz = sample.tz;
      enemy.group.position.x = sample.x;
      enemy.group.position.z = sample.z;
      enemy.group.rotation.y = Math.atan2(sample.tx, sample.tz);
      syncHealthBar(enemy);
      enemy.hpBar.position.set(enemy.group.position.x, enemy.group.position.y + enemy.headY, enemy.group.position.z);
      if (host) billboardBar(enemy.hpBar, host.camera);
      if (enemy.mixer) {
        enemy.mixer.timeScale = 0.85 + enemy.speed * 0.28;
        enemy.mixer.update(dt);
        enemy.group.position.y = TILE_TOP;
      } else {
        const bob = Math.abs(Math.sin(waveTime * (5.4 + enemy.speed * 1.5) + enemy.id));
        enemy.group.position.y = TILE_TOP + bob * 0.11;
        enemy.group.scale.set(
          enemy.baseScale.x * (1 + bob * 0.05),
          enemy.baseScale.y * (1 - bob * 0.1),
          enemy.baseScale.z * (1 + bob * 0.05),
        );
      }
      if (sample.leaked || enemy.dist >= pathLen) {
        enemy.alive = false;
        enemy.group.visible = false;
        enemy.hpBar.removeFromParent();
        lives = Math.max(0, lives - enemy.leak);
        playCue("leak", 80);
        syncHud();
        if (lives <= 0) {
          finish("lose");
          return;
        }
      }
    }

    for (const pad of pads) {
      const tower = pad.tower;
      if (!tower) continue;
      tower.cooldown -= dt;
      const target = firstInRange(enemies, tower);
      if (target) {
        const yaw = Math.atan2(target.x - tower.x, target.z - tower.z);
        tower.yaw = yaw;
        if (pad.weapon) pad.weapon.rotation.y = yaw;
        if (tower.cooldown <= 0) {
          fire(pad, target);
          tower.cooldown = 1 / Math.max(0.2, tower.fireRate);
        }
      }
    }

    for (const shot of shots) {
      if (!shot.alive) continue;
      const target = enemies.find((e) => e.id === shot.targetId && e.alive && e.dying <= 0);
      if (target) {
        const dx = target.x - shot.x;
        const dz = target.z - shot.z;
        const mag = Math.hypot(dx, dz) || 1;
        shot.vx = dx / mag;
        shot.vz = dz / mag;
      }
      shot.x += shot.vx * shot.speed * dt;
      shot.z += shot.vz * shot.speed * dt;
      if (target) shot.y += (0.4 - shot.y) * Math.min(1, dt * 7);
      shot.mesh.position.set(shot.x, shot.y, shot.z);
      shot.mesh.rotation.y = Math.atan2(shot.vx, shot.vz);
      let hit = false;
      if (target) {
        const dist = Math.hypot(target.x - shot.x, target.z - shot.z);
        if (dist < 0.35) hit = true;
      } else if (!target) {
        shot.y -= dt * 4;
        if (shot.y < 0.05) hit = true;
      }
      if (hit) {
        shot.alive = false;
        shot.mesh.visible = false;
        if (target) {
          if (shot.splash > 0) applySplash(target.x, target.z, shot.damage, shot.splash);
          else hitEnemy(target, shot.damage);
        }
      }
    }

    const remaining =
      spawnIndex < spawnQueue.length || enemies.some((e) => e.alive && e.dying <= 0);
    if (!remaining && spawnQueue.length > 0) completeRound();
  }

  function pickPad(ndcX: number, ndcY: number) {
    if (!host) return null;
    pointer.set(ndcX, ndcY);
    raycaster.setFromCamera(pointer, host.camera);
    const hits = raycaster.intersectObjects(
      pads.map((p) => p.hit),
      false,
    );
    const id = hits[0]?.object.id;
    if (id == null) return null;
    return pads.find((p) => p.hit.id === id) ?? null;
  }

  async function rebuild(keepProgress = false) {
    if (!host || !config || !root) return;
    const gen = ++buildGen;
    building = true;
    try {
      const assets = ctx?.assets ?? {};
      setRuntimeAssets(assets);
      const needed = new Set<string>([
        ...Object.keys(LIBRARY_TD_URLS),
        ...Object.keys(LIBRARY_BESTIARY_URLS),
      ]);
      await Promise.all(
        [...needed].map(async (id) => {
          const url = resolveRuntimeUrl(
            LIBRARY_TD_URLS[id] || LIBRARY_BESTIARY_URLS[id] || id,
            assets,
          );
          templates[id] = await loadTemplate(url);
        }),
      );
      if (gen !== buildGen || !host || !root) return;

      while (root.children.length) root.remove(root.children[0]);
      pads.length = 0;
      enemies.length = 0;
      shots.length = 0;
      map = buildTdMap(roundIndex);
      waypoints = pathWaypoints(map);
      pathLen = polylineLength(waypoints);

      for (const cell of map.cells) {
        const { x, z } = cellToWorld(cell.col, cell.row);
        const fallbackColor = cell.kind === "river" ? "#8fd4ea" : cell.kind === "grass" || cell.kind === "build" ? "#3dba9a" : "#c4845a";
        const model = clonePart(templates[cell.model], host.tracker, false) ?? fallbackTile(host.tracker, fallbackColor);
        model.position.set(x, cell.y ?? 0, z);
        model.rotation.y = cell.rot * (Math.PI / 2);
        flatColors(model);
        dressPiece(model, cell.model);
        root.add(model);
        if (cell.support) {
          const base = clonePart(templates[cell.support.model], host.tracker, false);
          if (base) {
            base.position.set(x, 0, z);
            base.rotation.y = cell.support.rot * (Math.PI / 2);
            flatColors(base);
            root.add(base);
          }
        }
        if (cell.kind === "end") {
          const crystal = clonePart(templates["tile-crystal"], host.tracker, false);
          if (crystal) {
            crystal.position.set(x, 0, z);
            crystal.scale.setScalar(0.55);
            flatColors(crystal);
            seatOnGround(crystal);
            crystal.position.y += TILE_TOP;
            root.add(crystal);
          }
        }
      }

      for (const prop of map.props) {
        const { x, z } = cellToWorld(prop.col, prop.row);
        const piece = clonePart(templates[prop.model], host.tracker, false);
        if (!piece) continue;
        piece.position.set(x + (prop.ox ?? 0), prop.y ?? 0, z + (prop.oz ?? 0));
        piece.rotation.y = prop.rot * (Math.PI / 2);
        if (prop.model === "cliff-waterfall" || prop.model === "cliff-waterfall-top") {
          const face = [
            { x: 0, z: 1 },
            { x: 1, z: 0 },
            { x: 0, z: -1 },
            { x: -1, z: 0 },
          ][((prop.rot % 4) + 4) % 4];
          piece.position.x += face.x * 0.03;
          piece.position.z += face.z * 0.03;
        }
        piece.scale.setScalar(prop.scale);
        flatColors(piece);
        dressPiece(piece, prop.model);
        root.add(piece);
      }

      const ringGeo = new RingGeometry(1.85, 2.02, 32);
      const ringMat = new MeshBasicMaterial({
        color: "#e07a3d",
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      });
      host.tracker.track(ringGeo);
      host.tracker.track(ringMat);
      rangeDisc = new Mesh(ringGeo, ringMat);
      rangeDisc.rotation.x = -Math.PI / 2;
      rangeDisc.visible = false;
      root.add(rangeDisc);

      for (const spec of map.pads) {
        const { x, z } = cellToWorld(spec.col, spec.row);
        const beacon = createPadBeacon(host.tracker);
        beacon.group.position.set(x, 0, z);
        root.add(beacon.group);
        const hitGeo = new CircleGeometry(TILE_SIZE * 0.48, 16);
        const hitMat = new MeshBasicMaterial({ visible: false });
        host.tracker.track(hitGeo);
        host.tracker.track(hitMat);
        const hit = new Mesh(hitGeo, hitMat);
        hit.rotation.x = -Math.PI / 2;
        hit.position.set(x, TILE_TOP + 0.04, z);
        root.add(hit);
        pads.push({
          col: spec.col,
          row: spec.row,
          x,
          z,
          hit,
          marker: beacon.group,
          ringMat: beacon.ringMat,
          tower: null,
          towerGroup: null,
          weapon: null,
        });
      }

      beginWave(keepProgress);
      captureTowerThumbs();
      fitPortraitCamera();
    } finally {
      if (gen === buildGen) building = false;
    }
  }

  return {
    id: "tower-defense",
    name: "Tower Defense",
    initialize(init) {
      ctx = init;
      setRuntimeAssets(init.assets || {});
      const extra = init as EngineInitContext & {
        towerDefense?: TowerDefenseConfig;
        playAllRounds?: boolean;
        parkingRoundIndex?: number;
        audioBus?: AudioBus;
      };
      config = extra.towerDefense ?? emptyConfig();
      playAllRounds = extra.playAllRounds !== false;
      roundIndex = typeof extra.parkingRoundIndex === "number" ? extra.parkingRoundIndex : 0;
      roundIndex = Math.max(0, Math.min(roundIndex, listTdRounds(config).length - 1));
      lastEditorRoundIndex = roundIndex;
      earned = 0;
      selected = "arrow";
      if (extra.audioBus) {
        sfx = extra.audioBus;
        sfxOwned = false;
      } else {
        sfx = new AudioBus();
        sfxOwned = true;
      }
      wireSfx(config);
      init.container.addEventListener("pointerdown", onSfxUnlock, true);
      host = new ThreeHost(init.container);
      host.applyLighting(init.lighting);
      fitPortraitCamera();
      root = new Group();
      host.scene.add(root);
      hud.mount(init.container);
      tdHud.mount(init.container);
      tdHud.setOrientation(init.orientation);
      tdHud.onSelect((kind) => {
        selected = kind;
        syncHud();
      });
      tdHud.onStart(() => startWave());
      syncHud();
      void rebuild();
      detach = attachPointer(host.canvas, (e) => {
        void sfx?.unlock();
        if (!started || ended || hud.busy() || building) return;
        if (e.kind !== "tap") return;
        const pad = pickPad(e.ndcX, e.ndcY);
        if (!pad) {
          hideRange();
          return;
        }
        if (pad.tower) {
          showRange(pad.x, pad.z, pad.tower.range);
          return;
        }
        const kind = kindForGold();
        if (!kind) return;
        if (kind !== selected) {
          selected = kind;
          syncHud();
        }
        placeTower(pad, kind);
      });
    },
    start() {
      started = true;
      host?.start((dt) => {
        pulseT += dt;
        const canPlace = kindForGold() != null && !ended;
        const beat = 0.5 + 0.5 * Math.sin(pulseT * 5);
        for (const pad of pads) {
          if (pad.tower || !canPlace) {
            pad.marker.visible = false;
            continue;
          }
          pad.marker.visible = true;
          pad.ringMat.opacity = 0.55 + beat * 0.45;
          pad.marker.scale.setScalar(1);
        }
        tickCombat(dt);
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
      void rebuild();
    },
    destroy() {
      detach?.();
      ctx?.container.removeEventListener("pointerdown", onSfxUnlock, true);
      tdHud.destroy();
      hud.destroy();
      if (sfxOwned) sfx?.destroy();
      sfx = null;
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
      const next = options.towerDefense as TowerDefenseConfig | undefined;
      const prevKey = config ? tdKey(config, roundIndex, playAllRounds) : "";
      if (next) {
        config = next;
        wireSfx(next);
      }
      if (typeof options.playAllRounds === "boolean") playAllRounds = options.playAllRounds;
      if (typeof options.parkingRoundIndex === "number" && config) {
        const n = listTdRounds(config).length;
        const nextIdx = Math.max(0, Math.min(Math.floor(options.parkingRoundIndex), n - 1));
        if (lastEditorRoundIndex !== null && nextIdx !== lastEditorRoundIndex) {
          hud.cancel();
          earned = 0;
          roundIndex = nextIdx;
        }
        lastEditorRoundIndex = nextIdx;
      }
      if (config) {
        const nextKey = tdKey(config, roundIndex, playAllRounds);
        if (!prevKey || prevKey !== nextKey) void rebuild();
        else syncHud();
      }
      if (ctx) {
        applyLivePresentation(host, options, ctx);
        fitPortraitCamera();
        tdHud.setOrientation(ctx.orientation);
      }
    },
    resize(w, h) {
      host?.resize(w, h);
      fitPortraitCamera();
      hud.resize();
    },
  };
}
