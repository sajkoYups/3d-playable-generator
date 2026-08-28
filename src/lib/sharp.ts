import sharp from "sharp";

const MAX_DIMENSION = 1920;
const WARN_SIZE = 500 * 1024;

export type OptimizedImage = {
  buffer: Buffer;
  contentType: string;
  extension: string;
  width: number;
  height: number;
  originalSize: number;
  optimizedSize: number;
  thumbnail: Buffer;
  warnLarge: boolean;
};

export async function optimizeImage(
  input: Buffer,
  mimeType: string,
): Promise<OptimizedImage> {
  const originalSize = input.length;

  if (mimeType === "image/svg+xml") {
    return {
      buffer: input,
      contentType: "image/svg+xml",
      extension: ".svg",
      width: 0,
      height: 0,
      originalSize,
      optimizedSize: originalSize,
      thumbnail: input,
      warnLarge: originalSize > WARN_SIZE,
    };
  }

  const image = sharp(input, { failOn: "none" });
  const meta = await image.metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;
  const hasAlpha = Boolean(meta.hasAlpha);

  let pipeline = sharp(input, { failOn: "none" }).rotate();

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    pipeline = pipeline.resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  const useWebp = mimeType !== "image/gif" && mimeType !== "image/svg+xml";
  const optimized = useWebp
    ? await pipeline.webp({ quality: 82, alphaQuality: 90 }).toBuffer()
    : await pipeline.toBuffer();

  const outMeta = await sharp(optimized).metadata();

  const thumbnail = await sharp(optimized)
    .resize({ width: 320, height: 320, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 70 })
    .toBuffer();

  let extension = ".bin";
  if (useWebp) extension = ".webp";
  else if (mimeType.includes("png")) extension = ".png";
  else if (mimeType.includes("gif")) extension = ".gif";
  else if (mimeType.includes("jpeg") || mimeType.includes("jpg")) extension = ".jpg";

  return {
    buffer: optimized,
    contentType: useWebp ? "image/webp" : mimeType,
    extension,
    width: outMeta.width || width,
    height: outMeta.height || height,
    originalSize,
    optimizedSize: optimized.length,
    thumbnail,
    warnLarge: optimized.length > WARN_SIZE || (!hasAlpha && originalSize > WARN_SIZE),
  };
}
