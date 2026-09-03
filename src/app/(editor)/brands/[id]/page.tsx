import { requireSession } from "@/lib/session";
import { getAccessibleBrand } from "@/lib/api-auth";
import { notFound } from "next/navigation";
import { EditorShell } from "@/features/editor/editor-shell";
import { brandDataToProjectData, createDefaultBrandData } from "@/lib/brand-defaults";
import { parseBrandData } from "@/lib/resolve-playable";

export default async function BrandStudioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const brand = await getAccessibleBrand(id, session.user.id);
  if (!brand) notFound();

  const parsed = (() => {
    try {
      return parseBrandData(brand.brandData);
    } catch {
      return createDefaultBrandData();
    }
  })();

  return (
    <EditorShell
      projectId=""
      projectName={brand.name}
      galleryName="Brands"
      templateId="stack-tower"
      defaultOrientation="portrait"
      initialData={brandDataToProjectData(parsed)}
      brandId={brand.id}
      brandName={brand.name}
      editorMode="brand"
    />
  );
}
