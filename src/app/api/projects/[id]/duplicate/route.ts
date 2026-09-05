import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAccessibleProject, requireOrgApi } from "@/lib/api-auth";
import type { Prisma } from "@/generated/prisma/client";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authz = await requireOrgApi();
  if (!authz.ok) return authz.response;
  const { id } = await context.params;
  const existing = await getAccessibleProject(id, authz.organizationId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sources = await prisma.variation.findMany({
    where: { projectId: id },
    orderBy: { updatedAt: "desc" },
  });

  const project = await prisma.project.create({
    data: {
      organizationId: authz.organizationId,
      name: `${existing.name} (Copy)`,
      templateId: existing.templateId,
      defaultOrientation: existing.defaultOrientation,
      members: {
        create: {
          userId: authz.session.user.id,
          role: "owner",
        },
      },
      variations: {
        create: sources.map((v) => ({
          name: v.name,
          projectData: v.projectData as Prisma.InputJsonValue,
          brandId: v.brandId,
          appBrandId: v.appBrandId,
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
