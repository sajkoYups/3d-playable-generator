/**
 * Generates the curated GLB library into public/models.
 *
 * Run with `npm run build:models` after editing scripts/lib/models.mjs. The
 * output is committed so a clone does not need to regenerate it, and so a
 * change to a shipped model shows up as a reviewable diff in size.
 */
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { Document, Logger, NodeIO } from "@gltf-transform/core";
import { KHRMeshQuantization } from "@gltf-transform/extensions";
import { dedup, prune, quantize, weld } from "@gltf-transform/functions";
import { MODELS } from "./lib/models.mjs";

const OUT_DIR = path.join(process.cwd(), "public", "models");

/** sRGB hex to the linear float triple glTF expects for baseColorFactor. */
function hexToLinear(hex) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((offset) => {
    const channel = parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
}

async function buildModel(id, groups) {
  const document = new Document().setLogger(new Logger(Logger.Verbosity.ERROR));
  document.createBuffer();
  const scene = document.createScene();
  const mesh = document.createMesh(id);

  let triangles = 0;

  for (const [index, group] of groups.entries()) {
    const positions = document
      .createAccessor()
      .setType("VEC3")
      .setArray(new Float32Array(group.geometry.positions));
    const normals = document
      .createAccessor()
      .setType("VEC3")
      .setArray(new Float32Array(group.geometry.normals));
    const indices = document
      .createAccessor()
      .setType("SCALAR")
      .setArray(new Uint16Array(group.geometry.indices));

    const material = document
      .createMaterial(`${id}-${index}`)
      .setBaseColorFactor([...hexToLinear(group.color), 1])
      .setRoughnessFactor(group.roughness)
      .setMetallicFactor(group.metalness)
      .setDoubleSided(false);

    const primitive = document
      .createPrimitive()
      .setAttribute("POSITION", positions)
      .setAttribute("NORMAL", normals)
      .setIndices(indices)
      .setMaterial(material);

    mesh.addPrimitive(primitive);
    triangles += group.geometry.indices.length / 3;
  }

  scene.addChild(document.createNode(id).setMesh(mesh));

  // Welding merges the duplicate vertices that primitive seams leave behind;
  // prune and dedup clean up anything the authoring pass created and dropped.
  // Quantization then drops positions to 14-bit and normals to 10-bit, which
  // roughly halves the file at a precision no one can see on a 1 cm item.
  await document.transform(
    weld(),
    dedup(),
    prune(),
    quantize({ quantizePosition: 14, quantizeNormal: 10 }),
  );

  const io = new NodeIO().registerExtensions([KHRMeshQuantization]);
  const glb = await io.writeBinary(document);

  const file = path.join(OUT_DIR, `${id}.glb`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, glb);

  return { bytes: glb.byteLength, triangles, primitives: groups.length };
}

let total = 0;
const rows = [];

for (const [id, factory] of Object.entries(MODELS)) {
  try {
    const stats = await buildModel(id, factory());
    total += stats.bytes;
    rows.push({ id, ...stats });
  } catch (error) {
    console.error(`✗ ${id}: ${error.message}`);
    process.exitCode = 1;
  }
}

const width = Math.max(...rows.map((row) => row.id.length));
for (const row of rows) {
  console.log(
    `${row.id.padEnd(width)}  ${String(row.triangles).padStart(5)} tris  ` +
      `${String(row.primitives).padStart(2)} prim  ` +
      `${(row.bytes / 1024).toFixed(1).padStart(7)} KB`,
  );
}
console.log(
  `\n${rows.length} models, ${(total / 1024).toFixed(1)} KB total ` +
    `(exports only inline what a project references)`,
);
