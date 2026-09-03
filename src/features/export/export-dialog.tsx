"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/features/editor/store";
import { formatBytes } from "@/lib/utils";
import { toast } from "sonner";
import { NETWORK_IDS, type NetworkId } from "@/types/project";
import { NETWORK_LABELS, NETWORK_LIMITS } from "@/playable-runtime/networks";

type ExportPayload = {
  html?: string;
  zipBase64?: string;
  size: number;
  networkId?: NetworkId;
  results?: Array<{ networkId: NetworkId; size: number; html: string; warnings: string[] }>;
  breakdown: {
    htmlShell: number;
    javascript: number;
    images: number;
    models: number;
    audio: number;
    video: number;
    total: number;
  };
  warnings: string[];
};

export function ExportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const projectId = useEditorStore((s) => s.projectId);
  const variationId = useEditorStore((s) => s.variationId);
  const projectName = useEditorStore((s) => s.projectName);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExportPayload | null>(null);
  const [selected, setSelected] = useState<NetworkId[]>(["generic"]);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  async function runExport() {
    setLoading(true);
    setResult(null);
    setPreviewHtml(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/variations/${variationId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          networkId: selected[0],
          networks: selected,
        }),
      });
      if (!res.ok) {
        toast.error("Export failed");
        setLoading(false);
        return;
      }
      const data = (await res.json()) as ExportPayload;
      setResult(data);
      if (data.html) setPreviewHtml(data.html);
      else if (data.results?.[0]?.html) setPreviewHtml(data.results[0].html);
    } catch {
      toast.error("Export failed");
    } finally {
      setLoading(false);
    }
  }

  function download() {
    if (!result) return;
    const slug = projectName.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase() || "playable";
    if (result.zipBase64) {
      const bin = Uint8Array.from(atob(result.zipBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([bin], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}-playables.zip`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    if (!result.html) return;
    const blob = new Blob([result.html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggle(id: NetworkId) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setResult(null);
          setPreviewHtml(null);
        }
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Export playable</DialogTitle>
          <DialogDescription>
            Bundles Three.js + the selected engine into one HTML file. Pick networks to wrap CTA APIs.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          {NETWORK_IDS.map((id) => (
            <label key={id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <input type="checkbox" checked={selected.includes(id)} onChange={() => toggle(id)} />
              <span>{NETWORK_LABELS[id]}</span>
              <span className="ml-auto text-[11px] text-muted">{Math.round(NETWORK_LIMITS[id] / 1024 / 1024)} MB</span>
            </label>
          ))}
        </div>

        {!result ? (
          <div className="py-2 text-sm text-muted">esbuild bundles the runtime. Assets inline as data URIs.</div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="rounded-lg bg-[#161821] p-3">
              <div className="flex justify-between font-medium">
                <span>Total size</span>
                <span>{formatBytes(result.size)}</span>
              </div>
              <ul className="mt-2 space-y-1 text-muted">
                <li className="flex justify-between"><span>JavaScript</span><span>{formatBytes(result.breakdown.javascript)}</span></li>
                <li className="flex justify-between"><span>Images</span><span>{formatBytes(result.breakdown.images)}</span></li>
                <li className="flex justify-between"><span>Models</span><span>{formatBytes(result.breakdown.models)}</span></li>
                <li className="flex justify-between"><span>Audio</span><span>{formatBytes(result.breakdown.audio)}</span></li>
                <li className="flex justify-between"><span>Video</span><span>{formatBytes(result.breakdown.video)}</span></li>
              </ul>
            </div>
            {result.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-800 bg-amber-950/40 p-3 text-amber-200">
                <p className="font-medium">Warnings</p>
                <ul className="mt-1 list-disc pl-4">
                  {result.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            {previewHtml && (
              <iframe title="Export preview" className="h-64 w-full rounded-md border border-border bg-black" srcDoc={previewHtml} />
            )}
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <Button onClick={runExport} disabled={loading || selected.length === 0}>
              {loading ? "Exporting..." : "Generate export"}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={runExport} disabled={loading}>
                Regenerate
              </Button>
              <Button onClick={download}>{result.zipBase64 ? "Download ZIP" : "Download HTML"}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
