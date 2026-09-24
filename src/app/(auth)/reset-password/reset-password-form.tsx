"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ForgePlayLogo } from "@/components/forgeplay-logo";
import { PasswordInput } from "@/components/password-input";

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const invalid = searchParams.get("error") === "INVALID_TOKEN" || !token;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError("");
    const { error: err } = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    setLoading(false);
    if (err) {
      setError(err.message || "Could not reset password");
      return;
    }
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_color-mix(in_srgb,var(--accent)_28%,var(--background))_0%,_var(--background)_55%)]" />
      <div className="relative flex w-full max-w-md flex-col items-center gap-6">
        <ForgePlayLogo markClassName="h-9 w-9" wordmarkClassName="text-2xl" />
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Set a new password</CardTitle>
            <CardDescription>
              {invalid ? "This reset link is invalid or expired." : "Choose a new password for your account."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invalid ? (
              <div className="space-y-4 text-sm">
                <p>Request a new reset link from the sign-in page.</p>
                <Button asChild className="w-full">
                  <Link href="/forgot-password">Forgot password</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <PasswordInput
                    id="password"
                    value={password}
                    onChange={setPassword}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm password</Label>
                  <PasswordInput
                    id="confirm"
                    value={confirm}
                    onChange={setConfirm}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Saving..." : "Reset password"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
