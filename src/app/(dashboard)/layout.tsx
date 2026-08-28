import Link from "next/link";
import { requireSession } from "@/lib/session";
import { SignOutButton } from "@/features/projects/sign-out-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/projects" className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
            Forge<span className="text-accent">3D</span>
          </Link>
          <div className="flex items-center gap-3 text-sm text-muted">
            <span>{session.user.name || session.user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
