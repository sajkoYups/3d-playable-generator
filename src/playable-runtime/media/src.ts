const blobSrc = new Map<string, string>();

function dataUriToBytes(url: string): { mime: string; bytes: Uint8Array } | null {
  if (!url.startsWith("data:")) return null;
  const comma = url.indexOf(",");
  if (comma < 0) return null;
  const header = url.slice(5, comma);
  const mime = header.split(";")[0] || "application/octet-stream";
  const payload = url.slice(comma + 1);
  try {
    if (/;base64/i.test(header)) {
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return { mime, bytes };
    }
    return { mime, bytes: new TextEncoder().encode(decodeURIComponent(payload)) };
  } catch {
    return null;
  }
}

/** HTMLAudio/Video often refuse large data: URIs; blob: URLs play. */
export function playableMediaSrc(url: string): string {
  if (!url || !url.startsWith("data:")) return url;
  const hit = blobSrc.get(url);
  if (hit) return hit;
  const parsed = dataUriToBytes(url);
  if (!parsed) return url;
  const blobUrl = URL.createObjectURL(new Blob([parsed.bytes.buffer.slice(parsed.bytes.byteOffset, parsed.bytes.byteOffset + parsed.bytes.byteLength)], { type: parsed.mime }));
  blobSrc.set(url, blobUrl);
  return blobUrl;
}

export function dataUriToArrayBuffer(url: string): ArrayBuffer | null {
  const parsed = dataUriToBytes(url);
  if (!parsed) return null;
  return parsed.bytes.buffer.slice(parsed.bytes.byteOffset, parsed.bytes.byteOffset + parsed.bytes.byteLength);
}
