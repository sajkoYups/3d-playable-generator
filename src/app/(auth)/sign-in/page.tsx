import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import SignInForm from "./sign-in-form";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getSession();
  const { next } = await searchParams;
  if (session) {
    redirect(next?.startsWith("/") && !next.startsWith("//") ? next : "/projects");
  }
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
