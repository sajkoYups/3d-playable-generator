import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgManagerApi } from "@/lib/api-auth";
import { createInvitation } from "@/lib/org";

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["owner", "admin", "member"]).default("member"),
});

export async function POST(req: NextRequest) {
  const authz = await requireOrgManagerApi();
  if (!authz.ok) return authz.response;

  const body = InviteSchema.parse(await req.json());
  const email = body.email.trim().toLowerCase();

  const alreadyMember = await prisma.member.findFirst({
    where: {
      organizationId: authz.organizationId,
      user: { email },
    },
  });
  if (alreadyMember) {
    return NextResponse.json({ error: "That person is already in this company" }, { status: 409 });
  }

  const { invitation, url, resent } = await createInvitation({
    organizationId: authz.organizationId,
    email,
    role: body.role,
    inviterId: authz.session.user.id,
  });

  return NextResponse.json({ invitation: { id: invitation.id, email: invitation.email, role: invitation.role, url }, resent }, { status: 201 });
}
