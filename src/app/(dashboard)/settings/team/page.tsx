import { redirect } from "next/navigation";
import { requireOrganization } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getOrgMembership } from "@/lib/org";
import { inviteUrl } from "@/lib/platform";
import { TeamSettings } from "@/features/team/team-settings";

export default async function TeamPage() {
  const { session, organizationId } = await requireOrganization();
  const membership = await getOrgMembership(session.user.id, organizationId);
  if (!membership) redirect("/pending-access");

  const [organization, members, invitations] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, slug: true },
    }),
    prisma.member.findMany({
      where: { organizationId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: { organizationId, status: "pending" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!organization) redirect("/pending-access");

  return (
    <TeamSettings
      organizationName={organization.name}
      currentUserId={session.user.id}
      canManage={membership.role === "owner" || membership.role === "admin"}
      members={members.map((m) => ({
        id: m.id,
        role: m.role,
        user: m.user,
      }))}
      invitations={invitations.map((invite) => ({
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt.toISOString(),
        url: inviteUrl(invite.id),
      }))}
    />
  );
}
