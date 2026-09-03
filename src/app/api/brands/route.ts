import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/api-auth";
import { createDefaultBrandData } from "@/lib/brand-defaults";
import { BrandDataSchema } from "@/types/project";
import type { Prisma } from "@/generated/prisma/client";

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
});

export async function GET() {
  const session = await requireApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const brands = await prisma.brand.findMany({
    where: { members: { some: { userId: session.user.id } } },
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

  return NextResponse.json({ brands });
}

export async function POST(req: NextRequest) {
  const session = await requireApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = CreateSchema.parse(await req.json());
  const brandData = createDefaultBrandData();
  BrandDataSchema.parse(brandData);

  const brand = await prisma.brand.create({
    data: {
      name: body.name,
      brandData: brandData as Prisma.InputJsonValue,
      members: {
        create: {
          userId: session.user.id,
          role: "owner",
        },
      },
    },
  });

  return NextResponse.json({ brand }, { status: 201 });
}
