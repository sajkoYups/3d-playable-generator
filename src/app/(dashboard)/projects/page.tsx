import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { ProjectsDashboard } from "@/features/projects/projects-dashboard";
import { ensureDemoProjects } from "@/lib/ensure-demo-projects";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireSession();
  const { q } = await searchParams;

  await ensureDemoProjects(session.user.id);

  const projects = await prisma.project.findMany({
    where: {
      members: { some: { userId: session.user.id } },
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

  return <ProjectsDashboard projects={projects} initialQuery={q || ""} />;
}
