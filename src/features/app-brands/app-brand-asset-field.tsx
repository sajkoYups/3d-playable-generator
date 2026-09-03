"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadOwnedAsset } from "@/features/assets/upload-project-asset";

export function AppBrandAssetField({
  label,
  value,
  appBrandId,
  onChange,
}: {
  label: string;
  value: string;
  appBrandId: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const data = await uploadOwnedAsset({ appBrandId }, file);
      onChange(data.asset.optimizedUrl);
      if (data.warning) toast.warning(data.warning);
      else if (data.warnLarge) toast.warning("Asset is large and may increase export size");
      else toast.success("Uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-[#161821] text-[9px] text-muted">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-contain" />
          ) : (
            "—"
          )}
        </div>
        <Input
          className="h-10 min-w-0 flex-1 text-xs"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… or upload"
        />
        <label className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1 rounded-md border border-border px-3 text-xs hover:bg-[#1c1f2a]">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />
          <Upload className="h-3.5 w-3.5" />
          {uploading ? "…" : "Upload"}
        </label>
      </div>
    </div>
  );
}
