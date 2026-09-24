"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ForgePlayLogo } from "@/components/forgeplay-logo";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error: err } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });
    setLoading(false);
    if (err) {
      setError(err.message || "Could not send a reset email");
      return;
    }
    setSent(true);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_color-mix(in_srgb,var(--accent)_28%,var(--background))_0%,_var(--background)_55%)]" />
      <div className="relative flex w-full max-w-md flex-col items-center gap-6">
        <ForgePlayLogo markClassName="h-9 w-9" wordmarkClassName="text-2xl" />
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Forgot password</CardTitle>
            <CardDescription>
              Use the email you were invited with. If an account exists, we&apos;ll send a reset link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-4 text-sm">
                <p>
                  If that email has an account, check your inbox for a reset link. Don&apos;t remember which
                  email was invited? Ask the teammate who sent the invite.
                </p>
                <Button asChild className="w-full">
                  <Link href="/sign-in">Back to sign in</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Sending..." : "Send reset link"}
                </Button>
                <p className="text-center text-sm text-muted">
                  <Link href="/sign-in" className="font-medium text-foreground underline">
                    Back to sign in
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
