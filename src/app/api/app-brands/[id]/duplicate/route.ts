import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAccessibleAppBrand, requireApiSession } from "@/lib/api-auth";
import { parseAppBrandData } from "@/lib/resolve-playable";
import type { Prisma } from "@/generated/prisma/client";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const existing = await getAccessibleAppBrand(id, session.user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const brandData = parseAppBrandData(existing.brandData);
  const brand = await prisma.appBrand.create({
    data: {
      name: `${existing.name} (Copy)`,
      brandData: brandData as Prisma.InputJsonValue,
      thumbnailUrl: existing.thumbnailUrl,
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
