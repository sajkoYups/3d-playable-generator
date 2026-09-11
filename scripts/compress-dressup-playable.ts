import { mkdir, readdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";

const MAX_WIDTH = 640;
const QUALITY = 72;
const ALPHA_QUALITY = 80;

const SOURCES = [
  "public/playforge-transparent-base-and-assets",
  "public/playforge-12-full-outfits",
] as const;

const OUT_DIR = path.join(process.cwd(), "public/playforge-dressup-playable");

const ORIGINAL_CROPS: Record<string, { x: number; y: number; w: number; h: number }> = {
  "model-base.png": { x: 0, y: 0, w: 1024, h: 1536 },
  "dress-red.png": { x: 158, y: 60, w: 719, h: 1369 },
  "dress-black.png": { x: 170, y: 95, w: 691, h: 1342 },
  "dress-floral.png": { x: 133, y: 25, w: 768, h: 1420 },
  "shoes-black.png": { x: 169, y: 134, w: 900, h: 994 },
  "shoes-white.png": { x: 151, y: 152, w: 1099, h: 816 },
  "accessory-sunglasses.png": { x: 66, y: 205, w: 1642, h: 499 },
  "accessory-pearls.png": { x: 157, y: 83, w: 1223, h: 852 },
};

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const rows: Array<{
    src: string;
    dest: string;
    from: { w: number; h: number };
    to: { w: number; h: number };
    crop?: { x: number; y: number; w: number; h: number };
    bytes: number;
  }> = [];
  let total = 0;

  for (const dir of SOURCES) {
    const abs = path.join(process.cwd(), dir);
    const files = (await readdir(abs)).filter((name) => name.endsWith(".png")).sort();
    for (const name of files) {
      const src = path.join(abs, name);
      const destName = name.replace(/\.png$/i, ".webp");
      const dest = path.join(OUT_DIR, destName);
      const image = sharp(src, { failOn: "none" });
      const meta = await image.metadata();
      const fromW = meta.width || 1;
      const fromH = meta.height || 1;
      const buffer = await sharp(src, { failOn: "none" })
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: QUALITY, alphaQuality: ALPHA_QUALITY, effort: 6 })
        .toBuffer();
      await writeFile(dest, buffer);
      const outMeta = await sharp(buffer).metadata();
      const toW = outMeta.width || fromW;
      const toH = outMeta.height || fromH;
      const sx = toW / fromW;
      const sy = toH / fromH;
      const srcCrop = ORIGINAL_CROPS[name];
      const crop = srcCrop
        ? {
            x: Math.round(srcCrop.x * sx),
            y: Math.round(srcCrop.y * sy),
            w: Math.round(srcCrop.w * sx),
            h: Math.round(srcCrop.h * sy),
          }
        : { x: 0, y: 0, w: toW, h: toH };
      total += buffer.length;
      rows.push({
        src: `${dir}/${name}`,
        dest: destName,
        from: { w: fromW, h: fromH },
        to: { w: toW, h: toH },
        crop,
        bytes: buffer.length,
      });
      console.log(
        `${destName.padEnd(40)} ${fromW}x${fromH} -> ${toW}x${toH}  ${(buffer.length / 1024).toFixed(0)} KB  crop=${JSON.stringify(crop)}`,
      );
    }
  }

  console.log(`\nWrote ${rows.length} files, ${(total / 1024 / 1024).toFixed(2)} MiB -> ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
