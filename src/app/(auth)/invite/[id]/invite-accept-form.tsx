"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function InviteAcceptForm({
  invitationId,
  organizationName,
  email,
  role,
  signedInEmail,
  accountExists,
}: {
  invitationId: string;
  organizationName: string;
  email: string;
  role: string;
  signedInEmail: string | null;
  accountExists: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const next = `/invite/${invitationId}`;

  async function accept() {
    const res = await fetch(`/api/invitations/${invitationId}/accept`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.error || "Could not accept invite");
    }
  }

  async function onJoin() {
    setLoading(true);
    setError("");
    try {
      await accept();
      router.push("/projects");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept invite");
      setLoading(false);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error: err } = await authClient.signUp.email({ name, email, password });
    if (err) {
      setError(err.message || "Could not create account");
      setLoading(false);
      return;
    }
    try {
      await accept();
      router.push("/projects");
      router.refresh();
    } catch (acceptErr) {
      setError(acceptErr instanceof Error ? acceptErr.message : "Account created, but the invite could not be accepted");
      setLoading(false);
    }
  }

  const wrongAccount =
    signedInEmail && signedInEmail.toLowerCase() !== email.toLowerCase();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join {organizationName}</CardTitle>
        <CardDescription>
          You were invited as {role} ({email})
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {wrongAccount ? (
          <div className="space-y-3 text-sm">
            <p>
              Signed in as {signedInEmail}. This invite is for {email}.
            </p>
            <Button
              type="button"
              className="w-full"
              onClick={async () => {
                await authClient.signOut();
                router.refresh();
              }}
            >
              Sign out and continue
            </Button>
          </div>
        ) : signedInEmail ? (
          <Button className="w-full" disabled={loading} onClick={onJoin}>
            {loading ? "Joining..." : `Join ${organizationName}`}
          </Button>
        ) : accountExists ? (
          <div className="space-y-3 text-sm">
            <p>This email already has an account. Sign in to join.</p>
            <Button asChild className="w-full">
              <Link href={`/sign-in?next=${encodeURIComponent(next)}`}>Sign in</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={onCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating..." : "Create account and join"}
            </Button>
            <p className="text-center text-sm text-muted">
              Already have an account?{" "}
              <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className="font-medium text-foreground underline">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
