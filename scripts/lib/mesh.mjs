/**
 * A tiny CPU mesh toolkit for authoring the curated model library.
 *
 * The library is generated from primitives rather than sourced externally so
 * every shipped model is ours to license, is reproducible from source, and
 * stays in the low-poly budget a playable can afford. Nothing here is used at
 * runtime — three.js does this work in the browser.
 */

/** @typedef {{positions: number[], normals: number[], indices: number[]}} Geometry */

export function empty() {
  return { positions: [], normals: [], indices: [] };
}

export function box(width, height, depth) {
  const hw = width / 2;
  const hh = height / 2;
  const hd = depth / 2;
  const geometry = empty();

  const faces = [
    { normal: [0, 0, 1], corners: [[-hw, -hh, hd], [hw, -hh, hd], [hw, hh, hd], [-hw, hh, hd]] },
    { normal: [0, 0, -1], corners: [[hw, -hh, -hd], [-hw, -hh, -hd], [-hw, hh, -hd], [hw, hh, -hd]] },
    { normal: [1, 0, 0], corners: [[hw, -hh, hd], [hw, -hh, -hd], [hw, hh, -hd], [hw, hh, hd]] },
    { normal: [-1, 0, 0], corners: [[-hw, -hh, -hd], [-hw, -hh, hd], [-hw, hh, hd], [-hw, hh, -hd]] },
    { normal: [0, 1, 0], corners: [[-hw, hh, hd], [hw, hh, hd], [hw, hh, -hd], [-hw, hh, -hd]] },
    { normal: [0, -1, 0], corners: [[-hw, -hh, -hd], [hw, -hh, -hd], [hw, -hh, hd], [-hw, -hh, hd]] },
  ];

  for (const face of faces) {
    const base = geometry.positions.length / 3;
    for (const corner of face.corners) {
      geometry.positions.push(...corner);
      geometry.normals.push(...face.normal);
    }
    geometry.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return geometry;
}

/**
 * UV sphere, optionally squashed and clipped.
 * `yScale` makes ellipsoids (pears, lemons) without a separate primitive.
 */
export function sphere(radius, segments = 14, rings = 10, yScale = 1) {
  const geometry = empty();

  for (let ring = 0; ring <= rings; ring++) {
    const phi = (ring / rings) * Math.PI;
    const y = Math.cos(phi);
    const r = Math.sin(phi);
    for (let segment = 0; segment <= segments; segment++) {
      const theta = (segment / segments) * Math.PI * 2;
      const nx = r * Math.cos(theta);
      const ny = y;
      const nz = r * Math.sin(theta);
      geometry.positions.push(nx * radius, ny * radius * yScale, nz * radius);
      const length = Math.hypot(nx, ny / yScale, nz) || 1;
      geometry.normals.push(nx / length, ny / yScale / length, nz / length);
    }
  }

  const stride = segments + 1;
  for (let ring = 0; ring < rings; ring++) {
    for (let segment = 0; segment < segments; segment++) {
      const a = ring * stride + segment;
      const b = a + stride;
      geometry.indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  return geometry;
}

export function cylinder(radiusTop, radiusBottom, height, segments = 14, capped = true) {
  const geometry = empty();
  const hh = height / 2;
  const slope = (radiusBottom - radiusTop) / height;

  for (let row = 0; row < 2; row++) {
    const y = row === 0 ? hh : -hh;
    const radius = row === 0 ? radiusTop : radiusBottom;
    for (let segment = 0; segment <= segments; segment++) {
      const theta = (segment / segments) * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      geometry.positions.push(cos * radius, y, sin * radius);
      const length = Math.hypot(cos, slope, sin) || 1;
      geometry.normals.push(cos / length, slope / length, sin / length);
    }
  }

  const stride = segments + 1;
  for (let segment = 0; segment < segments; segment++) {
    const a = segment;
    const b = stride + segment;
    geometry.indices.push(a, b, a + 1, a + 1, b, b + 1);
  }

  if (capped) {
    for (const [y, radius, normal] of [
      [hh, radiusTop, 1],
      [-hh, radiusBottom, -1],
    ]) {
      if (radius <= 0) continue;
      const center = geometry.positions.length / 3;
      geometry.positions.push(0, y, 0);
      geometry.normals.push(0, normal, 0);
      for (let segment = 0; segment <= segments; segment++) {
        const theta = (segment / segments) * Math.PI * 2;
        geometry.positions.push(
          Math.cos(theta) * radius,
          y,
          Math.sin(theta) * radius,
        );
        geometry.normals.push(0, normal, 0);
      }
      for (let segment = 0; segment < segments; segment++) {
        const a = center + 1 + segment;
        if (normal > 0) geometry.indices.push(center, a + 1, a);
        else geometry.indices.push(center, a, a + 1);
      }
    }
  }

  return geometry;
}

export function cone(radius, height, segments = 14) {
  return cylinder(0, radius, height, segments, true);
}

export function torus(radius, tube, radialSegments = 16, tubularSegments = 8) {
  const geometry = empty();

  for (let i = 0; i <= radialSegments; i++) {
    const u = (i / radialSegments) * Math.PI * 2;
    for (let j = 0; j <= tubularSegments; j++) {
      const v = (j / tubularSegments) * Math.PI * 2;
      const nx = Math.cos(u) * Math.cos(v);
      const ny = Math.sin(v);
      const nz = Math.sin(u) * Math.cos(v);
      geometry.positions.push(
        (radius + tube * Math.cos(v)) * Math.cos(u),
        tube * Math.sin(v),
        (radius + tube * Math.cos(v)) * Math.sin(u),
      );
      geometry.normals.push(nx, ny, nz);
    }
  }

  const stride = tubularSegments + 1;
  for (let i = 0; i < radialSegments; i++) {
    for (let j = 0; j < tubularSegments; j++) {
      const a = i * stride + j;
      const b = a + stride;
      geometry.indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  return geometry;
}

/** Extrudes a closed 2D outline along Z. Used for stars, gems and badges. */
export function extrude(points, depth) {
  const geometry = empty();
  const hd = depth / 2;
  const count = points.length;

  for (const [sign, normal] of [
    [hd, 1],
    [-hd, -1],
  ]) {
    const base = geometry.positions.length / 3;
    for (const [x, y] of points) {
      geometry.positions.push(x, y, sign);
      geometry.normals.push(0, 0, normal);
    }
    // Fan triangulation is valid here because every authored outline is
    // star-shaped about the origin.
    for (let i = 1; i < count - 1; i++) {
      if (normal > 0) geometry.indices.push(base, base + i, base + i + 1);
      else geometry.indices.push(base, base + i + 1, base + i);
    }
  }

  for (let i = 0; i < count; i++) {
    const next = (i + 1) % count;
    const [x0, y0] = points[i];
    const [x1, y1] = points[next];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const length = Math.hypot(dx, dy) || 1;
    const nx = dy / length;
    const ny = -dx / length;

    const base = geometry.positions.length / 3;
    geometry.positions.push(x0, y0, hd, x1, y1, hd, x1, y1, -hd, x0, y0, -hd);
    for (let k = 0; k < 4; k++) geometry.normals.push(nx, ny, 0);
    geometry.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  return geometry;
}

export function starOutline(points, outerRadius, innerRadius) {
  const outline = [];
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    outline.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
  }
  return outline;
}

/** Rounded rectangle outline, for crates and barrier plates. */
export function roundedRectOutline(width, height, radius, cornerSegments = 3) {
  const hw = width / 2 - radius;
  const hh = height / 2 - radius;
  const outline = [];
  const corners = [
    [hw, hh, 0],
    [-hw, hh, Math.PI / 2],
    [-hw, -hh, Math.PI],
    [hw, -hh, (Math.PI * 3) / 2],
  ];
  for (const [cx, cy, start] of corners) {
    for (let i = 0; i <= cornerSegments; i++) {
      const angle = start + (i / cornerSegments) * (Math.PI / 2);
      outline.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
    }
  }
  return outline;
}

export function transform(geometry, { t = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] } = {}) {
  const scale = typeof s === "number" ? [s, s, s] : s;
  const [sx, sy, sz] = scale;
  const output = {
    positions: [],
    normals: [],
    indices: geometry.indices.slice(),
  };

  for (let i = 0; i < geometry.positions.length; i += 3) {
    let p = [
      geometry.positions[i] * sx,
      geometry.positions[i + 1] * sy,
      geometry.positions[i + 2] * sz,
    ];
    // Non-uniform scale skews normals, so they are scaled by the inverse.
    let n = [
      geometry.normals[i] / sx,
      geometry.normals[i + 1] / sy,
      geometry.normals[i + 2] / sz,
    ];

    p = rotate(p, r);
    n = rotate(n, r);

    const length = Math.hypot(n[0], n[1], n[2]) || 1;
    output.positions.push(p[0] + t[0], p[1] + t[1], p[2] + t[2]);
    output.normals.push(n[0] / length, n[1] / length, n[2] / length);
  }

  return output;
}

function rotate([x, y, z], [rx, ry, rz]) {
  if (rx) {
    const c = Math.cos(rx);
    const s = Math.sin(rx);
    [y, z] = [y * c - z * s, y * s + z * c];
  }
  if (ry) {
    const c = Math.cos(ry);
    const s = Math.sin(ry);
    [x, z] = [x * c + z * s, -x * s + z * c];
  }
  if (rz) {
    const c = Math.cos(rz);
    const s = Math.sin(rz);
    [x, y] = [x * c - y * s, x * s + y * c];
  }
  return [x, y, z];
}

/**
 * Merges parts sharing a colour into one primitive.
 *
 * A twelve-part fruit drawn as twelve draw calls is fine on a desktop and not
 * fine on a three-year-old Android running an ad, so parts collapse by
 * material before they ever reach the GPU.
 */
export function mergeByMaterial(parts) {
  const groups = new Map();

  for (const part of parts) {
    const key = `${part.color}|${part.roughness ?? 0.6}|${part.metalness ?? 0}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        color: part.color,
        roughness: part.roughness ?? 0.6,
        metalness: part.metalness ?? 0,
        geometry: empty(),
      };
      groups.set(key, group);
    }

    const offset = group.geometry.positions.length / 3;
    group.geometry.positions.push(...part.geometry.positions);
    group.geometry.normals.push(...part.geometry.normals);
    for (const index of part.geometry.indices) {
      group.geometry.indices.push(index + offset);
    }
  }

  return [...groups.values()];
}

/** Centers on X/Z, drops onto Y=0, and fits inside a unit cube. */
export function normalize(groups, { anchor = "bottom" } = {}) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  for (const group of groups) {
    const { positions } = group.geometry;
    for (let i = 0; i < positions.length; i += 3) {
      for (let axis = 0; axis < 3; axis++) {
        min[axis] = Math.min(min[axis], positions[i + axis]);
        max[axis] = Math.max(max[axis], positions[i + axis]);
      }
    }
  }

  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const scale = 1 / Math.max(size[0], size[1], size[2], 1e-6);
  const centerX = (min[0] + max[0]) / 2;
  const centerZ = (min[2] + max[2]) / 2;
  const offsetY = anchor === "bottom" ? min[1] : (min[1] + max[1]) / 2;

  for (const group of groups) {
    const { positions } = group.geometry;
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] = (positions[i] - centerX) * scale;
      positions[i + 1] = (positions[i + 1] - offsetY) * scale;
      positions[i + 2] = (positions[i + 2] - centerZ) * scale;
    }
  }

  return groups;
}
