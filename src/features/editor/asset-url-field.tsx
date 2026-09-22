"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEditorStore } from "@/features/editor/store";
import { FieldHint } from "@/features/editor/field-hint";
import { uploadOwnedAsset } from "@/features/assets/upload-project-asset";

export function AssetUrlField({
  label,
  hint,
  value,
  onChange,
  accept,
  kind = "image",
}: {
  label?: string;
  hint?: string;
  value: string;
  onChange: (url: string) => void;
  accept: string;
  kind?: "image" | "model" | "audio" | "video";
}) {
  const projectId = useEditorStore((s) => s.projectId);
  const brandId = useEditorStore((s) => s.brandId);
  const editorMode = useEditorStore((s) => s.editorMode);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    const owner =
      editorMode === "brand" && brandId
        ? { brandId }
        : projectId
          ? { projectId }
          : null;
    if (!owner) {
      toast.error("Upload failed");
      return;
    }
    setUploading(true);
    try {
      const data = await uploadOwnedAsset(owner, file);
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
    <div className="space-y-1">
      {label ? (
        <div className="flex items-center gap-1">
          <Label className="text-xs">{label}</Label>
          {hint ? <FieldHint text={hint} /> : null}
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-elevated text-[9px] text-muted">
          {kind === "image" && value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-contain" />
          ) : (
            kind.slice(0, 3)
          )}
        </div>
        <Input
          className="h-8 min-w-0 flex-1 text-xs"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <label className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-md border border-border px-2 text-xs hover:bg-hover">
          <input
            type="file"
            accept={accept}
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />
          <Upload className="h-3.5 w-3.5" />
          {uploading ? "..." : "Upload"}
        </label>
      </div>
    </div>
  );
}
