import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAccessibleAppBrand, requireOrgApi } from "@/lib/api-auth";
import { parseAppBrandData } from "@/lib/resolve-playable";
import type { Prisma } from "@/generated/prisma/client";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authz = await requireOrgApi();
  if (!authz.ok) return authz.response;
  const { id } = await context.params;
  const existing = await getAccessibleAppBrand(id, authz.organizationId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const brandData = parseAppBrandData(existing.brandData);
  const brand = await prisma.appBrand.create({
    data: {
      organizationId: authz.organizationId,
      name: `${existing.name} (Copy)`,
      brandData: brandData as Prisma.InputJsonValue,
      thumbnailUrl: existing.thumbnailUrl,
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
