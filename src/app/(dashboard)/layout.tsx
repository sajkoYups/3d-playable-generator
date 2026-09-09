import type { ReactNode } from "react";
import { requireSession } from "@/lib/session";
import { DashboardNav } from "@/features/projects/dashboard-nav";
import { BrandHeaderLink } from "@/features/app-brands/brand-header-link";
import { ThemeToggle } from "@/components/theme-toggle";
import { ForgePlayLogo } from "@/components/forgeplay-logo";
import { UserMenu } from "@/features/projects/user-menu";
import { ensureActiveOrganization } from "@/lib/org";
import { isPlatformAdminEmail } from "@/lib/platform";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireSession();
  const organizationId = await ensureActiveOrganization(session);
  const isAdmin = isPlatformAdminEmail(session.user.email);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <ForgePlayLogo
              href={organizationId ? "/projects" : isAdmin ? "/admin" : "/pending-access"}
              wordmarkClassName="text-lg"
            />
            {organizationId ? <DashboardNav /> : null}
          </div>
          <div className="flex items-center gap-3 text-sm text-muted">
            {organizationId ? <BrandHeaderLink /> : null}
            <ThemeToggle />
            <UserMenu
              name={session.user.name || session.user.email}
              hasOrganization={Boolean(organizationId)}
              isAdmin={isAdmin}
            />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
