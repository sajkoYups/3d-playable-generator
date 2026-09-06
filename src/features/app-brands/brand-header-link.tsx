"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function BrandHeaderLink() {
  const pathname = usePathname();
  const active = pathname === "/brands" || pathname.startsWith("/brands/");

  return (
    <Link
      href="/brands"
      className={cn(
        "text-sm hover:text-foreground",
        active ? "text-foreground" : "text-muted",
      )}
    >
      Brands
    </Link>
  );
}
