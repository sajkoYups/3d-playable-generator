import { requireOrganization } from "@/lib/session";
import { prisma } from "@/lib/db";
import { ProjectsDashboard } from "@/features/projects/projects-dashboard";
import { ensureDemoProjects } from "@/lib/ensure-demo-projects";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { session, organizationId } = await requireOrganization();
  const { q } = await searchParams;

  await ensureDemoProjects(organizationId, session.user.id);

  const projects = await prisma.project.findMany({
    where: {
      organizationId,
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    },
    include: {
      _count: { select: { variations: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <ProjectsDashboard
      projects={projects.map((p) => ({
        id: p.id,
        name: p.name,
        templateId: p.templateId,
        thumbnailUrl: null,
        status: "draft",
        updatedAt: p.updatedAt,
        variationCount: p._count.variations,
      }))}
      initialQuery={q || ""}
    />
  );
}
