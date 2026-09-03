import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAccessibleBrand, requireApiSession } from "@/lib/api-auth";
import { BrandDataSchema } from "@/types/project";
import { isValidHttpUrl } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma/client";

const PatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  brandData: BrandDataSchema.optional(),
  thumbnailUrl: z.string().nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const brand = await getAccessibleBrand(id, session.user.id);
  if (!brand) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ brand });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const existing = await getAccessibleBrand(id, session.user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid brand data", details: parsed.error.issues }, { status: 400 });
  }
  const body = parsed.data;

  if (body.brandData) {
    const { appStoreUrl, googlePlayUrl, policyUrl } = body.brandData.links;
    if (!isValidHttpUrl(appStoreUrl) || !isValidHttpUrl(googlePlayUrl) || !isValidHttpUrl(policyUrl)) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }
  }

  const brand = await prisma.brand.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.brandData !== undefined ? { brandData: body.brandData as Prisma.InputJsonValue } : {}),
      ...(body.thumbnailUrl !== undefined ? { thumbnailUrl: body.thumbnailUrl } : {}),
    },
  });

  return NextResponse.json({ brand });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const existing = await getAccessibleBrand(id, session.user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.brand.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
