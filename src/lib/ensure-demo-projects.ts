import { prisma } from "@/lib/db";
import { createDefaultProjectData, TEMPLATE_NAMES } from "@/lib/project-defaults";
import type { TemplateId } from "@/types/project";
import type { Prisma } from "@/generated/prisma/client";

const DEMO_TEMPLATES: TemplateId[] = [
  "stack-tower",
  "triple-match",
  "lane-runner",
  "parking-jam",
  "water-sort",
  "match-3",
];

const DEMO_LOCK_NAMESPACE = 872314;

function demoName(templateId: TemplateId) {
  return `${TEMPLATE_NAMES[templateId]} Demo`;
}

const DEMO_NAME_ALIASES: Partial<Record<TemplateId, readonly string[]>> = {
  "lane-runner": ["Lane Runner Demo"],
};

function isDemoProjectName(templateId: string, name: string) {
  const id = templateId as TemplateId;
  if (!TEMPLATE_NAMES[id]) return false;
  if (name === demoName(id)) return true;
  return DEMO_NAME_ALIASES[id]?.includes(name) ?? false;
}

export async function ensureDemoProjects(organizationId: string, userId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${DEMO_LOCK_NAMESPACE}, hashtext(${organizationId}))`;

    const existing = await tx.project.findMany({
      where: { organizationId },
      select: { id: true, templateId: true, name: true },
      orderBy: { createdAt: "asc" },
    });

    const extraIds: string[] = [];
    const present = new Set<string>();
    const demoIdsByTemplate = new Map<string, string[]>();
    const renameIds: { id: string; name: string }[] = [];

    for (const project of existing) {
      const tid = project.templateId as TemplateId;
      if (isDemoProjectName(project.templateId, project.name)) {
        const ids = demoIdsByTemplate.get(project.templateId) ?? [];
        ids.push(project.id);
        demoIdsByTemplate.set(project.templateId, ids);
        const nextName = demoName(tid);
        if (project.name !== nextName) {
          renameIds.push({ id: project.id, name: nextName });
        }
      } else {
        present.add(project.templateId);
      }
    }

    for (const [templateId, ids] of demoIdsByTemplate) {
      present.add(templateId);
      extraIds.push(...ids.slice(1));
    }

    if (extraIds.length > 0) {
      await tx.project.deleteMany({ where: { id: { in: extraIds } } });
    }

    const extra = new Set(extraIds);
    for (const row of renameIds) {
      if (extra.has(row.id)) continue;
      await tx.project.update({ where: { id: row.id }, data: { name: row.name } });
    }

    for (const templateId of DEMO_TEMPLATES) {
      if (present.has(templateId)) continue;
      const projectData = createDefaultProjectData(templateId);
      projectData.links.appStoreUrl = "https://apps.apple.com/app/id000000000";
      projectData.links.googlePlayUrl = "https://play.google.com/store/apps/details?id=com.example.playable";
      await tx.project.create({
        data: {
          organizationId,
          name: demoName(templateId),
          templateId,
          defaultOrientation: "portrait",
          members: { create: { userId, role: "owner" } },
          variations: {
            create: {
              name: "Default",
              projectData: projectData as Prisma.InputJsonValue,
              status: "ready",
              overrides: {},
            },
          },
        },
      });
    }
  });
}
