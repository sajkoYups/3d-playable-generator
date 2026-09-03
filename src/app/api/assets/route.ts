import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAccessibleBrand, getAccessibleProject, requireApiSession } from "@/lib/api-auth";
import { optimizeImage } from "@/lib/sharp";
import { optimizeGlb } from "@/lib/optimize-model";
import { optimizeAudio, optimizeVideo } from "@/lib/optimize-media";
import { uploadBuffer } from "@/lib/storage";
import type { AssetKind } from "@/generated/prisma/enums";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"]);
const MODEL_TYPES = new Set(["model/gltf-binary", "model/gltf+json", "application/octet-stream"]);
const AUDIO_TYPES = new Set(["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/mp4", "audio/aac"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

function kindOf(file: File): AssetKind | null {
  if (IMAGE_TYPES.has(file.type)) return "image";
  if (AUDIO_TYPES.has(file.type)) return "audio";
  if (VIDEO_TYPES.has(file.type)) return "video";
  const name = file.name.toLowerCase();
  if (name.endsWith(".glb") || name.endsWith(".gltf") || MODEL_TYPES.has(file.type)) return "model";
  if (name.endsWith(".mp3") || name.endsWith(".wav") || name.endsWith(".ogg")) return "audio";
  if (name.endsWith(".mp4") || name.endsWith(".webm")) return "video";
  return null;
}

export async function GET(req: NextRequest) {
  const session = await requireApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  const brandId = req.nextUrl.searchParams.get("brandId");
  if (brandId) {
    const brand = await getAccessibleBrand(brandId, session.user.id);
    if (!brand) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ assets: brand.assets });
  }
  if (!projectId) return NextResponse.json({ error: "projectId or brandId required" }, { status: 400 });

  const project = await getAccessibleProject(projectId, session.user.id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ assets: project.assets });
}

export async function POST(req: NextRequest) {
  const session = await requireApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const projectId = String(form.get("projectId") || "");
  const brandId = String(form.get("brandId") || "");
  const file = form.get("file");

  if ((!(projectId || brandId)) || !(file instanceof File)) {
    return NextResponse.json({ error: "projectId or brandId, and file, required" }, { status: 400 });
  }

  if (brandId) {
    const brand = await getAccessibleBrand(brandId, session.user.id);
    if (!brand) return NextResponse.json({ error: "Not found" }, { status: 404 });
  } else {
    const project = await getAccessibleProject(projectId, session.user.id);
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const folderRoot = brandId ? `brands/${brandId}` : `projects/${projectId}`;

  const kind = kindOf(file);
  if (!kind) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const original = await uploadBuffer(buffer, {
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
    folder: `${folderRoot}/original`,
  });

  let optimizedUrl = original.url;
  let thumbnailUrl: string | null = null;
  let fileType = file.type || "application/octet-stream";
  let optimizedSize = buffer.length;
  let width: number | null = null;
  let height: number | null = null;
  let triangleCount: number | null = null;
  let warnLarge = false;
  let extraWarning: string | undefined;

  try {
    if (kind === "image") {
      const optimized = await optimizeImage(buffer, file.type);
      const stored = await uploadBuffer(optimized.buffer, {
        fileName: `optimized${optimized.extension}`,
        contentType: optimized.contentType,
        folder: `${folderRoot}/optimized`,
      });
      optimizedUrl = stored.url;
      fileType = optimized.contentType;
      optimizedSize = optimized.optimizedSize;
      width = optimized.width || null;
      height = optimized.height || null;
      warnLarge = optimized.warnLarge;
      if (optimized.contentType !== "image/svg+xml") {
        const thumb = await uploadBuffer(optimized.thumbnail, {
          fileName: "thumb.webp",
          contentType: "image/webp",
          folder: `${folderRoot}/thumbs`,
        });
        thumbnailUrl = thumb.url;
      }
    } else if (kind === "model") {
      const optimized = await optimizeGlb(buffer);
      const stored = await uploadBuffer(optimized.buffer, {
        fileName: `optimized${optimized.extension}`,
        contentType: optimized.contentType,
        folder: `${folderRoot}/optimized`,
      });
      optimizedUrl = stored.url;
      fileType = optimized.contentType;
      optimizedSize = optimized.optimizedSize;
      triangleCount = optimized.triangleCount;
      warnLarge = optimized.warnLarge;
    } else if (kind === "audio") {
      const optimized = await optimizeAudio(buffer, file.type);
      const stored = await uploadBuffer(optimized.buffer, {
        fileName: `optimized${optimized.extension}`,
        contentType: optimized.contentType,
        folder: `${folderRoot}/optimized`,
      });
      optimizedUrl = stored.url;
      fileType = optimized.contentType;
      optimizedSize = optimized.optimizedSize;
      warnLarge = optimized.warnLarge;
      if (!optimized.usedFfmpeg) extraWarning = "ffmpeg not found; audio stored uncompressed";
    } else {
      const optimized = await optimizeVideo(buffer, file.type);
      const stored = await uploadBuffer(optimized.buffer, {
        fileName: `optimized${optimized.extension}`,
        contentType: optimized.contentType,
        folder: `${folderRoot}/optimized`,
      });
      optimizedUrl = stored.url;
      fileType = optimized.contentType;
      optimizedSize = optimized.optimizedSize;
      warnLarge = optimized.warnLarge;
      if (!optimized.usedFfmpeg) extraWarning = "ffmpeg not found; original file stored.";
      else if (optimized.warnLarge) extraWarning = "Video is large and may increase export size."
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Optimization failed" },
      { status: 400 },
    );
  }

  const asset = await prisma.asset.create({
    data: {
      projectId: projectId || null,
      brandId: brandId || null,
      fileName: file.name,
      fileType,
      kind,
      originalUrl: original.url,
      optimizedUrl,
      thumbnailUrl,
      originalSize: buffer.length,
      optimizedSize,
      compressedSize: optimizedSize,
      width,
      height,
      triangleCount,
    },
  });

  return NextResponse.json(
    {
      asset,
      warnLarge,
      warning: extraWarning,
    },
    { status: 201 },
  );
}
