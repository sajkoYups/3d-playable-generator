import { prisma } from "@/lib/db";
import { createDefaultProjectData, TEMPLATE_NAMES } from "@/lib/project-defaults";
import type { TemplateId } from "@/types/project";

const DEMO_TEMPLATES: TemplateId[] = ["stack-tower", "triple-match", "lane-runner", "parking-jam", "tower-defense"];

export async function ensureDemoProjects(userId: string) {
  const existing = await prisma.project.findMany({
    where: { members: { some: { userId } } },
    select: { templateId: true },
  });
  const present = new Set(existing.map((p) => p.templateId));

  for (const templateId of DEMO_TEMPLATES) {
    if (present.has(templateId)) continue;
    const projectData = createDefaultProjectData(templateId);
    projectData.links.appStoreUrl = "https://apps.apple.com/app/id000000000";
    projectData.links.googlePlayUrl = "https://play.google.com/store/apps/details?id=com.example.playable";
    await prisma.project.create({
      data: {
        name: `${TEMPLATE_NAMES[templateId]} Demo`,
        templateId,
        defaultOrientation: "portrait",
        projectData,
        status: "ready",
        members: { create: { userId, role: "owner" } },
      },
    });
  }
}
