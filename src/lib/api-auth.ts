import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { ensureActiveOrganization, getOrgMembership } from "@/lib/org";
import { isPlatformAdminEmail } from "@/lib/platform";
import type { Session } from "@/lib/auth";

export async function requireApiSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return null;
  }
  return session;
}

export async function requireOrgApi(): Promise<
  | { ok: true; session: Session; organizationId: string }
  | { ok: false; response: NextResponse }
> {
  const session = await requireApiSession();
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const organizationId = await ensureActiveOrganization(session);
  if (!organizationId) {
    return { ok: false, response: NextResponse.json({ error: "No organization" }, { status: 403 }) };
  }
  return { ok: true, session, organizationId };
}

export async function requirePlatformAdminApi(): Promise<
  | { ok: true; session: Session }
  | { ok: false; response: NextResponse }
> {
  const session = await requireApiSession();
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!isPlatformAdminEmail(session.user.email)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, session };
}

export async function requireOrgManagerApi(): Promise<
  | { ok: true; session: Session; organizationId: string; role: string }
  | { ok: false; response: NextResponse }
> {
  const authz = await requireOrgApi();
  if (!authz.ok) return authz;
  const membership = await getOrgMembership(authz.session.user.id, authz.organizationId);
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, session: authz.session, organizationId: authz.organizationId, role: membership.role };
}

export async function getAccessibleProject(projectId: string, organizationId: string) {
  return prisma.project.findFirst({
    where: {
      id: projectId,
      organizationId,
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

export async function getAccessibleVariation(projectId: string, variationId: string, organizationId: string) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      organizationId,
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

export async function getAccessibleBrand(brandId: string, organizationId: string) {
  return prisma.brand.findFirst({
    where: {
      id: brandId,
      organizationId,
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

export async function getAccessibleAppBrand(appBrandId: string, organizationId: string) {
  return prisma.appBrand.findFirst({
    where: {
      id: appBrandId,
      organizationId,
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
