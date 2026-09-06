import { prisma } from "@/lib/db";
import { createDefaultProjectData, defaultPieceImages, TEMPLATE_NAMES } from "@/lib/project-defaults";
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
  "triple-match": ["Triple Match 3D Demo"],
};

const TRIPLE_MATCH_DISPLAY_FROM = "Triple Match 3D";
const TRIPLE_MATCH_DISPLAY_TO = "Triple Stack 3D";

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

    const tripleMatchDemoIds = (demoIdsByTemplate.get("triple-match") ?? []).filter((id) => !extra.has(id));
    if (tripleMatchDemoIds.length > 0) {
      const variations = await tx.variation.findMany({
        where: { projectId: { in: tripleMatchDemoIds } },
        select: { id: true, projectData: true },
      });
      for (const variation of variations) {
        const raw = JSON.stringify(variation.projectData);
        if (!raw.includes(TRIPLE_MATCH_DISPLAY_FROM)) continue;
        await tx.variation.update({
          where: { id: variation.id },
          data: {
            projectData: JSON.parse(raw.replaceAll(TRIPLE_MATCH_DISPLAY_FROM, TRIPLE_MATCH_DISPLAY_TO)) as Prisma.InputJsonValue,
          },
        });
      }
    }

    const match3DemoIds = (demoIdsByTemplate.get("match-3") ?? []).filter((id) => !extra.has(id));
    if (match3DemoIds.length > 0) {
      const variations = await tx.variation.findMany({
        where: { projectId: { in: match3DemoIds } },
        select: { id: true, projectData: true },
      });
      const nextPieces = defaultPieceImages();
      for (const variation of variations) {
        const raw = JSON.stringify(variation.projectData);
        const swappedHand = raw.replaceAll("/demo-assets/hand.svg", "/demo-assets/pointer-hand.svg");
        const data = JSON.parse(swappedHand) as {
          gameplay?: { pieceImages?: string[] };
        };
        const pieces = data.gameplay?.pieceImages ?? [];
        const needsPieces =
          pieces.some((url) => url.includes("/demo-assets/pieces/")) || !pieces.some(Boolean);
        if (needsPieces && data.gameplay) data.gameplay.pieceImages = nextPieces;
        if (!needsPieces && swappedHand === raw) continue;
        await tx.variation.update({
          where: { id: variation.id },
          data: { projectData: data as Prisma.InputJsonValue },
        });
      }
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
