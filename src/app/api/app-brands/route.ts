import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgApi } from "@/lib/api-auth";
import { createDefaultAppBrandData } from "@/lib/app-brand-defaults";
import { AppBrandDataSchema } from "@/types/project";
import type { Prisma } from "@/generated/prisma/client";

const CreateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  brandData: AppBrandDataSchema.optional(),
});

export async function GET() {
  const authz = await requireOrgApi();
  if (!authz.ok) return authz.response;

  const brands = await prisma.appBrand.findMany({
    where: { organizationId: authz.organizationId },
    select: {
      id: true,
      name: true,
      brandData: true,
      thumbnailUrl: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { variations: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ brands });
}

export async function POST(req: NextRequest) {
  const authz = await requireOrgApi();
  if (!authz.ok) return authz.response;

  const body = CreateSchema.parse(await req.json().catch(() => ({})));
  const brandData = createDefaultAppBrandData(body.brandData);
  const name = body.name?.trim() || brandData.appName.trim() || "Untitled brand";

  const brand = await prisma.appBrand.create({
    data: {
      organizationId: authz.organizationId,
      name,
      brandData: brandData as Prisma.InputJsonValue,
      thumbnailUrl: brandData.appIconUrl || null,
      members: {
        create: {
          userId: authz.session.user.id,
          role: "owner",
        },
      },
    },
  });

  return NextResponse.json({ brand }, { status: 201 });
}
