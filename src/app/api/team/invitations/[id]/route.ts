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

  const invitation = await prisma.invitation.findFirst({
    where: { id, organizationId: authz.organizationId },
  });
  if (!invitation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.invitation.update({
    where: { id },
    data: { status: "canceled" },
  });
  return NextResponse.json({ ok: true });
}
