import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAccessibleProject, requireOrgApi } from "@/lib/api-auth";

const PatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  defaultOrientation: z.enum(["portrait", "landscape"]).optional(),
});

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authz = await requireOrgApi();
  if (!authz.ok) return authz.response;
  const { id } = await context.params;
  const project = await getAccessibleProject(id, authz.organizationId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ project });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authz = await requireOrgApi();
  if (!authz.ok) return authz.response;
  const { id } = await context.params;
  const existing = await getAccessibleProject(id, authz.organizationId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid project data", details: parsed.error.issues }, { status: 400 });
  }
  const body = parsed.data;

  const project = await prisma.project.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.defaultOrientation !== undefined
        ? { defaultOrientation: body.defaultOrientation }
        : {}),
    },
  });

  return NextResponse.json({ project });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authz = await requireOrgApi();
  if (!authz.ok) return authz.response;
  const { id } = await context.params;
  const existing = await getAccessibleProject(id, authz.organizationId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
