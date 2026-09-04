"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function DashboardNav() {
  const pathname = usePathname();
  const onProjects = pathname === "/projects" || pathname.startsWith("/projects/");
  const onTemplates = pathname === "/templates" || pathname.startsWith("/templates/");

  return (
    <nav className="flex items-center gap-4 text-sm">
      <Link
        href="/projects"
        className={cn(
          "hover:text-foreground",
          onProjects ? "text-foreground" : "text-muted",
        )}
      >
        Playable projects
      </Link>
      <Link
        href="/templates"
        className={cn(
          "inline-flex items-center gap-1.5 hover:text-foreground",
          onTemplates ? "text-foreground" : "text-muted",
        )}
      >
        Templates
        <span className="rounded bg-accent-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
          Beta
        </span>
      </Link>
    </nav>
  );
}
