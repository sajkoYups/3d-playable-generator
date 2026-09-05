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
  organizationId?: string;
}): Promise<ProjectData> {
  const parsed = parseProjectData(input.projectData ?? createDefaultProjectData(input.templateId as TemplateId));
  const brand = input.brandId
    ? await prisma.brand.findFirst({
        where: {
          id: input.brandId,
          ...(input.organizationId ? { organizationId: input.organizationId } : {}),
        },
      })
    : null;
  const brandData = brand ? parseBrandData(brand.brandData) : null;
  const appBrand = input.appBrandId
    ? await prisma.appBrand.findFirst({
        where: {
          id: input.appBrandId,
          ...(input.organizationId ? { organizationId: input.organizationId } : {}),
        },
      })
    : null;
  const appBrandData = appBrand ? parseAppBrandData(appBrand.brandData) : null;
  return resolvePlayable(parsed, brandData, parseOverrides(input.overrides), appBrandData);
}
