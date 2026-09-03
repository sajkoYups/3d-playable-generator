import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { headers } from "next/headers";

export async function requireApiSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return null;
  }
  return session;
}

export async function getAccessibleProject(projectId: string, userId: string) {
  return prisma.project.findFirst({
    where: {
      id: projectId,
      members: { some: { userId } },
    },
    include: {
      members: true,
      assets: { orderBy: { createdAt: "desc" } },
      variations: {
        orderBy: { updatedAt: "desc" },
        include: { brand: true, appBrand: true },
      },
    },
  });
}

export async function getAccessibleVariation(projectId: string, variationId: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      members: { some: { userId } },
    },
  });
  if (!project) return null;
  const variation = await prisma.variation.findFirst({
    where: { id: variationId, projectId },
    include: { brand: true, appBrand: true },
  });
  if (!variation) return null;
  return { project, variation };
}

export async function getAccessibleBrand(brandId: string, userId: string) {
  return prisma.brand.findFirst({
    where: {
      id: brandId,
      members: { some: { userId } },
    },
    include: {
      members: true,
      assets: { orderBy: { createdAt: "desc" } },
      variations: {
        include: {
          project: { select: { id: true, name: true, templateId: true } },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });
}

export async function getAccessibleAppBrand(appBrandId: string, userId: string) {
  return prisma.appBrand.findFirst({
    where: {
      id: appBrandId,
      members: { some: { userId } },
    },
    include: {
      members: true,
      assets: { orderBy: { createdAt: "desc" } },
      variations: {
        include: {
          project: { select: { id: true, name: true, templateId: true } },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });
}
