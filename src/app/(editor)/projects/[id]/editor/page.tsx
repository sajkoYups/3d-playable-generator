import { requireSession } from "@/lib/session";
import { getAccessibleProject } from "@/lib/api-auth";
import { notFound } from "next/navigation";
import { EditorShell } from "@/features/editor/editor-shell";
import { ProjectDataSchema, type Orientation, type TemplateId } from "@/types/project";
import { createDefaultProjectData } from "@/lib/project-defaults";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const project = await getAccessibleProject(id, session.user.id);
  if (!project) notFound();

  const templateId = project.templateId as TemplateId;
  const parsed = ProjectDataSchema.safeParse(project.projectData);
  const data = parsed.success ? parsed.data : createDefaultProjectData(templateId);

  return (
    <EditorShell
      projectId={project.id}
      projectName={project.name}
      templateId={templateId}
      defaultOrientation={project.defaultOrientation as Orientation}
      initialData={data}
    />
  );
}
