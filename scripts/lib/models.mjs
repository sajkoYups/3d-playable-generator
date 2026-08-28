/**
 * Definitions for the curated model library.
 *
 * Each model is a handful of primitives merged by colour. Silhouette carries
 * far more recognizability than detail at playable scale — an item is often
 * 120 px tall on screen — so these lean on shape and colour rather than
 * geometry the player will never see.
 */
import {
  box,
  cone,
  cylinder,
  extrude,
  mergeByMaterial,
  normalize,
  sphere,
  starOutline,
  torus,
  transform,
} from "./mesh.mjs";

const DEG = Math.PI / 180;

const STEM = "#6b4a2f";
const LEAF = "#4caf50";

function part(geometry, color, options = {}) {
  return { geometry, color, ...options };
}

/** Stem plus leaf, shared by every fruit so they read as a set. */
function topper(y, { stem = STEM, leaf = LEAF, scale = 1 } = {}) {
  return [
    part(
      transform(cylinder(0.03 * scale, 0.04 * scale, 0.18 * scale, 6), {
        t: [0, y + 0.08 * scale, 0],
        r: [0, 0, -8 * DEG],
      }),
      stem,
      { roughness: 0.9 },
    ),
    part(
      transform(sphere(0.12 * scale, 8, 6, 0.28), {
        t: [0.12 * scale, y + 0.12 * scale, 0],
        r: [0, 0, 22 * DEG],
        s: [1.5, 1, 0.8],
      }),
      leaf,
      { roughness: 0.8 },
    ),
  ];
}

export const MODELS = {
  "match/apple": () =>
    normalize(
      mergeByMaterial([
        part(transform(sphere(0.5, 16, 12, 0.92), { t: [0, 0.5, 0] }), "#e53935", {
          roughness: 0.35,
        }),
        ...topper(0.9),
      ]),
    ),

  "match/orange": () =>
    normalize(
      mergeByMaterial([
        part(transform(sphere(0.5, 16, 12, 0.95), { t: [0, 0.5, 0] }), "#fb8c00", {
          roughness: 0.65,
        }),
        ...topper(0.92, { scale: 0.8 }),
      ]),
    ),

  "match/lemon": () =>
    normalize(
      mergeByMaterial([
        part(
          transform(sphere(0.42, 14, 11, 1.25), { t: [0, 0.55, 0], r: [0, 0, 12 * DEG] }),
          "#fdd835",
          { roughness: 0.45 },
        ),
        // The nub at each end is what separates a lemon from a yellow ball.
        part(transform(cone(0.09, 0.14, 8), { t: [0.1, 1.1, 0] }), "#fdd835", {
          roughness: 0.45,
        }),
        part(
          transform(cone(0.09, 0.14, 8), { t: [-0.1, 0.02, 0], r: [Math.PI, 0, 0] }),
          "#fdd835",
          { roughness: 0.45 },
        ),
      ]),
    ),

  "match/pear": () =>
    normalize(
      mergeByMaterial([
        part(transform(sphere(0.46, 14, 11, 0.95), { t: [0, 0.46, 0] }), "#9ccc65", {
          roughness: 0.45,
        }),
        part(transform(sphere(0.31, 14, 10, 1.1), { t: [0, 0.95, 0] }), "#9ccc65", {
          roughness: 0.45,
        }),
        ...topper(1.2, { scale: 0.9 }),
      ]),
    ),

  "match/strawberry": () =>
    normalize(
      mergeByMaterial([
        part(transform(sphere(0.46, 14, 11, 1.05), { t: [0, 0.5, 0] }), "#e53935", {
          roughness: 0.4,
        }),
        part(transform(cone(0.4, 0.5, 12), { t: [0, 0.28, 0], r: [Math.PI, 0, 0] }), "#e53935", {
          roughness: 0.4,
        }),
        // Five leaves around the crown read as a calyx from any angle.
        ...Array.from({ length: 5 }, (_, i) =>
          part(
            transform(sphere(0.16, 6, 4, 0.2), {
              t: [
                Math.cos((i / 5) * Math.PI * 2) * 0.22,
                0.94,
                Math.sin((i / 5) * Math.PI * 2) * 0.22,
              ],
              r: [0, -(i / 5) * Math.PI * 2, 16 * DEG],
              s: [1.6, 1, 0.9],
            }),
            "#43a047",
            { roughness: 0.8 },
          ),
        ),
        part(transform(cylinder(0.035, 0.045, 0.16, 6), { t: [0, 1.02, 0] }), STEM, {
          roughness: 0.9,
        }),
      ]),
    ),

  "match/blueberry": () =>
    normalize(
      mergeByMaterial([
        part(transform(sphere(0.46, 14, 11, 0.88), { t: [0, 0.44, 0] }), "#3f51b5", {
          roughness: 0.4,
        }),
        part(transform(torus(0.15, 0.05, 10, 5), { t: [0, 0.82, 0], r: [90 * DEG, 0, 0] }), "#283593", {
          roughness: 0.6,
        }),
      ]),
    ),

  "match/grapes": () => {
    // Three rows of decreasing radius give the cluster its taper.
    const berries = [];
    const rows = [
      { y: 0.28, radius: 0.3, count: 6 },
      { y: 0.62, radius: 0.24, count: 5 },
      { y: 0.92, radius: 0.15, count: 3 },
    ];
    for (const row of rows) {
      for (let i = 0; i < row.count; i++) {
        const angle = (i / row.count) * Math.PI * 2 + row.y;
        berries.push(
          part(
            transform(sphere(0.21, 8, 5), {
              t: [Math.cos(angle) * row.radius, row.y, Math.sin(angle) * row.radius],
            }),
            "#7e57c2",
            { roughness: 0.4 },
          ),
        );
      }
    }
    berries.push(part(transform(sphere(0.22, 8, 5), { t: [0, 1.1, 0] }), "#7e57c2", { roughness: 0.4 }));
    berries.push(
      part(transform(cylinder(0.04, 0.05, 0.22, 6), { t: [0, 1.28, 0] }), STEM, { roughness: 0.9 }),
      part(
        transform(sphere(0.14, 8, 6, 0.25), { t: [0.16, 1.34, 0], r: [0, 0, 25 * DEG], s: [1.5, 1, 0.8] }),
        LEAF,
        { roughness: 0.8 },
      ),
    );
    return normalize(mergeByMaterial(berries));
  },

  "match/banana": () => {
    // Segments swept along an arc; the taper at both ends is what makes the
    // silhouette read as a banana rather than a bent tube.
    const segments = [];
    const count = 9;
    const arc = 130 * DEG;
    const radius = 0.75;
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const angle = -arc / 2 + t * arc;
      const taper = Math.sin(Math.PI * (0.12 + 0.88 * t)) ** 0.5;
      const thickness = 0.1 + 0.14 * Math.min(taper, Math.sin(Math.PI * t) + 0.35);
      segments.push(
        part(
          transform(sphere(thickness, 8, 6), {
            t: [Math.sin(angle) * radius, Math.cos(angle) * radius * 0.55, 0],
            s: [1, 1, 0.85],
          }),
          t < 0.06 || t > 0.94 ? "#6d4c41" : "#fdd835",
          { roughness: 0.5 },
        ),
      );
    }
    return normalize(mergeByMaterial(segments));
  },

  "match/gem": () =>
    normalize(
      mergeByMaterial([
        // Crown above, pavilion below, joined at the girdle.
        part(transform(cone(0.5, 0.42, 8), { t: [0, 0.72, 0] }), "#26c6da", {
          roughness: 0.15,
          metalness: 0.1,
        }),
        part(transform(cone(0.5, 0.62, 8), { t: [0, 0.31, 0], r: [Math.PI, 0, 0] }), "#26c6da", {
          roughness: 0.15,
          metalness: 0.1,
        }),
      ]),
    ),

  "match/star": () =>
    normalize(
      mergeByMaterial([
        part(
          transform(extrude(starOutline(5, 0.55, 0.24), 0.2), { t: [0, 0.55, 0] }),
          "#ffca28",
          { roughness: 0.3, metalness: 0.2 },
        ),
      ]),
    ),

  "match/gift": () =>
    normalize(
      mergeByMaterial([
        part(transform(box(0.9, 0.72, 0.9), { t: [0, 0.36, 0] }), "#ef5350", { roughness: 0.6 }),
        part(transform(box(0.96, 0.16, 0.96), { t: [0, 0.78, 0] }), "#e53935", { roughness: 0.6 }),
        part(transform(box(0.18, 0.76, 0.94), { t: [0, 0.38, 0] }), "#fff59d", { roughness: 0.5 }),
        part(transform(box(0.94, 0.76, 0.18), { t: [0, 0.38, 0] }), "#fff59d", { roughness: 0.5 }),
        part(transform(box(0.2, 0.2, 1.0), { t: [0, 0.86, 0] }), "#fff59d", { roughness: 0.5 }),
        part(transform(box(1.0, 0.2, 0.2), { t: [0, 0.86, 0] }), "#fff59d", { roughness: 0.5 }),
        part(transform(torus(0.16, 0.05, 10, 5), { t: [-0.14, 1.0, 0], r: [0, 0, 30 * DEG] }), "#fff59d", {
          roughness: 0.5,
        }),
        part(transform(torus(0.16, 0.05, 10, 5), { t: [0.14, 1.0, 0], r: [0, 0, -30 * DEG] }), "#fff59d", {
          roughness: 0.5,
        }),
      ]),
    ),

  "match/coin": () =>
    normalize(
      mergeByMaterial([
        part(transform(cylinder(0.5, 0.5, 0.14, 20), { t: [0, 0.5, 0], r: [90 * DEG, 0, 0] }), "#ffd54f", {
          roughness: 0.25,
          metalness: 0.8,
        }),
        part(transform(cylinder(0.36, 0.36, 0.17, 20), { t: [0, 0.5, 0], r: [90 * DEG, 0, 0] }), "#ffb300", {
          roughness: 0.3,
          metalness: 0.8,
        }),
      ]),
    ),

  "runner/coin": () => MODELS["match/coin"](),

  "runner/character": () =>
    normalize(
      mergeByMaterial([
        part(transform(sphere(0.34, 14, 11, 1.0), { t: [0, 1.5, 0] }), "#ffcc80", { roughness: 0.7 }),
        // Hair as a clipped cap rather than a second sphere keeps the count low.
        part(transform(sphere(0.36, 14, 6, 0.55), { t: [0, 1.62, 0] }), "#5d4037", { roughness: 0.9 }),
        part(transform(cylinder(0.3, 0.34, 0.72, 12), { t: [0, 0.92, 0] }), "#42a5f5", { roughness: 0.7 }),
        part(transform(sphere(0.3, 12, 8, 0.7), { t: [0, 1.26, 0] }), "#42a5f5", { roughness: 0.7 }),
        part(transform(cylinder(0.1, 0.1, 0.5, 8), { t: [-0.38, 1.0, 0.06], r: [18 * DEG, 0, -14 * DEG] }), "#ffcc80", {
          roughness: 0.7,
        }),
        part(transform(cylinder(0.1, 0.1, 0.5, 8), { t: [0.38, 1.0, -0.06], r: [-18 * DEG, 0, 14 * DEG] }), "#ffcc80", {
          roughness: 0.7,
        }),
        part(transform(cylinder(0.13, 0.12, 0.6, 8), { t: [-0.16, 0.3, 0.06], r: [10 * DEG, 0, 0] }), "#37474f", {
          roughness: 0.8,
        }),
        part(transform(cylinder(0.13, 0.12, 0.6, 8), { t: [0.16, 0.3, -0.06], r: [-10 * DEG, 0, 0] }), "#37474f", {
          roughness: 0.8,
        }),
        part(transform(box(0.24, 0.12, 0.4), { t: [-0.16, 0.06, 0.12] }), "#eceff1", { roughness: 0.7 }),
        part(transform(box(0.24, 0.12, 0.4), { t: [0.16, 0.06, -0.02] }), "#eceff1", { roughness: 0.7 }),
      ]),
    ),

  "runner/cone": () =>
    normalize(
      mergeByMaterial([
        part(transform(box(0.9, 0.1, 0.9), { t: [0, 0.05, 0] }), "#37474f", { roughness: 0.9 }),
        part(transform(cone(0.34, 1.0, 12), { t: [0, 0.6, 0] }), "#ff7043", { roughness: 0.6 }),
        part(transform(cylinder(0.24, 0.28, 0.16, 12), { t: [0, 0.46, 0] }), "#fafafa", { roughness: 0.6 }),
      ]),
    ),

  "runner/barrier": () =>
    normalize(
      mergeByMaterial([
        part(transform(box(1.6, 0.34, 0.14), { t: [0, 0.86, 0] }), "#ef5350", { roughness: 0.6 }),
        part(transform(box(1.6, 0.34, 0.14), { t: [0, 0.44, 0] }), "#fafafa", { roughness: 0.6 }),
        part(transform(box(0.16, 1.1, 0.16), { t: [-0.7, 0.55, 0] }), "#546e7a", { roughness: 0.8 }),
        part(transform(box(0.16, 1.1, 0.16), { t: [0.7, 0.55, 0] }), "#546e7a", { roughness: 0.8 }),
        part(transform(box(0.5, 0.1, 0.5), { t: [-0.7, 0.05, 0] }), "#455a64", { roughness: 0.9 }),
        part(transform(box(0.5, 0.1, 0.5), { t: [0.7, 0.05, 0] }), "#455a64", { roughness: 0.9 }),
      ]),
    ),

  "runner/crate": () => {
    const planks = [];
    // A horizontal and a vertical batten on all four sides, proud of the box
    // so the crate reads as slatted from any angle.
    for (const [x, z, horizontal] of [
      [0, 0.52, [0.9, 0.16, 0.04]],
      [0, -0.52, [0.9, 0.16, 0.04]],
      [0.52, 0, [0.04, 0.16, 0.9]],
      [-0.52, 0, [0.04, 0.16, 0.9]],
    ]) {
      const vertical =
        horizontal[0] > horizontal[2]
          ? [0.16, 0.9, 0.04]
          : [0.04, 0.9, 0.16];
      planks.push(
        part(transform(box(...horizontal), { t: [x, 0.5, z] }), "#795548", {
          roughness: 0.85,
        }),
        part(transform(box(...vertical), { t: [x, 0.5, z] }), "#795548", {
          roughness: 0.85,
        }),
      );
    }
    return normalize(
      mergeByMaterial([
        part(transform(box(1, 1, 1), { t: [0, 0.5, 0] }), "#a1887f", {
          roughness: 0.85,
        }),
        ...planks,
      ]),
    );
  },

  "cars/sedan": () => car({ length: 3.9, cabinLength: 1.9, cabinHeight: 0.5, bodyHeight: 0.62 }),
  "cars/suv": () => car({ length: 3.9, cabinLength: 2.3, cabinHeight: 0.72, bodyHeight: 0.78, width: 1.8 }),
  "cars/van": () => car({ length: 4.2, cabinLength: 3.0, cabinHeight: 0.9, bodyHeight: 0.8, width: 1.8, cabinOffset: 0.3 }),
  "cars/truck": () =>
    normalize(
      mergeByMaterial([
        ...carParts({ length: 4.6, cabinLength: 1.3, cabinHeight: 0.72, bodyHeight: 0.7, cabinOffset: -1.3 }),
        // Open cargo bed: three walls, so the silhouette reads as a pickup.
        part(transform(box(1.7, 0.42, 0.1), { t: [0, 1.16, 1.05] }), BODY, { roughness: 0.4 }),
        part(transform(box(0.1, 0.42, 2.0), { t: [-0.8, 1.16, 0.1] }), BODY, { roughness: 0.4 }),
        part(transform(box(0.1, 0.42, 2.0), { t: [0.8, 1.16, 0.1] }), BODY, { roughness: 0.4 }),
      ]),
    ),
};

/**
 * A single neutral body colour is deliberate: Parking Jam tints one shared
 * mesh per car instance, so any baked-in colour would fight the tint.
 */
const BODY = "#ffffff";
const GLASS = "#455a64";
const TIRE = "#212121";

function carParts({
  length = 3.9,
  width = 1.7,
  bodyHeight = 0.62,
  cabinLength = 1.9,
  cabinHeight = 0.5,
  cabinOffset = 0,
} = {}) {
  const wheelRadius = 0.34;
  const bodyY = wheelRadius + bodyHeight / 2 + 0.04;
  const cabinY = bodyY + bodyHeight / 2 + cabinHeight / 2;
  const axleZ = length / 2 - 0.85;

  const wheels = [
    [-width / 2, axleZ],
    [width / 2, axleZ],
    [-width / 2, -axleZ],
    [width / 2, -axleZ],
  ].map(([x, z]) =>
    part(
      transform(cylinder(wheelRadius, wheelRadius, 0.26, 12), {
        t: [x, wheelRadius, z],
        r: [0, 0, 90 * DEG],
      }),
      TIRE,
      { roughness: 0.9 },
    ),
  );

  return [
    part(transform(box(width, bodyHeight, length), { t: [0, bodyY, 0] }), BODY, {
      roughness: 0.35,
      metalness: 0.1,
    }),
    part(
      transform(box(width - 0.14, cabinHeight, cabinLength), { t: [0, cabinY, cabinOffset] }),
      BODY,
      { roughness: 0.35, metalness: 0.1 },
    ),
    part(
      transform(box(width - 0.06, cabinHeight - 0.16, cabinLength - 0.18), {
        t: [0, cabinY, cabinOffset],
      }),
      GLASS,
      { roughness: 0.1, metalness: 0.2 },
    ),
    ...wheels,
  ];
}

function car(options) {
  return normalize(mergeByMaterial(carParts(options)));
}
