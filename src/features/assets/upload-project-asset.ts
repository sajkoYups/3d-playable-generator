export type UploadedAsset = {
  id: string;
  fileName: string;
  fileType: string;
  kind?: string;
  optimizedUrl: string;
  thumbnailUrl: string | null;
  originalSize: number;
  optimizedSize: number;
  width: number | null;
  height: number | null;
  triangleCount?: number | null;
};

export async function uploadProjectAsset(projectId: string, file: File) {
  const form = new FormData();
  form.set("projectId", projectId);
  form.set("file", file);
  const res = await fetch("/api/assets", { method: "POST", body: form });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Upload failed");
  }
  return res.json() as Promise<{ asset: UploadedAsset; warnLarge?: boolean; warning?: string }>;
}
