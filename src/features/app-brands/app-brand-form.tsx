"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ColorField } from "@/features/editor/color-field";
import { AppBrandAssetField } from "@/features/app-brands/app-brand-asset-field";
import { APP_BRAND_GEOS, APP_BRAND_LANGUAGES } from "@/lib/app-brand-locales";
import type { AppBrandData } from "@/types/project";

const selectClass =
  "h-10 w-full rounded-md border border-border bg-input px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent";

export function AppBrandForm({
  brandId,
  initialName,
  initialData,
}: {
  brandId: string;
  initialName: string;
  initialData: AppBrandData;
}) {
  const router = useRouter();
  const [data, setData] = useState<AppBrandData>(initialData);
  const [saving, setSaving] = useState(false);

  function patch(partial: Partial<AppBrandData>) {
    setData((current) => ({ ...current, ...partial }));
  }

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/app-brands/${brandId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.appName.trim() || initialName,
        brandData: data,
        thumbnailUrl: data.appIconUrl || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Failed to save brand");
      return;
    }
    toast.success("Brand saved");
    router.refresh();
  }

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-5 rounded-lg border border-border bg-card p-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">Identity</p>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl tracking-tight">App and market</h2>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="app-name">App name</Label>
            <Input
              id="app-name"
              value={data.appName}
              onChange={(e) => patch({ appName: e.target.value })}
              placeholder="Candy Crush"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="geo">GEO</Label>
              <select
                id="geo"
                className={selectClass}
                value={data.geo}
                onChange={(e) => patch({ geo: e.target.value })}
              >
                {APP_BRAND_GEOS.map((geo) => (
                  <option key={geo.code} value={geo.code}>
                    {geo.code} · {geo.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="language">Language</Label>
              <select
                id="language"
                className={selectClass}
                value={data.language}
                onChange={(e) => patch({ language: e.target.value })}
              >
                {APP_BRAND_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="app-store">App Store link</Label>
            <Input
              id="app-store"
              value={data.appStoreUrl}
              onChange={(e) => patch({ appStoreUrl: e.target.value })}
              placeholder="https://apps.apple.com/app/…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="google-play">Google Play link</Label>
            <Input
              id="google-play"
              value={data.googlePlayUrl}
              onChange={(e) => patch({ googlePlayUrl: e.target.value })}
              placeholder="https://play.google.com/store/apps/…"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <ColorField
              label="Primary color"
              value={data.primaryColor}
              fallback="#e07a3d"
              onChange={(hex) => patch({ primaryColor: hex })}
            />
            <ColorField
              label="Secondary color"
              value={data.secondaryColor}
              fallback="#1c1f2a"
              onChange={(hex) => patch({ secondaryColor: hex })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="disclaimer">Disclaimer text</Label>
            <Textarea
              id="disclaimer"
              value={data.disclaimerText}
              onChange={(e) => patch({ disclaimerText: e.target.value })}
              placeholder="This is a playable ad. Download the full game to keep playing."
            />
          </div>
        </div>

        <div className="space-y-5 rounded-lg border border-border bg-card p-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">Art</p>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl tracking-tight">Logos and icons</h2>
            <p className="mt-1 text-sm text-muted">
              Playables pull these as layers. Placement stays on the playable.
            </p>
          </div>
          <AppBrandAssetField
            label="App logo · vertical"
            value={data.logoVerticalUrl}
            appBrandId={brandId}
            onChange={(url) => patch({ logoVerticalUrl: url })}
          />
          <AppBrandAssetField
            label="App logo · horizontal"
            value={data.logoHorizontalUrl}
            appBrandId={brandId}
            onChange={(url) => patch({ logoHorizontalUrl: url })}
          />
          <AppBrandAssetField
            label="App icon"
            value={data.appIconUrl}
            appBrandId={brandId}
            onChange={(url) => patch({ appIconUrl: url })}
          />
          <AppBrandAssetField
            label="Coin icon"
            value={data.coinImageUrl}
            appBrandId={brandId}
            onChange={(url) => patch({ coinImageUrl: url })}
          />
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save brand"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/brands")}>
          Back to brands
        </Button>
      </div>
    </form>
  );
}
