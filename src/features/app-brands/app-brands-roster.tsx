"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Copy, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { geoLabel, languageLabel } from "@/lib/app-brand-locales";

export type AppBrandRow = {
  id: string;
  name: string;
  appName: string;
  geo: string;
  language: string;
  primaryColor: string;
  appIconUrl: string;
  appStoreUrl: string;
  googlePlayUrl: string;
  variationCount: number;
  updatedAt: string | Date;
};

function hostOf(url: string): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function AppBrandsRoster({ brands }: { brands: AppBrandRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) =>
      [b.name, b.appName, b.geo, b.language, geoLabel(b.geo), languageLabel(b.language)]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [brands, query]);

  async function createBrand() {
    setCreating(true);
    const res = await fetch("/api/app-brands", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    setCreating(false);
    if (!res.ok) {
      toast.error("Failed to create brand");
      return;
    }
    const { brand } = await res.json();
    router.push(`/brands/${brand.id}`);
  }

  async function duplicateBrand(id: string) {
    const res = await fetch(`/api/app-brands/${id}/duplicate`, { method: "POST" });
    if (!res.ok) {
      toast.error("Failed to duplicate");
      return;
    }
    toast.success("Brand duplicated");
    router.refresh();
  }

  async function deleteBrand(id: string) {
    if (!confirm("Delete this brand? Linked playables keep their last snapshot and unlink.")) return;
    const res = await fetch(`/api/app-brands/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("Brand deleted");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">Identity kit</p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">Brands</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Store links, logos, colors, and disclaimer once. Apply the kit to any playable variation.
          </p>
        </div>
        <Button onClick={() => void createBrand()} disabled={creating}>
          <Plus className="h-4 w-4" />
          {creating ? "Creating…" : "Add new Brand"}
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          className="pl-9"
          placeholder="Search brands, GEO, language…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-start gap-3 border border-dashed border-border px-5 py-14">
          <p className="text-sm text-muted">No brands yet. Add one, then stamp it onto playable variations.</p>
          <Button onClick={() => void createBrand()}>
            <Plus className="h-4 w-4" />
            Add new Brand
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden border border-border">
          <div className="hidden grid-cols-[auto_minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,1fr)_auto] gap-4 border-b border-border bg-elevated px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted md:grid">
            <span className="w-2" />
            <span>Brand</span>
            <span>Market</span>
            <span>Stores</span>
            <span className="text-right">Actions</span>
          </div>
          <ul className="divide-y divide-border">
            {filtered.map((brand) => (
              <li
                key={brand.id}
                className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-4 px-4 py-3 hover:bg-elevated md:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,1fr)_auto]"
                onClick={() => router.push(`/brands/${brand.id}`)}
              >
                <span
                  className="h-12 w-1.5 shrink-0 self-stretch rounded-full"
                  style={{ background: brand.primaryColor || "#e07a3d" }}
                />
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
                    {brand.appIconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={brand.appIconUrl} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-[10px] text-muted">icon</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{brand.appName || brand.name}</p>
                    <p className="text-[11px] text-muted">
                      {brand.variationCount} {brand.variationCount === 1 ? "playable" : "playables"} ·{" "}
                      {formatDistanceToNow(new Date(brand.updatedAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <div className="hidden min-w-0 md:block">
                  <p className="text-sm">
                    {brand.geo} · {languageLabel(brand.language)}
                  </p>
                  <p className="truncate text-[11px] text-muted">{geoLabel(brand.geo)}</p>
                </div>
                <div className="hidden min-w-0 text-[11px] text-muted md:block">
                  <p className="truncate">{hostOf(brand.appStoreUrl) || "No App Store"}</p>
                  <p className="truncate">{hostOf(brand.googlePlayUrl) || "No Google Play"}</p>
                </div>
                <div
                  className="col-span-2 flex flex-wrap justify-end gap-2 md:col-span-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button size="sm" onClick={() => router.push(`/brands/${brand.id}`)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void duplicateBrand(brand.id)}>
                    <Copy className="h-3.5 w-3.5" />
                    Duplicate
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void deleteBrand(brand.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
