import { mkdir } from "fs/promises";
import path from "path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

const CARS = ["sedan", "suv", "van", "taxi", "police", "truck"] as const;
const SRC_DIR = path.join(process.cwd(), "public/kenney_car-kit/Models/GLB format");
const OUT_DIR = path.join(process.cwd(), "public/models/kenney");

async function main() {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  await mkdir(OUT_DIR, { recursive: true });
  for (const id of CARS) {
    const src = path.join(SRC_DIR, `${id}.glb`);
    const dest = path.join(OUT_DIR, `${id}.glb`);
    const doc = await io.read(src);
    for (const image of doc.getRoot().listTextures()) {
      const uri = image.getURI();
      if (uri && !uri.startsWith("data:")) image.setURI("");
    }
    await io.write(dest, doc);
    console.log(`wrote ${path.relative(process.cwd(), dest)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
