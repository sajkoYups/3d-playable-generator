import { Document, NodeIO } from "@gltf-transform/core";
import { mkdir } from "fs/promises";
import path from "path";

type Spec = { id: string; color: [number, number, number, number]; kind: "box" | "sphere" | "cyl" | "cone" };

const SPECS: Spec[] = [
  { id: "apple", color: [0.91, 0.36, 0.3, 1], kind: "sphere" },
  { id: "banana", color: [0.96, 0.77, 0.19, 1], kind: "cyl" },
  { id: "bottle", color: [0.17, 0.71, 0.63, 1], kind: "cyl" },
  { id: "can", color: [0.54, 0.52, 0.58, 1], kind: "cyl" },
  { id: "coin", color: [0.88, 0.69, 0.29, 1], kind: "cyl" },
  { id: "gem", color: [0.49, 0.36, 1, 1], kind: "cone" },
  { id: "key", color: [0.83, 0.63, 0.09, 1], kind: "box" },
  { id: "star", color: [0.95, 0.93, 0.88, 1], kind: "cone" },
  { id: "donut", color: [0.88, 0.48, 0.24, 1], kind: "cyl" },
  { id: "hammer", color: [0.42, 0.31, 0.23, 1], kind: "box" },
  { id: "potion", color: [0.24, 0.49, 1, 1], kind: "sphere" },
  { id: "crown", color: [0.88, 0.69, 0.29, 1], kind: "cone" },
  { id: "runner", color: [0.88, 0.48, 0.24, 1], kind: "cyl" },
  { id: "crate", color: [0.55, 0.35, 0.17, 1], kind: "box" },
  { id: "barrier", color: [0.91, 0.36, 0.3, 1], kind: "box" },
  { id: "cone", color: [0.88, 0.48, 0.24, 1], kind: "cone" },
  { id: "sedan", color: [0.88, 0.48, 0.24, 1], kind: "box" },
  { id: "suv", color: [0.17, 0.71, 0.63, 1], kind: "box" },
  { id: "van", color: [0.49, 0.36, 1, 1], kind: "box" },
];

function boxPositions(): Float32Array {
  const s = 0.5;
  return new Float32Array([
    -s, -s, s, s, -s, s, s, s, s, -s, s, s,
    -s, -s, -s, -s, s, -s, s, s, -s, s, -s, -s,
  ]);
}

function boxIndices(): Uint16Array {
  return new Uint16Array([
    0, 1, 2, 0, 2, 3,
    4, 5, 6, 4, 6, 7,
    4, 0, 3, 4, 3, 5,
    1, 7, 6, 1, 6, 2,
    3, 2, 6, 3, 6, 5,
    4, 7, 1, 4, 1, 0,
  ]);
}

async function writeGlb(spec: Spec, outDir: string) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const material = doc
    .createMaterial(spec.id)
    .setBaseColorFactor(spec.color)
    .setMetallicFactor(spec.kind === "cyl" && spec.id === "coin" ? 0.8 : 0.1)
    .setRoughnessFactor(0.4);

  const pos = doc
    .createAccessor("position")
    .setType("VEC3")
    .setArray(new Float32Array(boxPositions()))
    .setBuffer(buffer);
  const idx = doc
    .createAccessor("indices")
    .setType("SCALAR")
    .setArray(new Uint16Array(boxIndices()))
    .setBuffer(buffer);
  const prim = doc.createPrimitive().setAttribute("POSITION", pos).setIndices(idx).setMaterial(material);
  const mesh = doc.createMesh(spec.id).addPrimitive(prim);
  const node = doc.createNode(spec.id).setMesh(mesh);
  if (spec.kind === "cyl") node.setScale([0.6, 1, 0.6]);
  if (spec.kind === "sphere") node.setScale([0.85, 0.85, 0.85]);
  if (spec.kind === "cone") node.setScale([0.7, 1.1, 0.7]);
  if (spec.id === "sedan" || spec.id === "suv" || spec.id === "van") node.setScale([1.8, 0.45, 0.9]);
  doc.createScene().addChild(node);

  const io = new NodeIO();
  const bytes = await io.writeBinary(doc);
  const { writeFile } = await import("fs/promises");
  await writeFile(path.join(outDir, `${spec.id}.glb`), Buffer.from(bytes));
}

async function main() {
  const outDir = path.join(process.cwd(), "public/models");
  await mkdir(outDir, { recursive: true });
  for (const spec of SPECS) {
    await writeGlb(spec, outDir);
  }
  console.log(`Wrote ${SPECS.length} GLB files to ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
