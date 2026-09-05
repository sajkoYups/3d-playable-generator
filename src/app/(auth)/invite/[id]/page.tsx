import type { ReactNode } from "react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { InviteAcceptForm } from "./invite-accept-form";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  const invitation = await prisma.invitation.findUnique({
    where: { id },
    include: { organization: { select: { name: true } } },
  });

  const invalid =
    !invitation || invitation.status !== "pending" || invitation.expiresAt <= new Date();

  if (invalid) {
    return (
      <InviteShell>
        <h1 className="font-[family-name:var(--font-display)] text-2xl">Invite expired</h1>
        <p className="mt-2 text-sm text-muted">Ask your admin for a new link.</p>
      </InviteShell>
    );
  }

  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: invitation.email, mode: "insensitive" } },
    select: { id: true },
  });

  return (
    <InviteShell>
      <InviteAcceptForm
        invitationId={invitation.id}
        organizationName={invitation.organization.name}
        email={invitation.email}
        role={invitation.role || "member"}
        signedInEmail={session?.user.email ?? null}
        accountExists={Boolean(existingUser)}
      />
    </InviteShell>
  );
}

function InviteShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_color-mix(in_srgb,var(--accent)_28%,var(--background))_0%,_var(--background)_55%)]" />
      <div className="relative w-full max-w-md">{children}</div>
    </div>
  );
}
