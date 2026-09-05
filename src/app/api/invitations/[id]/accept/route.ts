import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/api-auth";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const invitation = await prisma.invitation.findUnique({
    where: { id },
    include: { organization: { select: { id: true, name: true } } },
  });
  if (!invitation || invitation.status !== "pending" || invitation.expiresAt <= new Date()) {
    return NextResponse.json({ error: "Invitation is invalid or expired" }, { status: 404 });
  }
  if (invitation.email.toLowerCase() !== session.user.email.toLowerCase()) {
    return NextResponse.json({ error: "This invite was sent to a different email" }, { status: 403 });
  }

  await prisma.member.upsert({
    where: {
      organizationId_userId: {
        organizationId: invitation.organizationId,
        userId: session.user.id,
      },
    },
    create: {
      organizationId: invitation.organizationId,
      userId: session.user.id,
      role: invitation.role || "member",
    },
    update: {},
  });

  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { status: "accepted" },
  });

  await prisma.session.update({
    where: { id: session.session.id },
    data: { activeOrganizationId: invitation.organizationId },
  });

  return NextResponse.json({
    ok: true,
    organizationId: invitation.organizationId,
    organizationName: invitation.organization.name,
  });
}
