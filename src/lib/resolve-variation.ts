import { prisma } from "@/lib/db";
import { createDefaultProjectData } from "@/lib/project-defaults";
import {
  parseAppBrandData,
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
  appBrandId?: string | null;
  overrides?: unknown;
}): Promise<ProjectData> {
  const parsed = parseProjectData(input.projectData ?? createDefaultProjectData(input.templateId as TemplateId));
  const brand = input.brandId
    ? await prisma.brand.findUnique({ where: { id: input.brandId } })
    : null;
  const brandData = brand ? parseBrandData(brand.brandData) : null;
  const appBrand = input.appBrandId
    ? await prisma.appBrand.findUnique({ where: { id: input.appBrandId } })
    : null;
  const appBrandData = appBrand ? parseAppBrandData(appBrand.brandData) : null;
  return resolvePlayable(parsed, brandData, parseOverrides(input.overrides), appBrandData);
}
