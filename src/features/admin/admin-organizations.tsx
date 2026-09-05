"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  memberCount: number;
  projectCount: number;
  pendingInvites: { id: string; email: string; role: string | null; url: string }[];
};

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success("Invite link copied");
  } catch {
    toast.message("Copy the invite link from the page");
  }
}

export function AdminOrganizations({ organizations }: { organizations: OrgRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastUrl, setLastUrl] = useState<string | null>(null);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setLastUrl(null);
    try {
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ownerEmail }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error || "Could not create company");
        return;
      }
      setName("");
      setOwnerEmail("");
      setLastUrl(body.invitation.url);
      router.refresh();
      await copyText(body.invitation.url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">Platform</p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">Companies</h1>
        <p className="mt-1 text-sm text-muted">Create a company and send its first owner an invite link.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New company</CardTitle>
          <CardDescription>The owner gets a copy-paste invite. You are not added as a member.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="org-name">Company name</Label>
              <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner-email">Owner email</Label>
              <Input
                id="owner-email"
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create and copy invite"}
              </Button>
            </div>
          </form>
          {lastUrl ? (
            <p className="mt-4 break-all text-sm text-muted">
              Invite: <span className="text-foreground">{lastUrl}</span>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {organizations.length === 0 ? (
          <p className="text-sm text-muted">No companies yet.</p>
        ) : (
          organizations.map((org) => (
            <Card key={org.id}>
              <CardHeader>
                <CardTitle>{org.name}</CardTitle>
                <CardDescription>
                  {org.slug} · {org.memberCount} {org.memberCount === 1 ? "member" : "members"} ·{" "}
                  {org.projectCount} {org.projectCount === 1 ? "project" : "projects"}
                </CardDescription>
              </CardHeader>
              {org.pendingInvites.length > 0 ? (
                <CardContent className="space-y-2">
                  {org.pendingInvites.map((invite) => (
                    <div key={invite.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span>
                        {invite.email} <span className="text-muted">({invite.role})</span>
                      </span>
                      <Button type="button" size="sm" variant="outline" onClick={() => copyText(invite.url)}>
                        Copy invite
                      </Button>
                    </div>
                  ))}
                </CardContent>
              ) : null}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
