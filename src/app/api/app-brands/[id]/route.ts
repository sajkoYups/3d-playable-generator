import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAccessibleAppBrand, requireOrgApi } from "@/lib/api-auth";
import { AppBrandDataSchema } from "@/types/project";
import { isValidHttpUrl } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma/client";

const PatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  brandData: AppBrandDataSchema.optional(),
  thumbnailUrl: z.string().nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authz = await requireOrgApi();
  if (!authz.ok) return authz.response;
  const { id } = await context.params;
  const brand = await getAccessibleAppBrand(id, authz.organizationId);
  if (!brand) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ brand });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authz = await requireOrgApi();
  if (!authz.ok) return authz.response;
  const { id } = await context.params;
  const existing = await getAccessibleAppBrand(id, authz.organizationId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid brand data", details: parsed.error.issues }, { status: 400 });
  }
  const body = parsed.data;

  if (body.brandData) {
    if (!isValidHttpUrl(body.brandData.appStoreUrl) || !isValidHttpUrl(body.brandData.googlePlayUrl)) {
      return NextResponse.json({ error: "Invalid store URL" }, { status: 400 });
    }
  }

  const name = body.name?.trim() || body.brandData?.appName.trim();
  const thumbnailUrl =
    body.thumbnailUrl !== undefined
      ? body.thumbnailUrl
      : body.brandData?.appIconUrl || undefined;

  const brand = await prisma.appBrand.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      ...(body.brandData !== undefined ? { brandData: body.brandData as Prisma.InputJsonValue } : {}),
      ...(thumbnailUrl !== undefined ? { thumbnailUrl } : {}),
    },
  });

  return NextResponse.json({ brand });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authz = await requireOrgApi();
  if (!authz.ok) return authz.response;
  const { id } = await context.params;
  const existing = await getAccessibleAppBrand(id, authz.organizationId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.appBrand.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
