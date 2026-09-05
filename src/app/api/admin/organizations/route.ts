import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePlatformAdminApi } from "@/lib/api-auth";
import { createInvitation, uniqueOrgSlug } from "@/lib/org";
import { inviteUrl } from "@/lib/platform";

export async function GET() {
  const authz = await requirePlatformAdminApi();
  if (!authz.ok) return authz.response;

  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { members: true, invitations: true, projects: true } },
      invitations: {
        where: { status: "pending", expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { id: true, email: true, role: true, createdAt: true },
      },
    },
  });

  return NextResponse.json({
    organizations: organizations.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      createdAt: org.createdAt,
      memberCount: org._count.members,
      projectCount: org._count.projects,
      pendingInvites: org.invitations.map((invite) => ({
        ...invite,
        url: inviteUrl(invite.id),
      })),
    })),
  });
}

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  ownerEmail: z.string().email(),
});

export async function POST(req: NextRequest) {
  const authz = await requirePlatformAdminApi();
  if (!authz.ok) return authz.response;

  const body = CreateSchema.parse(await req.json());
  const slug = await uniqueOrgSlug(body.name);
  const organization = await prisma.organization.create({
    data: {
      name: body.name.trim(),
      slug,
    },
  });

  const { invitation, url } = await createInvitation({
    organizationId: organization.id,
    email: body.ownerEmail,
    role: "owner",
    inviterId: authz.session.user.id,
  });

  return NextResponse.json(
    {
      organization,
      invitation: { id: invitation.id, email: invitation.email, role: invitation.role, url },
    },
    { status: 201 },
  );
}
