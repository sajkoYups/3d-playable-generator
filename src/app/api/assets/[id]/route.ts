import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAccessibleAppBrand, getAccessibleBrand, getAccessibleProject, requireOrgApi } from "@/lib/api-auth";
import { deleteObject } from "@/lib/storage";

function keyFromUrl(url: string): string | null {
  if (url.startsWith("/api/storage/")) return url.replace("/api/storage/", "");
  return null;
}

async function canAccessAsset(
  organizationId: string,
  asset: { organizationId: string | null; projectId: string | null; brandId: string | null; appBrandId: string | null },
) {
  if (asset.organizationId) return asset.organizationId === organizationId;
  if (asset.projectId) {
    const project = await getAccessibleProject(asset.projectId, organizationId);
    return Boolean(project);
  }
  if (asset.brandId) {
    const brand = await getAccessibleBrand(asset.brandId, organizationId);
    return Boolean(brand);
  }
  if (asset.appBrandId) {
    const brand = await getAccessibleAppBrand(asset.appBrandId, organizationId);
    return Boolean(brand);
  }
  return false;
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authz = await requireOrgApi();
  if (!authz.ok) return authz.response;
  const { id } = await context.params;
  const body = z.object({ fileName: z.string().min(1).max(200) }).parse(await req.json());
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessAsset(authz.organizationId, asset))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.asset.update({
    where: { id },
    data: { fileName: body.fileName },
  });
  return NextResponse.json({ asset: updated });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authz = await requireOrgApi();
  if (!authz.ok) return authz.response;
  const { id } = await context.params;
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessAsset(authz.organizationId, asset))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  for (const url of [asset.originalUrl, asset.optimizedUrl, asset.thumbnailUrl]) {
    if (!url) continue;
    const key = keyFromUrl(url);
    if (key) await deleteObject(key);
  }

  await prisma.asset.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
