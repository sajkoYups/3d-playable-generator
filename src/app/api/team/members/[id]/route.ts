import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgManagerApi } from "@/lib/api-auth";

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authz = await requireOrgManagerApi();
  if (!authz.ok) return authz.response;
  const { id } = await context.params;

  const member = await prisma.member.findFirst({
    where: { id, organizationId: authz.organizationId },
  });
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (member.userId === authz.session.user.id) {
    return NextResponse.json({ error: "You cannot remove yourself" }, { status: 400 });
  }
  if (member.role === "owner") {
    const owners = await prisma.member.count({
      where: { organizationId: authz.organizationId, role: "owner" },
    });
    if (owners <= 1) {
      return NextResponse.json({ error: "Keep at least one owner" }, { status: 400 });
    }
  }

  await prisma.member.delete({ where: { id } });
  await prisma.session.updateMany({
    where: { userId: member.userId, activeOrganizationId: authz.organizationId },
    data: { activeOrganizationId: null },
  });
  return NextResponse.json({ ok: true });
}
