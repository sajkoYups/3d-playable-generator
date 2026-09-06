import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { ensureActiveOrganization, getOrgMembership } from "@/lib/org";
import { inviteUrl } from "@/lib/platform";
import { ProfileAccountForm } from "@/features/profile/profile-account-form";
import { TeamSettings } from "@/features/team/team-settings";

export default async function ProfilePage() {
  const session = await requireSession();
  const organizationId = await ensureActiveOrganization(session);

  let company = null;
  if (organizationId) {
    const membership = await getOrgMembership(session.user.id, organizationId);
    if (membership) {
      const [organization, members, invitations] = await Promise.all([
        prisma.organization.findUnique({
          where: { id: organizationId },
          select: { name: true },
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
      if (organization) {
        company = {
          organizationName: organization.name,
          canManage: membership.role === "owner" || membership.role === "admin",
          members: members.map((m) => ({
            id: m.id,
            role: m.role,
            user: m.user,
          })),
          invitations: invitations.map((invite) => ({
            id: invite.id,
            email: invite.email,
            role: invite.role,
            expiresAt: invite.expiresAt.toISOString(),
            url: inviteUrl(invite.id),
          })),
        };
      }
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">Account</p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">Profile</h1>
      </div>
      <ProfileAccountForm initialName={session.user.name || ""} email={session.user.email} />
      {company ? (
        <section id="company" className="scroll-mt-24 space-y-8">
          <TeamSettings
            organizationName={company.organizationName}
            currentUserId={session.user.id}
            canManage={company.canManage}
            members={company.members}
            invitations={company.invitations}
          />
        </section>
      ) : null}
    </div>
  );
}
