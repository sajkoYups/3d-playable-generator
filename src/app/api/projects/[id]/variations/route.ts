import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAccessibleProject, requireOrgApi } from "@/lib/api-auth";
import { createDefaultProjectData } from "@/lib/project-defaults";
import { parseOverrides, parseProjectData } from "@/lib/resolve-playable";
import type { Prisma } from "@/generated/prisma/client";
import type { TemplateId } from "@/types/project";

const CreateVariationSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  brandId: z.string().nullable().optional(),
  sourceVariationId: z.string().optional(),
});

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authz = await requireOrgApi();
  if (!authz.ok) return authz.response;
  const { id } = await context.params;
  const project = await getAccessibleProject(id, authz.organizationId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const variations = await prisma.variation.findMany({
    where: { projectId: id },
    include: { brand: { select: { id: true, name: true, thumbnailUrl: true, brandData: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ variations });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authz = await requireOrgApi();
  if (!authz.ok) return authz.response;
  const { id } = await context.params;
  const project = await getAccessibleProject(id, authz.organizationId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = CreateVariationSchema.parse(await req.json().catch(() => ({})));

  if (body.brandId) {
    const brand = await prisma.brand.findFirst({
      where: { id: body.brandId, organizationId: authz.organizationId },
    });
    if (!brand) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const source = body.sourceVariationId
    ? await prisma.variation.findFirst({ where: { id: body.sourceVariationId, projectId: id } })
    : await prisma.variation.findFirst({ where: { projectId: id }, orderBy: { updatedAt: "desc" } });

  const templateId = project.templateId as TemplateId;
  const projectData = source
    ? parseProjectData(source.projectData)
    : createDefaultProjectData(templateId);

  const brand = body.brandId
    ? await prisma.brand.findUnique({ where: { id: body.brandId }, select: { name: true } })
    : null;

  const variation = await prisma.variation.create({
    data: {
      projectId: id,
      name: body.name?.trim() || brand?.name || "Untitled variation",
      projectData: projectData as Prisma.InputJsonValue,
      brandId: body.brandId ?? null,
      overrides: parseOverrides(source && !body.brandId ? source.overrides : {}) as Prisma.InputJsonValue,
      status: "draft",
    },
    include: { brand: { select: { id: true, name: true, thumbnailUrl: true } } },
  });

  await prisma.project.update({ where: { id }, data: { updatedAt: new Date() } });

  return NextResponse.json({ variation }, { status: 201 });
}
