import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAccessibleVariation, requireApiSession } from "@/lib/api-auth";
import { parseOverrides, parseProjectData } from "@/lib/resolve-playable";
import type { Prisma } from "@/generated/prisma/client";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string; vid: string }> },
) {
  const session = await requireApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, vid } = await context.params;
  const access = await getAccessibleVariation(id, vid, session.user.id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const source = access.variation;
  const variation = await prisma.variation.create({
    data: {
      projectId: id,
      name: `${source.name} (Copy)`,
      projectData: parseProjectData(source.projectData) as Prisma.InputJsonValue,
      brandId: source.brandId,
      appBrandId: source.appBrandId,
      overrides: parseOverrides(source.overrides) as Prisma.InputJsonValue,
      thumbnailUrl: source.thumbnailUrl,
      status: "draft",
    },
    include: { brand: { select: { id: true, name: true, thumbnailUrl: true } }, appBrand: { select: { id: true, name: true, thumbnailUrl: true } } },
  });

  await prisma.project.update({ where: { id }, data: { updatedAt: new Date() } });
  return NextResponse.json({ variation }, { status: 201 });
}
