import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgApi } from "@/lib/api-auth";
import { createDefaultBrandData } from "@/lib/brand-defaults";
import { BrandDataSchema } from "@/types/project";
import type { Prisma } from "@/generated/prisma/client";

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
});

export async function GET() {
  const authz = await requireOrgApi();
  if (!authz.ok) return authz.response;

  const brands = await prisma.brand.findMany({
    where: { organizationId: authz.organizationId },
    select: {
      id: true,
      name: true,
      thumbnailUrl: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { variations: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ brands, templates: brands });
}

export async function POST(req: NextRequest) {
  const authz = await requireOrgApi();
  if (!authz.ok) return authz.response;

  const body = CreateSchema.parse(await req.json());
  const brandData = createDefaultBrandData();
  BrandDataSchema.parse(brandData);

  const brand = await prisma.brand.create({
    data: {
      organizationId: authz.organizationId,
      name: body.name,
      brandData: brandData as Prisma.InputJsonValue,
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
