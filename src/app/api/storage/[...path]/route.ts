import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { requireOrgApi } from "@/lib/api-auth";

async function canReadStorageKey(key: string, organizationId: string): Promise<boolean> {
  if (key.startsWith(`orgs/${organizationId}/`)) return true;

  const storageUrl = `/api/storage/${key}`;
  const asset = await prisma.asset.findFirst({
    where: {
      OR: [{ originalUrl: storageUrl }, { optimizedUrl: storageUrl }, { thumbnailUrl: storageUrl }],
    },
    include: {
      project: { select: { organizationId: true } },
      brand: { select: { organizationId: true } },
      appBrand: { select: { organizationId: true } },
    },
  });
  if (asset) {
    const orgId =
      asset.organizationId ||
      asset.project?.organizationId ||
      asset.brand?.organizationId ||
      asset.appBrand?.organizationId;
    return orgId === organizationId;
  }

  const projectMatch = key.match(/^projects\/([^/]+)\//);
  if (projectMatch) {
    const project = await prisma.project.findFirst({
      where: { id: projectMatch[1], organizationId },
      select: { id: true },
    });
    return Boolean(project);
  }
  const brandMatch = key.match(/^brands\/([^/]+)\//);
  if (brandMatch) {
    const brand = await prisma.brand.findFirst({
      where: { id: brandMatch[1], organizationId },
      select: { id: true },
    });
    return Boolean(brand);
  }
  const appBrandMatch = key.match(/^app-brands\/([^/]+)\//);
  if (appBrandMatch) {
    const appBrand = await prisma.appBrand.findFirst({
      where: { id: appBrandMatch[1], organizationId },
      select: { id: true },
    });
    return Boolean(appBrand);
  }

  return false;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const authz = await requireOrgApi();
  if (!authz.ok) return authz.response;

  const { path: parts } = await context.params;
  const key = parts.join("/");
  const root = path.resolve(process.env.STORAGE_LOCAL_PATH || "./storage");
  const fullPath = path.join(root, key);

  if (!fullPath.startsWith(root)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  if (!(await canReadStorageKey(key, authz.organizationId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const data = await readFile(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const type =
      ext === ".webp"
        ? "image/webp"
        : ext === ".png"
          ? "image/png"
          : ext === ".jpg" || ext === ".jpeg"
            ? "image/jpeg"
            : ext === ".svg"
              ? "image/svg+xml"
              : ext === ".glb"
                ? "model/gltf-binary"
                : ext === ".gltf"
                  ? "model/gltf+json"
                  : ext === ".mp3"
                    ? "audio/mpeg"
                    : ext === ".mp4"
                      ? "video/mp4"
                      : "application/octet-stream";
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
