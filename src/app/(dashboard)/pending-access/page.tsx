import Link from "next/link";
import { requireSession } from "@/lib/session";
import { ensureActiveOrganization } from "@/lib/org";
import { isPlatformAdminEmail } from "@/lib/platform";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/features/projects/sign-out-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PendingAccessPage() {
  const session = await requireSession();
  const organizationId = await ensureActiveOrganization(session);
  if (organizationId) redirect("/projects");
  const isAdmin = isPlatformAdminEmail(session.user.email);

  return (
    <div className="mx-auto max-w-lg py-16">
      <Card>
        <CardHeader>
          <p className="text-xs uppercase tracking-[0.25em] text-accent">Access</p>
          <CardTitle>No company yet</CardTitle>
          <CardDescription>
            This workspace is invite-only. You need a company invite before you can open projects.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted">
            Signed in as {session.user.email}. If you already have an invite link, open it in this browser.
          </p>
          {isAdmin ? (
            <Link href="/admin" className="inline-flex font-medium text-accent hover:underline">
              Open platform admin
            </Link>
          ) : null}
          <div>
            <SignOutButton />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
