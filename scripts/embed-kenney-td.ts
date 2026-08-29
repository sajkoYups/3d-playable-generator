import { copyFile, mkdir } from "fs/promises";
import path from "path";

export const TD_MODELS = [
  "tile",
  "tile-straight",
  "tile-corner-round",
  "tile-spawn",
  "tile-end",
  "tile-crystal",
  "tile-tree",
  "tile-rock",
  "detail-tree",
  "detail-rocks",
  "selection-a",
  "spawn-round",
  "tower-round-base",
  "tower-round-bottom-a",
  "tower-round-middle-a",
  "tower-round-top-a",
  "tower-square-bottom-a",
  "tower-square-middle-a",
  "tower-square-top-a",
  "weapon-ballista",
  "weapon-cannon",
  "weapon-turret",
  "weapon-ammo-arrow",
  "weapon-ammo-cannonball",
  "weapon-ammo-bullet",
] as const;

const SRC_DIR = path.join(process.cwd(), "public/kenney_tower-defense-kit/Models/GLB format");
const OUT_DIR = path.join(process.cwd(), "public/models/kenney/td");

async function main() {
  await mkdir(path.join(OUT_DIR, "Textures"), { recursive: true });
  await copyFile(path.join(SRC_DIR, "Textures/colormap.png"), path.join(OUT_DIR, "colormap.png"));
  await copyFile(path.join(SRC_DIR, "Textures/colormap.png"), path.join(OUT_DIR, "Textures/colormap.png"));
  console.log("wrote public/models/kenney/td/colormap.png");
  for (const id of TD_MODELS) {
    const src = path.join(SRC_DIR, `${id}.glb`);
    const dest = path.join(OUT_DIR, `${id}.glb`);
    await copyFile(src, dest);
    console.log(`wrote ${path.relative(process.cwd(), dest)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
