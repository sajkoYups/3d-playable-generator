import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAccessibleProject, requireApiSession } from "@/lib/api-auth";
import { deleteObject } from "@/lib/storage";

function keyFromUrl(url: string): string | null {
  if (url.startsWith("/api/storage/")) return url.replace("/api/storage/", "");
  return null;
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const body = z.object({ fileName: z.string().min(1).max(200) }).parse(await req.json());
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const project = await getAccessibleProject(asset.projectId, session.user.id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
  const session = await requireApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const project = await getAccessibleProject(asset.projectId, session.user.id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  for (const url of [asset.originalUrl, asset.optimizedUrl, asset.thumbnailUrl]) {
    if (!url) continue;
    const key = keyFromUrl(url);
    if (key) await deleteObject(key);
  }

  await prisma.asset.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
