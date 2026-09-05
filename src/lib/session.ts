import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ensureActiveOrganization } from "@/lib/org";
import { isPlatformAdminEmail } from "@/lib/platform";

export async function getSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }
  return session;
}

export async function requireOrganization() {
  const session = await requireSession();
  const organizationId = await ensureActiveOrganization(session);
  if (!organizationId) {
    redirect(isPlatformAdminEmail(session.user.email) ? "/admin" : "/pending-access");
  }
  return { session, organizationId };
}
