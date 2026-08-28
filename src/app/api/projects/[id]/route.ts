import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAccessibleProject, requireApiSession } from "@/lib/api-auth";
import { ProjectDataSchema } from "@/types/project";
import { isValidHttpUrl } from "@/lib/utils";

const PatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  projectData: ProjectDataSchema.optional(),
  status: z.enum(["draft", "ready", "exported"]).optional(),
  thumbnailUrl: z.string().nullable().optional(),
  defaultOrientation: z.enum(["portrait", "landscape"]).optional(),
});

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const project = await getAccessibleProject(id, session.user.id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ project });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const existing = await getAccessibleProject(id, session.user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid project data", details: parsed.error.issues }, { status: 400 });
  }
  const body = parsed.data;

  if (body.projectData) {
    const { appStoreUrl, googlePlayUrl } = body.projectData.links;
    if (!isValidHttpUrl(appStoreUrl) || !isValidHttpUrl(googlePlayUrl)) {
      return NextResponse.json({ error: "Invalid store URL" }, { status: 400 });
    }
  }

  const project = await prisma.project.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.projectData !== undefined ? { projectData: body.projectData } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.thumbnailUrl !== undefined ? { thumbnailUrl: body.thumbnailUrl } : {}),
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
  const session = await requireApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const existing = await getAccessibleProject(id, session.user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
