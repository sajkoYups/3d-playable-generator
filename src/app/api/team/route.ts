import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgApi, requireOrgManagerApi } from "@/lib/api-auth";
import { getOrgMembership } from "@/lib/org";
import { inviteUrl } from "@/lib/platform";

export async function GET() {
  const authz = await requireOrgApi();
  if (!authz.ok) return authz.response;

  const membership = await getOrgMembership(authz.session.user.id, authz.organizationId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [organization, members, invitations] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: authz.organizationId },
      select: { id: true, name: true, slug: true },
    }),
    prisma.member.findMany({
      where: { organizationId: authz.organizationId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: { organizationId: authz.organizationId, status: "pending" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    organization,
    role: membership.role,
    canManage: membership.role === "owner" || membership.role === "admin",
    members: members.map((m) => ({
      id: m.id,
      role: m.role,
      createdAt: m.createdAt,
      user: m.user,
    })),
    invitations: invitations.map((invite) => ({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      url: inviteUrl(invite.id),
    })),
  });
}

const PatchSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export async function PATCH(req: NextRequest) {
  const authz = await requireOrgManagerApi();
  if (!authz.ok) return authz.response;

  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a company name" }, { status: 400 });
  }

  const organization = await prisma.organization.update({
    where: { id: authz.organizationId },
    data: { name: parsed.data.name },
    select: { id: true, name: true, slug: true },
  });

  return NextResponse.json({ organization });
}
