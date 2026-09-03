import { requireSession } from "@/lib/session";
import { getAccessibleProject } from "@/lib/api-auth";
import { notFound, redirect } from "next/navigation";

export default async function LegacyEditorRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const project = await getAccessibleProject(id, session.user.id);
  if (!project) notFound();
  const first = project.variations[0];
  if (!first) notFound();
  redirect(`/projects/${id}/variations/${first.id}/editor`);
}
