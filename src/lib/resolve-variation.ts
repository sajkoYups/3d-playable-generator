import { prisma } from "@/lib/db";
import { createDefaultProjectData } from "@/lib/project-defaults";
import {
  parseBrandData,
  parseOverrides,
  parseProjectData,
  resolvePlayable,
} from "@/lib/resolve-playable";
import type { ProjectData, TemplateId } from "@/types/project";

export async function resolveVariationPlayable(input: {
  projectData: unknown;
  templateId: string;
  brandId?: string | null;
  overrides?: unknown;
}): Promise<ProjectData> {
  const parsed = parseProjectData(input.projectData ?? createDefaultProjectData(input.templateId as TemplateId));
  if (!input.brandId) {
    return resolvePlayable(parsed, null, parseOverrides(input.overrides));
  }
  const brand = await prisma.brand.findUnique({ where: { id: input.brandId } });
  const brandData = brand ? parseBrandData(brand.brandData) : null;
  return resolvePlayable(parsed, brandData, parseOverrides(input.overrides));
}
