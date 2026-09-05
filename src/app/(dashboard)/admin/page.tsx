import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { inviteUrl, isPlatformAdminEmail } from "@/lib/platform";
import { prisma } from "@/lib/db";
import { AdminOrganizations } from "@/features/admin/admin-organizations";

export default async function AdminPage() {
  const session = await requireSession();
  if (!isPlatformAdminEmail(session.user.email)) {
    redirect("/projects");
  }

  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { members: true, projects: true } },
      invitations: {
        where: { status: "pending", expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, email: true, role: true },
      },
    },
  });

  return (
    <AdminOrganizations
      organizations={organizations.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        createdAt: org.createdAt.toISOString(),
        memberCount: org._count.members,
        projectCount: org._count.projects,
        pendingInvites: org.invitations.map((invite) => ({
          id: invite.id,
          email: invite.email,
          role: invite.role,
          url: inviteUrl(invite.id),
        })),
      }))}
    />
  );
}
