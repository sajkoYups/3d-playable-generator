import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/api-auth";
import { createDefaultProjectData } from "@/lib/project-defaults";
import { ensureDemoProjects } from "@/lib/ensure-demo-projects";
import { TemplateIdSchema, OrientationSchema, ProjectDataSchema } from "@/types/project";
import { isValidHttpUrl } from "@/lib/utils";

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  templateId: TemplateIdSchema,
  defaultOrientation: OrientationSchema.default("portrait"),
  appStoreUrl: z.string().optional().default(""),
  googlePlayUrl: z.string().optional().default(""),
});

export async function GET(req: NextRequest) {
  const session = await requireApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureDemoProjects(session.user.id);

  const q = req.nextUrl.searchParams.get("q")?.trim() || "";

  const projects = await prisma.project.findMany({
    where: {
      members: { some: { userId: session.user.id } },
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const session = await requireApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = CreateSchema.parse(await req.json());

  if (!isValidHttpUrl(body.appStoreUrl) || !isValidHttpUrl(body.googlePlayUrl)) {
    return NextResponse.json({ error: "Invalid store URL" }, { status: 400 });
  }

  const projectData = createDefaultProjectData(body.templateId);
  projectData.links.appStoreUrl = body.appStoreUrl || "";
  projectData.links.googlePlayUrl = body.googlePlayUrl || "";
  ProjectDataSchema.parse(projectData);

  const project = await prisma.project.create({
    data: {
      name: body.name,
      templateId: body.templateId,
      defaultOrientation: body.defaultOrientation,
      projectData,
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
