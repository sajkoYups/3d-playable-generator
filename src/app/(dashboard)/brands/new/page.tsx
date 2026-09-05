import { redirect } from "next/navigation";
import { requireOrganization } from "@/lib/session";
import { prisma } from "@/lib/db";
import { createDefaultAppBrandData } from "@/lib/app-brand-defaults";
import type { Prisma } from "@/generated/prisma/client";

export default async function NewBrandPage() {
  const { session, organizationId } = await requireOrganization();
  const brandData = createDefaultAppBrandData();
  const brand = await prisma.appBrand.create({
    data: {
      organizationId,
      name: "Untitled brand",
      brandData: brandData as Prisma.InputJsonValue,
      members: {
        create: { userId: session.user.id, role: "owner" },
      },
    },
  });
  redirect(`/brands/${brand.id}`);
}
