import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAccessibleVariation, requireOrgApi } from "@/lib/api-auth";
import {
  OVERRIDABLE_SLOT_IDS,
  ProjectDataSchema,
  VariationOverridesSchema,
} from "@/types/project";
import { extractOverrides, parseBrandData, parseOverrides } from "@/lib/resolve-playable";
import { resolveVariationPlayable } from "@/lib/resolve-variation";
import { isValidHttpUrl } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma/client";

const PatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  projectData: ProjectDataSchema.optional(),
  overrides: VariationOverridesSchema.optional(),
  brandId: z.string().nullable().optional(),
  appBrandId: z.string().nullable().optional(),
  status: z.enum(["draft", "ready", "exported"]).optional(),
  thumbnailUrl: z.string().nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string; vid: string }> },
) {
  const authz = await requireOrgApi();
  if (!authz.ok) return authz.response;
  const { id, vid } = await context.params;
  const access = await getAccessibleVariation(id, vid, authz.organizationId);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const resolved = await resolveVariationPlayable({
    projectData: access.variation.projectData,
    templateId: access.project.templateId,
    brandId: access.variation.brandId,
    appBrandId: access.variation.appBrandId,
    overrides: access.variation.overrides,
    organizationId: authz.organizationId,
  });

  return NextResponse.json({
    project: access.project,
    variation: access.variation,
    resolved,
  });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; vid: string }> },
) {
  const authz = await requireOrgApi();
  if (!authz.ok) return authz.response;
  const { id, vid } = await context.params;
  const access = await getAccessibleVariation(id, vid, authz.organizationId);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid variation data", details: parsed.error.issues }, { status: 400 });
  }
  const body = parsed.data;

  if (body.projectData) {
    const { appStoreUrl, googlePlayUrl, policyUrl } = body.projectData.links;
    if (!isValidHttpUrl(appStoreUrl) || !isValidHttpUrl(googlePlayUrl) || !isValidHttpUrl(policyUrl)) {
      return NextResponse.json({ error: "Invalid store URL" }, { status: 400 });
    }
  }

  if (body.brandId !== undefined && body.brandId !== null) {
    const brand = await prisma.brand.findFirst({
      where: { id: body.brandId, organizationId: authz.organizationId },
    });
    if (!brand) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  if (body.appBrandId !== undefined && body.appBrandId !== null) {
    const appBrand = await prisma.appBrand.findFirst({
      where: { id: body.appBrandId, organizationId: authz.organizationId },
    });
    if (!appBrand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  let overrides = body.overrides;
  if (body.brandId !== undefined && body.overrides === undefined) {
    overrides = { elements: {}, unlockedSlotIds: [] };
  } else if (body.projectData) {
    const brandId = body.brandId !== undefined ? body.brandId : access.variation.brandId;
    const brandRow =
      brandId === access.variation.brandId
        ? access.variation.brand
        : brandId
          ? await prisma.brand.findFirst({
              where: { id: brandId, organizationId: authz.organizationId },
            })
          : null;
    const brandData = brandRow ? parseBrandData(brandRow.brandData) : null;
    const previous = parseOverrides(body.overrides ?? access.variation.overrides);
    overrides = extractOverrides(body.projectData, brandData, OVERRIDABLE_SLOT_IDS, previous);
  }

  const variation = await prisma.variation.update({
    where: { id: vid },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.projectData !== undefined
        ? { projectData: body.projectData as Prisma.InputJsonValue }
        : {}),
      ...(overrides !== undefined ? { overrides: overrides as Prisma.InputJsonValue } : {}),
      ...(body.brandId !== undefined ? { brandId: body.brandId } : {}),
      ...(body.appBrandId !== undefined ? { appBrandId: body.appBrandId } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.thumbnailUrl !== undefined ? { thumbnailUrl: body.thumbnailUrl } : {}),
    },
    include: { brand: true, appBrand: true },
  });

  await prisma.project.update({ where: { id }, data: { updatedAt: new Date() } });

  const resolved = await resolveVariationPlayable({
    projectData: variation.projectData,
    templateId: access.project.templateId,
    brandId: variation.brandId,
    appBrandId: variation.appBrandId,
    overrides: variation.overrides ?? parseOverrides(overrides),
    organizationId: authz.organizationId,
  });

  return NextResponse.json({ variation, resolved });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; vid: string }> },
) {
  const authz = await requireOrgApi();
  if (!authz.ok) return authz.response;
  const { id, vid } = await context.params;
  const access = await getAccessibleVariation(id, vid, authz.organizationId);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const remaining = await prisma.variation.count({ where: { projectId: id } });
  if (remaining <= 1) {
    return NextResponse.json({ error: "A project needs at least one variation" }, { status: 400 });
  }

  await prisma.variation.delete({ where: { id: vid } });
  await prisma.project.update({ where: { id }, data: { updatedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
