"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ProfileAccountForm({
  initialName,
  email,
}: {
  initialName: string;
  email: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [loading, setLoading] = useState(false);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error || "Could not save profile");
        return;
      }
      toast.success("Profile saved");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your account</CardTitle>
        <CardDescription>This name is shown to teammates. Email is how you sign in.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSave} className="max-w-md space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Name</Label>
            <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input id="profile-email" value={email} readOnly />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save profile"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
