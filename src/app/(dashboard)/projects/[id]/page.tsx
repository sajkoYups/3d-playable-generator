import { requireSession } from "@/lib/session";
import { getAccessibleProject } from "@/lib/api-auth";
import { notFound } from "next/navigation";
import { VariationGallery } from "@/features/projects/variation-gallery";
import { parseAppBrandData, parseBrandData } from "@/lib/resolve-playable";
import { DEMO_URLS } from "@/lib/project-defaults";
import type { TemplateId } from "@/types/project";

export default async function ProjectGalleryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const project = await getAccessibleProject(id, session.user.id);
  if (!project) notFound();

  const variations = project.variations.map((v) => {
    let brandLogo: string | null = null;
    if (v.brand) {
      try {
        const brand = parseBrandData(v.brand.brandData);
        brandLogo =
          brand.startScreen.elements.find((el) => el.id === "app-logo")?.content.imageUrl ||
          DEMO_URLS.appLogo;
      } catch {
        brandLogo = v.brand.thumbnailUrl;
      }
    }
    let appBrandIcon: string | null = null;
    if (v.appBrand) {
      try {
        const kit = parseAppBrandData(v.appBrand.brandData);
        appBrandIcon = kit.appIconUrl || kit.logoVerticalUrl || v.appBrand.thumbnailUrl;
      } catch {
        appBrandIcon = v.appBrand.thumbnailUrl;
      }
    }
    return {
      id: v.id,
      name: v.name,
      status: v.status,
      updatedAt: v.updatedAt,
      thumbnailUrl: v.thumbnailUrl,
      brandId: v.brandId,
      brandName: v.brand?.name ?? null,
      brandLogo,
      appBrandId: v.appBrandId,
      appBrandName: v.appBrand?.name ?? null,
      appBrandIcon,
    };
  });

  return (
    <VariationGallery
      project={{
        id: project.id,
        name: project.name,
        templateId: project.templateId as TemplateId,
        defaultOrientation: project.defaultOrientation,
      }}
      variations={variations}
    />
  );
}
