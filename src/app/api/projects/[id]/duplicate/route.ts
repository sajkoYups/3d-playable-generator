import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAccessibleProject, requireApiSession } from "@/lib/api-auth";
import type { Prisma } from "@/generated/prisma/client";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const existing = await getAccessibleProject(id, session.user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sources = await prisma.variation.findMany({
    where: { projectId: id },
    orderBy: { updatedAt: "desc" },
  });

  const project = await prisma.project.create({
    data: {
      name: `${existing.name} (Copy)`,
      templateId: existing.templateId,
      defaultOrientation: existing.defaultOrientation,
      members: {
        create: {
          userId: session.user.id,
          role: "owner",
        },
      },
      variations: {
        create: sources.map((v) => ({
          name: v.name,
          projectData: v.projectData as Prisma.InputJsonValue,
          brandId: v.brandId,
          overrides: v.overrides as Prisma.InputJsonValue,
          thumbnailUrl: v.thumbnailUrl,
          status: "draft" as const,
        })),
      },
    },
    include: { variations: true },
  });

  return NextResponse.json({ project }, { status: 201 });
}
