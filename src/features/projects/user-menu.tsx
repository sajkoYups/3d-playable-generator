"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({
  name,
  hasOrganization,
  isAdmin,
}: {
  name: string;
  hasOrganization: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();

  function go(href: string) {
    // Radix closes the menu on select and can cancel a same-tick App Router push.
    setTimeout(() => router.push(href), 0);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex max-w-48 items-center gap-1 truncate text-sm text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="truncate">{name}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => go("/settings/profile")}>Profile</DropdownMenuItem>
        {hasOrganization ? (
          <DropdownMenuItem onSelect={() => go("/settings/profile#company")}>Company</DropdownMenuItem>
        ) : null}
        {isAdmin ? (
          <DropdownMenuItem onSelect={() => go("/admin")}>Admin</DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await authClient.signOut();
            router.push("/sign-in");
            router.refresh();
          }}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
