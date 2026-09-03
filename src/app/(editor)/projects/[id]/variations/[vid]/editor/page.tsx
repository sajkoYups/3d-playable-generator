import { requireSession } from "@/lib/session";
import { getAccessibleVariation } from "@/lib/api-auth";
import { notFound } from "next/navigation";
import { EditorShell } from "@/features/editor/editor-shell";
import { parseBrandData, parseOverrides, parseProjectData, resolvePlayable } from "@/lib/resolve-playable";
import { createDefaultProjectData } from "@/lib/project-defaults";
import type { Orientation, TemplateId } from "@/types/project";

export default async function VariationEditorPage({
  params,
}: {
  params: Promise<{ id: string; vid: string }>;
}) {
  const session = await requireSession();
  const { id, vid } = await params;
  const access = await getAccessibleVariation(id, vid, session.user.id);
  if (!access) notFound();

  const templateId = access.project.templateId as TemplateId;
  const stored = (() => {
    try {
      return parseProjectData(access.variation.projectData);
    } catch {
      return createDefaultProjectData(templateId);
    }
  })();
  const brandData = access.variation.brand
    ? parseBrandData(access.variation.brand.brandData)
    : null;
  const data = resolvePlayable(stored, brandData, parseOverrides(access.variation.overrides));

  return (
    <EditorShell
      projectId={access.project.id}
      variationId={access.variation.id}
      projectName={access.variation.name}
      galleryName={access.project.name}
      templateId={templateId}
      defaultOrientation={access.project.defaultOrientation as Orientation}
      initialData={data}
      brandId={access.variation.brandId}
      brandName={access.variation.brand?.name ?? null}
      editorMode="playable"
    />
  );
}
