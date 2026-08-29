export type EnemyKind = "imp" | "puglin";
export type TowerKind = "arrow" | "cannon" | "turret";

export type Waypoint = { x: number; z: number };

export const ENEMY_BASE = {
  imp: { hp: 14, speed: 1.85, gold: 8, leak: 1, height: 1.2 },
  puglin: { hp: 42, speed: 1.05, gold: 18, leak: 2, height: 1.5 },
} as const;

/** Keep kit albedo; glow is the packed emissive map (eyes/mouth). Exposure lifts overcast. */
export const ENEMY_LOOK = {
  imp: {
    tint: "#ff6a38",
    glow: 1.25,
    exposure: 1.28,
    roughness: 0.45,
    shadow: "#5a1808",
    shadowRadius: 0.32,
  },
  puglin: {
    tint: "#7dff5a",
    glow: 1.15,
    exposure: 1.22,
    roughness: 0.45,
    shadow: "#0a2e08",
    shadowRadius: 0.42,
  },
} as const;

export const TOWER_RECIPES: Record<TowerKind, { parts: string[]; weapon: string; ammo: string; splash: number; color: string; label: string }> = {
  arrow: {
    parts: ["tower-round-bottom-a", "tower-round-top-a"],
    weapon: "weapon-ballista",
    ammo: "weapon-ammo-arrow",
    splash: 0,
    color: "#e07a3d",
    label: "Arrow",
  },
  cannon: {
    parts: ["tower-square-bottom-a", "tower-square-top-a"],
    weapon: "weapon-cannon",
    ammo: "weapon-ammo-cannonball",
    splash: 0.75,
    color: "#2bb5a0",
    label: "Cannon",
  },
  turret: {
    parts: ["tower-round-bottom-a", "tower-round-middle-a"],
    weapon: "weapon-turret",
    ammo: "weapon-ammo-bullet",
    splash: 0,
    color: "#7c5cff",
    label: "Turret",
  },
};

export function polylineLength(points: Waypoint[]) {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
  }
  return Math.max(len, 0.001);
}

export function samplePath(points: Waypoint[], distance: number) {
  if (points.length === 0) return { x: 0, z: 0, tx: 1, tz: 0, leaked: true };
  if (distance <= 0) {
    const a = points[0];
    const b = points[1] ?? a;
    const tx = b.x - a.x;
    const tz = b.z - a.z;
    const mag = Math.hypot(tx, tz) || 1;
    return { x: a.x, z: a.z, tx: tx / mag, tz: tz / mag, leaked: false };
  }
  let left = distance;
  for (let i = 1; i < points.length; i++) {
    const ax = points[i - 1].x;
    const az = points[i - 1].z;
    const bx = points[i].x;
    const bz = points[i].z;
    const seg = Math.hypot(bx - ax, bz - az) || 0.0001;
    if (left <= seg) {
      const u = left / seg;
      const tx = (bx - ax) / seg;
      const tz = (bz - az) / seg;
      return { x: ax + (bx - ax) * u, z: az + (bz - az) * u, tx, tz, leaked: false };
    }
    left -= seg;
  }
  const last = points[points.length - 1];
  const prev = points[points.length - 2] ?? last;
  const tx = last.x - prev.x;
  const tz = last.z - prev.z;
  const mag = Math.hypot(tx, tz) || 1;
  return { x: last.x, z: last.z, tx: tx / mag, tz: tz / mag, leaked: true };
}

export type CombatEnemy = {
  id: number;
  kind: EnemyKind;
  dist: number;
  hp: number;
  maxHp: number;
  speed: number;
  gold: number;
  leak: number;
  x: number;
  z: number;
  tx: number;
  tz: number;
  alive: boolean;
  dying: number;
};

export type CombatTower = {
  kind: TowerKind;
  x: number;
  z: number;
  range: number;
  damage: number;
  fireRate: number;
  cooldown: number;
  splash: number;
  yaw: number;
};

export type CombatShot = {
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
  speed: number;
  damage: number;
  splash: number;
  targetId: number;
  ammo: string;
  alive: boolean;
};

export function firstInRange(enemies: CombatEnemy[], tower: CombatTower) {
  let best: CombatEnemy | null = null;
  let bestDist = -1;
  const r2 = tower.range * tower.range;
  for (const e of enemies) {
    if (!e.alive || e.dying > 0) continue;
    const dx = e.x - tower.x;
    const dz = e.z - tower.z;
    if (dx * dx + dz * dz > r2) continue;
    if (e.dist > bestDist) {
      best = e;
      bestDist = e.dist;
    }
  }
  return best;
}

export function spawnWaveQueue(
  impCount: number,
  puglinCount: number,
  interval: number,
): Array<{ kind: EnemyKind; at: number }> {
  const queue: Array<{ kind: EnemyKind; at: number }> = [];
  let t = 0.35;
  for (let i = 0; i < impCount; i++) {
    queue.push({ kind: "imp", at: t });
    t += interval;
  }
  for (let i = 0; i < puglinCount; i++) {
    queue.push({ kind: "puglin", at: t });
    t += interval * 1.15;
  }
  return queue;
}
