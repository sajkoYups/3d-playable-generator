/**
 * Turn Kenney tower-defense OBJ tiles into GLBs that share the existing colormap.
 * Run: node scripts/convert-td-tiles.mjs
 */
import { readFileSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { Document, Logger, NodeIO } from "@gltf-transform/core";

const SRC = path.join(process.cwd(), "public/kenney_tower-defense-kit/Models/OBJ format");
const OUT = path.join(process.cwd(), "public/models/kenney/td");

const NAMES = [
  "tile-hill",
  "tile-slope",
  "tile-tree-double",
  "tile-tree-quad",
  "detail-tree-large",
  "wood-structure",
  "wood-structure-high",
  "wood-structure-part",
  "tower-square-roof-a",
  "tower-square-roof-b",
  "tile-river-bridge",
  "tile-dirt",
];

function parseObj(file) {
  const positions = [];
  const uvs = [];
  const normals = [];
  const faces = [];
  for (const line of readFileSync(file, "utf8").split(/\n/)) {
    if (line.startsWith("v ")) positions.push(line.trim().split(/\s+/).slice(1, 4).map(Number));
    else if (line.startsWith("vt ")) uvs.push(line.trim().split(/\s+/).slice(1, 3).map(Number));
    else if (line.startsWith("vn ")) normals.push(line.trim().split(/\s+/).slice(1, 4).map(Number));
    else if (line.startsWith("f ")) {
      const corners = line.trim().split(/\s+/).slice(1).map((tok) => {
        const [vi, ti, ni] = tok.split("/");
        return [Number(vi) - 1, ti ? Number(ti) - 1 : 0, ni ? Number(ni) - 1 : 0];
      });
      for (let i = 1; i < corners.length - 1; i++) faces.push([corners[0], corners[i], corners[i + 1]]);
    }
  }
  const keyToIndex = new Map();
  const outP = [];
  const outU = [];
  const outN = [];
  const indices = [];
  const push = (corner) => {
    const key = corner.join("/");
    const existing = keyToIndex.get(key);
    if (existing != null) return existing;
    const index = outP.length / 3;
    keyToIndex.set(key, index);
    const p = positions[corner[0]] ?? [0, 0, 0];
    const uv = uvs[corner[1]] ?? [0, 0];
    const n = normals[corner[2]] ?? [0, 1, 0];
    outP.push(p[0], p[1], p[2]);
    outU.push(uv[0], uv[1]);
    outN.push(n[0], n[1], n[2]);
    return index;
  };
  for (const face of faces) {
    for (const corner of face) indices.push(push(corner));
  }
  return { positions: outP, uvs: outU, normals: outN, indices };
}

async function convert(name) {
  const mesh = parseObj(path.join(SRC, `${name}.obj`));
  const document = new Document().setLogger(new Logger(Logger.Verbosity.ERROR));
  document.createBuffer();
  const texture = document.createTexture("colormap").setURI("Textures/colormap.png").setMimeType("image/png");
  const material = document
    .createMaterial("colormap")
    .setBaseColorTexture(texture)
    .setRoughnessFactor(1)
    .setMetallicFactor(0);
  const prim = document
    .createPrimitive()
    .setAttribute("POSITION", document.createAccessor().setType("VEC3").setArray(new Float32Array(mesh.positions)))
    .setAttribute("NORMAL", document.createAccessor().setType("VEC3").setArray(new Float32Array(mesh.normals)))
    .setAttribute("TEXCOORD_0", document.createAccessor().setType("VEC2").setArray(new Float32Array(mesh.uvs)))
    .setIndices(document.createAccessor().setType("SCALAR").setArray(new Uint32Array(mesh.indices)))
    .setMaterial(material);
  const node = document.createNode(name).setMesh(document.createMesh(name).addPrimitive(prim));
  document.createScene().addChild(node);
  const io = new NodeIO();
  const glb = await io.writeBinary(document);
  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, `${name}.glb`), glb);
  return glb.byteLength;
}

let total = 0;
for (const name of NAMES) {
  const bytes = await convert(name);
  total += bytes;
  console.log(`${name}  ${(bytes / 1024).toFixed(1)} KB`);
}
console.log(`${NAMES.length} tiles, ${(total / 1024).toFixed(1)} KB`);
