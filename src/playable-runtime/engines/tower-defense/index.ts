import {
  AdditiveBlending,
  AnimationClip,
  AnimationMixer,
  Box3,
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  Group,
  LoopRepeat,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Raycaster,
  RingGeometry,
  SphereGeometry,
  Vector2,
} from "three";
import type { TowerDefenseConfig, TowerDefenseTowerStats } from "@/types/project";
import type { EngineInitContext, Playable3DEngine } from "@/playable-runtime/engines/types";
import { AudioBus } from "@/playable-runtime/audio/bus";
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
import { buildDefaultMap, cellToWorld, pathWaypoints, TILE_SIZE, type TdMap } from "@/playable-runtime/engines/tower-defense/map";
import {
  ENEMY_BASE,
  ENEMY_LOOK,
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
  discMat: MeshBasicMaterial;
  ringMat: MeshBasicMaterial;
  tower: CombatTower | null;
  towerGroup: Group | null;
  weapon: Group | null;
};

/** Kenney tile slabs are 0.2 tall; markers must sit on the top face, not at y=0. */
const TILE_TOP = 0.22;

type EnemyActor = CombatEnemy & {
  group: Group;
  glowMats: MeshStandardMaterial[];
  hitFlash: number;
  mixer: AnimationMixer | null;
  baseScale: { x: number; y: number; z: number };
};

const WAVE_WAIT = 3;
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
    arrowFire: pick(s.arrowFireUrl),
    cannonFire: pick(s.cannonFireUrl),
    turretFire: pick(s.turretFireUrl),
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
        window.setTimeout(() => reject(new Error("gltf timeout")), 8000);
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
    if (m.emissiveMap) {
      m.emissive.set("#ffffff");
      m.emissiveIntensity = look.glow + flashU * 1.8;
    } else {
      m.emissive.set("#ffffff");
      m.emissiveIntensity = 0.08 + flashU * 1.1;
    }
    m.roughness = Math.min(m.roughness, look.roughness);
    m.metalness = 0;
    m.metalnessMap = null;
    m.needsUpdate = true;
  }
}

function playEnemyClip(group: Group) {
  const clips = group.userData.clips as AnimationClip[] | undefined;
  if (!clips?.length) return null;
  const root = (group.userData.mixerRoot as Object3D | undefined) ?? group;
  const mixer = new AnimationMixer(root);
  const clip = clips.find((c) => /walk|run|move|locomotion/i.test(c.name)) ?? clips[0];
  if (!clip) return null;
  const action = mixer.clipAction(clip);
  action.setLoop(LoopRepeat, Infinity);
  action.play();
  return mixer;
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
  const h = kind === "imp" ? 0.85 : 1.1;
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
  const discGeo = new CircleGeometry(TILE_SIZE * 0.44, 28);
  const discMat = new MeshBasicMaterial({
    color: "#ffe14a",
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  tracker.track(discGeo);
  tracker.track(discMat);
  const disc = new Mesh(discGeo, discMat);
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = TILE_TOP;
  group.add(disc);

  const ringGeo = new RingGeometry(TILE_SIZE * 0.36, TILE_SIZE * 0.48, 32);
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
  ring.position.y = TILE_TOP + 0.014;
  group.add(ring);

  return { group, discMat, ringMat };
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
  let spawnQueue: Array<{ kind: EnemyKind; at: number }> = [];
  let spawnIndex = 0;
  let enemySeq = 1;
  let pathLen = 1;
  let waypoints: Waypoint[] = [];
  let map: TdMap = buildDefaultMap();
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
    for (const e of enemies) e.group.removeFromParent();
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
    }
    hideRange();
    syncHud();
  }

  function placeTower(pad: PadActor, kind: TowerKind) {
    if (!host || !root || pad.tower) return false;
    const st = statsFor(kind);
    if (gold < st.cost) return false;
    gold -= st.cost;
    const recipe = TOWER_RECIPES[kind];
    const group = new Group();
    group.position.set(pad.x, 0, pad.z);
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
    const group = clonePart(templates[kind], host.tracker, true) ?? fallbackEnemy(host.tracker, kind);
    const glowMats = paintEnemy(group, kind);
    fitObjectToMax(group, base.height);
    seatOnGround(group);
    const mixer = playEnemyClip(group);
    const shadow = blobShadow(host.tracker, look.shadowRadius, look.shadow);
    group.add(shadow);
    const sample = samplePath(waypoints, 0);
    group.position.set(sample.x, 0, sample.z);
    root.add(group);
    enemies.push({
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
    });
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
    const muzzleY = pad.weapon ? pad.weapon.position.y + 0.15 : 1.1;
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
    if (!waveStarted) {
      waveTime += dt;
      if (pads.some((p) => p.tower) || waveTime >= WAVE_WAIT) {
        waveStarted = true;
        waveTime = 0;
        playCue("wave");
        syncHud();
      } else {
        return;
      }
    }

    waveTime += dt;
    while (spawnIndex < spawnQueue.length && spawnQueue[spawnIndex].at <= waveTime) {
      spawnEnemy(spawnQueue[spawnIndex].kind);
      spawnIndex += 1;
    }

    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      if (enemy.dying > 0) {
        enemy.dying += dt;
        const u = Math.min(1, enemy.dying / 0.28);
        enemy.mixer?.update(dt);
        enemy.group.scale.y = enemy.baseScale.y * (1 - u * 0.85);
        enemy.group.position.y = -u * 0.2;
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
      if (enemy.mixer) {
        enemy.mixer.timeScale = 0.85 + enemy.speed * 0.28;
        enemy.mixer.update(dt);
        enemy.group.position.y = 0;
      } else {
        const bob = Math.abs(Math.sin(waveTime * (5.4 + enemy.speed * 1.5) + enemy.id));
        enemy.group.position.y = bob * 0.11;
        enemy.group.scale.set(
          enemy.baseScale.x * (1 + bob * 0.05),
          enemy.baseScale.y * (1 - bob * 0.1),
          enemy.baseScale.z * (1 + bob * 0.05),
        );
      }
      if (sample.leaked || enemy.dist >= pathLen) {
        enemy.alive = false;
        enemy.group.visible = false;
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

  async function rebuild() {
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
      map = buildDefaultMap();
      waypoints = pathWaypoints(map);
      pathLen = polylineLength(waypoints);

      for (const cell of map.cells) {
        const { x, z } = cellToWorld(cell.col, cell.row);
        const model = clonePart(templates[cell.model], host.tracker, false) ?? fallbackTile(host.tracker, cell.kind === "grass" || cell.kind === "build" ? "#5a8f3a" : "#7a5a32");
        model.position.set(x, 0, z);
        model.rotation.y = cell.rot * (Math.PI / 2);
        seatOnGround(model);
        root.add(model);
        if (cell.kind === "spawn") {
          const spawn = clonePart(templates["spawn-round"], host.tracker, false);
          if (spawn) {
            spawn.position.set(x, 0.02, z);
            seatOnGround(spawn);
            root.add(spawn);
          }
        }
        if (cell.kind === "end") {
          const crystal = clonePart(templates["tile-crystal"], host.tracker, false);
          if (crystal) {
            crystal.position.set(x, 0.02, z);
            crystal.scale.setScalar(0.85);
            seatOnGround(crystal);
            root.add(crystal);
          }
        }
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
          discMat: beacon.discMat,
          ringMat: beacon.ringMat,
          tower: null,
          towerGroup: null,
          weapon: null,
        });
      }

      beginWave(false);
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
      host.applyCamera(init.camera, init.orientation, host.camera.aspect);
      root = new Group();
      host.scene.add(root);
      hud.mount(init.container);
      tdHud.mount(init.container);
      tdHud.onSelect((kind) => {
        selected = kind;
        syncHud();
      });
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
        placeTower(pad, selected);
      });
    },
    start() {
      started = true;
      host?.start((dt) => {
        pulseT += dt;
        const firstEmpty = pads.find((p) => !p.tower);
        const beat = 0.5 + 0.5 * Math.sin(pulseT * 5);
        for (const pad of pads) {
          if (pad.tower) {
            pad.marker.visible = false;
            continue;
          }
          pad.marker.visible = true;
          const strong = pad === firstEmpty;
          pad.discMat.opacity = strong ? 0.5 + beat * 0.45 : 0.42;
          pad.ringMat.opacity = strong ? 0.6 + beat * 0.4 : 0.55;
          pad.marker.scale.setScalar(strong ? 1 + beat * 0.16 : 1);
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
      if (ctx) applyLivePresentation(host, options, ctx);
    },
    resize(w, h) {
      host?.resize(w, h);
      hud.resize();
    },
  };
}
