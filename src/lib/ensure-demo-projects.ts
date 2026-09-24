import { prisma } from "@/lib/db";
import { createParkingJamBirdsEyeProjectData, defaultPieceImages, defaultStarterVariations, PARKING_JAM_BIRDS_EYE_VARIATION_NAME, STACK_TOWER_CAMERA, TEMPLATE_NAMES } from "@/lib/project-defaults";
import { defaultStackRoundsPack } from "@/playable-runtime/engines/stack-tower/rounds";
import type { TemplateId } from "@/types/project";
import type { Prisma } from "@/generated/prisma/client";

const DEMO_TEMPLATES: TemplateId[] = [
  "stack-tower",
  "triple-match",
  "lane-runner",
  "parking-jam",
  "water-sort",
  "match-3",
  "solitaire",
  "tappy-plane",
  "dress-up",
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
      await tx.project.create({
        data: {
          organizationId,
          name: demoName(templateId),
          templateId,
          defaultOrientation: "portrait",
          members: { create: { userId, role: "owner" } },
          variations: {
            create: defaultStarterVariations(templateId).map((variation) => {
              variation.projectData.links.appStoreUrl = "https://apps.apple.com/app/id000000000";
              variation.projectData.links.googlePlayUrl = "https://play.google.com/store/apps/details?id=com.example.playable";
              return {
                name: variation.name,
                projectData: variation.projectData as Prisma.InputJsonValue,
                status: "ready" as const,
                overrides: {},
              };
            }),
          },
        },
      });
    }

    const stackTowerDemoIds = (demoIdsByTemplate.get("stack-tower") ?? []).filter((id) => !extra.has(id));
    if (stackTowerDemoIds.length > 0) {
      const variations = await tx.variation.findMany({
        where: { projectId: { in: stackTowerDemoIds } },
        select: { id: true, projectData: true },
      });
      for (const variation of variations) {
        const data = variation.projectData as {
          gameplay?: {
            camera?: {
              portrait?: { fov?: number; position?: { x?: number; y?: number; z?: number }; target?: { x?: number; y?: number; z?: number } };
              landscape?: { fov?: number; position?: { x?: number; y?: number; z?: number }; target?: { x?: number; y?: number; z?: number } };
            };
            stackTower?: { rounds?: unknown[]; coinImageUrl?: string };
          };
        };
        if (!data.gameplay) continue;
        let dirty = false;
        const portrait = data.gameplay.camera?.portrait;
        const farShot =
          !portrait ||
          (portrait.fov ?? 0) >= 80 ||
          (Math.abs((portrait.position?.z ?? 0) - 12) < 0.05 && Math.abs((portrait.position?.y ?? 0) - 8) < 0.05);
        if (farShot) {
          data.gameplay.camera = {
            portrait: {
              fov: STACK_TOWER_CAMERA.portrait.fov,
              position: { ...STACK_TOWER_CAMERA.portrait.position },
              target: { ...STACK_TOWER_CAMERA.portrait.target },
            },
            landscape: {
              fov: STACK_TOWER_CAMERA.landscape.fov,
              position: { ...STACK_TOWER_CAMERA.landscape.position },
              target: { ...STACK_TOWER_CAMERA.landscape.target },
            },
          };
          dirty = true;
        }
        const tower = data.gameplay.stackTower ?? (data.gameplay.stackTower = {});
        if (!tower.rounds?.length) {
          tower.rounds = defaultStackRoundsPack();
          tower.coinImageUrl = tower.coinImageUrl || "";
          dirty = true;
        }
        if (!dirty) continue;
        await tx.variation.update({
          where: { id: variation.id },
          data: { projectData: data as Prisma.InputJsonValue },
        });
      }
    }

    const parkingJamDemoIds = (demoIdsByTemplate.get("parking-jam") ?? []).filter((id) => !extra.has(id));
    for (const projectId of parkingJamDemoIds) {
      const existing = await tx.variation.findMany({
        where: { projectId },
        select: { name: true },
      });
      if (existing.some((row) => row.name === PARKING_JAM_BIRDS_EYE_VARIATION_NAME)) continue;
      const projectData = createParkingJamBirdsEyeProjectData();
      projectData.links.appStoreUrl = "https://apps.apple.com/app/id000000000";
      projectData.links.googlePlayUrl = "https://play.google.com/store/apps/details?id=com.example.playable";
      await tx.variation.create({
        data: {
          projectId,
          name: PARKING_JAM_BIRDS_EYE_VARIATION_NAME,
          projectData: projectData as Prisma.InputJsonValue,
          status: "ready",
          overrides: {},
        },
      });
    }
  });
}
