"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

type BrandRow = {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  updatedAt: string | Date;
  variationCount: number;
  logoUrl?: string | null;
};

export function BrandsDashboard({ brands }: { brands: BrandRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) => b.name.toLowerCase().includes(q));
  }, [brands, query]);

  async function createBrand() {
    setCreating(true);
    const res = await fetch("/api/brands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Untitled brand" }),
    });
    setCreating(false);
    if (!res.ok) {
      toast.error("Failed to create brand");
      return;
    }
    const { brand } = await res.json();
    router.push(`/brands/${brand.id}`);
  }

  async function renameBrand(id: string) {
    const res = await fetch(`/api/brands/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renameValue }),
    });
    if (!res.ok) {
      toast.error("Failed to rename");
      return;
    }
    setRenamingId(null);
    toast.success("Renamed");
    router.refresh();
  }

  async function deleteBrand(id: string) {
    if (!confirm("Delete this brand? Linked variations keep their last snapshot and unlink.")) return;
    const res = await fetch(`/api/brands/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("Brand deleted");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">Brands</h1>
          <p className="text-sm text-muted">
            Pre-save logos, CTAs, and store destinations. Stamp a kit onto any game.
          </p>
        </div>
        <Button onClick={() => void createBrand()} disabled={creating}>
          <Plus className="h-4 w-4" />
          {creating ? "Creating..." : "New brand"}
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          className="pl-9"
          placeholder="Search brands..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <p className="text-muted">No brand kits yet. Save layers and store URLs once, reuse them everywhere.</p>
            <Button onClick={() => void createBrand()}>
              <Plus className="h-4 w-4" />
              Create brand
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((brand) => (
            <Card
              key={brand.id}
              className="cursor-pointer overflow-hidden"
              onClick={() => router.push(`/brands/${brand.id}`)}
            >
              <div className="relative flex h-36 items-center justify-center bg-[#161821]">
                {brand.logoUrl || brand.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={brand.logoUrl || brand.thumbnailUrl || ""}
                    alt=""
                    className="h-20 w-20 object-contain"
                  />
                ) : (
                  <span className="text-sm text-muted">No logo yet</span>
                )}
              </div>
              <CardHeader>
                {renamingId === brand.id ? (
                  <form
                    onClick={(e) => e.stopPropagation()}
                    onSubmit={(e) => {
                      e.preventDefault();
                      void renameBrand(brand.id);
                    }}
                  >
                    <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
                  </form>
                ) : (
                  <CardTitle className="truncate">{brand.name}</CardTitle>
                )}
                <div className="flex items-center gap-2">
                  <Badge>
                    {brand.variationCount} {brand.variationCount === 1 ? "variation" : "variations"}
                  </Badge>
                  <span className="text-[11px] text-muted">
                    {formatDistanceToNow(new Date(brand.updatedAt), { addSuffix: true })}
                  </span>
                </div>
              </CardHeader>
              <CardFooter className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                <Button size="sm" onClick={() => router.push(`/brands/${brand.id}`)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setRenamingId(brand.id);
                    setRenameValue(brand.name);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => deleteBrand(brand.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
