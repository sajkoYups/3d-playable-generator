import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, simplify, textureCompress } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";

const SRC_DIR = path.join(
  process.cwd(),
  "public/Bestiary - Dungeon Monsters Kit[Standard]/Exports/GLB (Godot-Unreal)",
);
const OUT_DIR = path.join(process.cwd(), "public/models/bestiary");

const MODELS = ["Imp", "Puglin"] as const;

async function compress(src: string, dest: string) {
  await MeshoptSimplifier.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(src);
  await doc.transform(
    dedup(),
    simplify({ simplifier: MeshoptSimplifier, ratio: 0.55, error: 0.008 }),
    textureCompress({
      encoder: sharp,
      targetFormat: "webp",
      resize: [512, 512],
      slots: /baseColorTexture|emissiveTexture/,
      quality: 82,
    }),
    textureCompress({
      encoder: sharp,
      targetFormat: "webp",
      resize: [256, 256],
      slots: /normalTexture|occlusionTexture|metallicRoughnessTexture/,
      quality: 70,
    }),
    prune(),
  );
  const bytes = await io.writeBinary(doc);
  await writeFile(dest, bytes);
  return bytes.byteLength;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  for (const name of MODELS) {
    const src = path.join(SRC_DIR, `${name}.glb`);
    const dest = path.join(OUT_DIR, `${name.toLowerCase()}.glb`);
    const size = await compress(src, dest);
    console.log(`wrote ${path.relative(process.cwd(), dest)} (${Math.round(size / 1024)} KB)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
