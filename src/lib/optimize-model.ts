import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, textureCompress } from "@gltf-transform/functions";
import { readFile } from "fs/promises";
import path from "path";

const MAX_TRIANGLES = 25000;
const MAX_TEXTURE = 512;
const FOOD_COLORMAP = path.join(process.cwd(), "public/models/kenney/food/colormap.png");

export type OptimizedModel = {
  buffer: Buffer;
  contentType: string;
  extension: string;
  originalSize: number;
  optimizedSize: number;
  triangleCount: number;
  thumbnail: Buffer | null;
  warnLarge: boolean;
};

export async function optimizeGlb(input: Buffer): Promise<OptimizedModel> {
  const originalSize = input.length;
  let document;
  try {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    document = await io.readBinary(new Uint8Array(input));
  } catch {
    return {
      buffer: input,
      contentType: "model/gltf-binary",
      extension: ".glb",
      originalSize,
      optimizedSize: originalSize,
      triangleCount: 0,
      thumbnail: null,
      warnLarge: originalSize > 400 * 1024,
    };
  }
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

  try {
    for (const image of document.getRoot().listTextures()) {
      const uri = image.getURI();
      if (!uri || uri.startsWith("data:")) continue;
      if (!/colormap\.png$/i.test(uri)) continue;
      try {
        const png = await readFile(FOOD_COLORMAP);
        image.setImage(png);
        image.setMimeType("image/png");
        image.setURI("");
      } catch {
        /* keep original */
      }
    }
    await document.transform(
      dedup(),
      prune(),
      textureCompress({
        targetFormat: "webp",
        resize: [MAX_TEXTURE, MAX_TEXTURE],
      }),
    );
  } catch {
    await document.transform(dedup(), prune());
  }

  let triangles = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices();
      if (indices) triangles += indices.getCount() / 3;
      else {
        const pos = prim.getAttribute("POSITION");
        if (pos) triangles += pos.getCount() / 3;
      }
    }
  }

  if (triangles > MAX_TRIANGLES) {
    throw new Error(`Model has ${Math.round(triangles)} triangles (max ${MAX_TRIANGLES}). Simplify it before upload.`);
  }

  const out = Buffer.from(await io.writeBinary(document));
  return {
    buffer: out,
    contentType: "model/gltf-binary",
    extension: ".glb",
    originalSize,
    optimizedSize: out.length,
    triangleCount: Math.round(triangles),
    thumbnail: null,
    warnLarge: out.length > 400 * 1024,
  };
}
