import type { ReactNode } from "react";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { SignOutButton } from "@/features/projects/sign-out-button";
import { DashboardNav } from "@/features/projects/dashboard-nav";
import { BrandHeaderLink } from "@/features/app-brands/brand-header-link";
import { ThemeToggle } from "@/components/theme-toggle";
import { ensureActiveOrganization } from "@/lib/org";
import { isPlatformAdminEmail } from "@/lib/platform";
import { prisma } from "@/lib/db";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireSession();
  const organizationId = await ensureActiveOrganization(session);
  const isAdmin = isPlatformAdminEmail(session.user.email);
  const organization = organizationId
    ? await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      })
    : null;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href={organizationId ? "/projects" : isAdmin ? "/admin" : "/pending-access"} className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
              Forge<span className="text-accent">Play</span>
            </Link>
            {organizationId ? <DashboardNav /> : null}
          </div>
          <div className="flex items-center gap-3 text-sm text-muted">
            {organizationId ? <BrandHeaderLink /> : null}
            {organizationId ? (
              <Link href="/settings/team" className="hover:text-foreground">
                {organization?.name || "Team"}
              </Link>
            ) : null}
            {isAdmin ? (
              <Link href="/admin" className="hover:text-foreground">
                Admin
              </Link>
            ) : null}
            <span>{session.user.name || session.user.email}</span>
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
