import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAccessibleProject, requireApiSession } from "@/lib/api-auth";
import { createDefaultProjectData } from "@/lib/project-defaults";
import type { ProjectData, TemplateId } from "@/types/project";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const existing = await getAccessibleProject(id, session.user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const templateId = existing.templateId as TemplateId;
  const data = (existing.projectData as ProjectData) || createDefaultProjectData(templateId);

  const project = await prisma.project.create({
    data: {
      name: `${existing.name} (Copy)`,
      templateId: existing.templateId,
      defaultOrientation: existing.defaultOrientation,
      projectData: data,
      thumbnailUrl: existing.thumbnailUrl,
      status: "draft",
      members: {
        create: {
          userId: session.user.id,
          role: "owner",
        },
      },
    },
  });

  return NextResponse.json({ project }, { status: 201 });
}
