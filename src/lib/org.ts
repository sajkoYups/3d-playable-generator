import { prisma } from "@/lib/db";
import { inviteUrl, slugifyOrgName } from "@/lib/platform";

type OrgSession = {
  user: { id: string };
  session: { id: string; activeOrganizationId?: string | null };
};

export const ORG_ROLES = ["owner", "admin", "member"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export function canManageOrg(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

export async function uniqueOrgSlug(name: string): Promise<string> {
  const base = slugifyOrgName(name);
  for (let i = 0; i < 8; i++) {
    const slug = i === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (!existing) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function getOrgMembership(userId: string, organizationId: string) {
  return prisma.member.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
}

export async function ensureActiveOrganization(session: OrgSession): Promise<string | null> {
  const userId = session.user.id;
  const activeId = session.session.activeOrganizationId;
  if (activeId) {
    const still = await prisma.member.findUnique({
      where: { organizationId_userId: { organizationId: activeId, userId } },
    });
    if (still) return activeId;
  }

  const first = await prisma.member.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  if (!first) {
    if (activeId) {
      await prisma.session.update({
        where: { id: session.session.id },
        data: { activeOrganizationId: null },
      });
    }
    return null;
  }

  if (first.organizationId !== activeId) {
    await prisma.session.update({
      where: { id: session.session.id },
      data: { activeOrganizationId: first.organizationId },
    });
  }
  return first.organizationId;
}

export async function createInvitation(input: {
  organizationId: string;
  email: string;
  role: OrgRole;
  inviterId: string;
}) {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.invitation.findFirst({
    where: {
      organizationId: input.organizationId,
      email,
      status: "pending",
      expiresAt: { gt: new Date() },
    },
  });
  if (existing) {
    return { invitation: existing, url: inviteUrl(existing.id), resent: true };
  }

  const invitation = await prisma.invitation.create({
    data: {
      organizationId: input.organizationId,
      email,
      role: input.role,
      status: "pending",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      inviterId: input.inviterId,
    },
  });
  return { invitation, url: inviteUrl(invitation.id), resent: false };
}
