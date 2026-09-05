"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type MemberRow = {
  id: string;
  role: string;
  user: { id: string; name: string; email: string };
};

type InviteRow = {
  id: string;
  email: string;
  role: string | null;
  expiresAt: string;
  url: string;
};

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success("Invite link copied");
  } catch {
    toast.message("Copy the invite link from the page");
  }
}

export function TeamSettings({
  organizationName,
  currentUserId,
  canManage,
  members,
  invitations,
}: {
  organizationName: string;
  currentUserId: string;
  canManage: boolean;
  members: MemberRow[];
  invitations: InviteRow[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [loading, setLoading] = useState(false);

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/team/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error || "Could not create invite");
        return;
      }
      setEmail("");
      router.refresh();
      await copyText(body.invitation.url);
    } finally {
      setLoading(false);
    }
  }

  async function onCancel(id: string) {
    const res = await fetch(`/api/team/invitations/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error || "Could not cancel invite");
      return;
    }
    toast.success("Invite canceled");
    router.refresh();
  }

  async function onRemove(id: string) {
    const res = await fetch(`/api/team/members/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error || "Could not remove member");
      return;
    }
    toast.success("Member removed");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">Company</p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">{organizationName}</h1>
        <p className="mt-1 text-sm text-muted">Everyone here shares the same projects, templates, and brands.</p>
      </div>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Invite teammate</CardTitle>
            <CardDescription>Copy the link and send it yourself. No email is sent from the app.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onInvite} className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2 sm:w-40">
                <Label htmlFor="invite-role">Role</Label>
                <select
                  id="invite-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-border bg-input px-3 text-sm"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? "Inviting..." : "Invite and copy"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.map((member) => (
            <div key={member.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <div>
                <p className="font-medium">{member.user.name || member.user.email}</p>
                <p className="text-muted">
                  {member.user.email} · {member.role}
                </p>
              </div>
              {canManage && member.user.id !== currentUserId ? (
                <Button type="button" size="sm" variant="outline" onClick={() => onRemove(member.id)}>
                  Remove
                </Button>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      {canManage && invitations.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Pending invites</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {invitations.map((invite) => (
              <div key={invite.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div>
                  <p className="font-medium">{invite.email}</p>
                  <p className="text-muted">{invite.role}</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => copyText(invite.url)}>
                    Copy link
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => onCancel(invite.id)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
