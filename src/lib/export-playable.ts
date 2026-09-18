import type { NetworkId, ProjectData, TemplateId } from "@/types/project";
import { ProjectDataSchema } from "@/types/project";
import { ensureTripleMatchKitchenChrome } from "@/lib/project-defaults";
import { readObjectBuffer } from "@/lib/storage";
import { createNetworkAdapter, META_CTA_CALL, NETWORK_LIMITS } from "@/playable-runtime/networks";
import { collectAssetUrls } from "@/playable-runtime/export/collect-urls";
import path from "path";
import { build } from "esbuild";

export type ExportBreakdown = {
  htmlShell: number;
  javascript: number;
  images: number;
  models: number;
  audio: number;
  video: number;
  total: number;
};

export type ExportResult = {
  html: string;
  size: number;
  networkId: NetworkId;
  breakdown: ExportBreakdown;
  warnings: string[];
};

const ENGINE_FACTORY: Record<TemplateId, string> = {
  "stack-tower": "createStackTowerEngine",
  "triple-match": "createTripleMatchEngine",
  "lane-runner": "createLaneRunnerEngine",
  "parking-jam": "createParkingJamEngine",
  "tower-defense": "createTowerDefenseEngine",
  "water-sort": "createWaterSortEngine",
  "match-3": "createMatch3Engine",
  solitaire: "createSolitaireEngine",
  domino: "createDominoEngine",
  "tappy-plane": "createTappyPlaneEngine",
  "racing-lap": "createRacingLapEngine",
  "top-down-shooter": "createTopDownShooterEngine",
  "dress-up": "createDressUpEngine",
};

const ENGINE_FILE: Record<TemplateId, string> = {
  "stack-tower": "src/playable-runtime/engines/stack-tower/index.ts",
  "triple-match": "src/playable-runtime/engines/triple-match/index.ts",
  "lane-runner": "src/playable-runtime/engines/lane-runner/index.ts",
  "parking-jam": "src/playable-runtime/engines/parking-jam/index.ts",
  "tower-defense": "src/playable-runtime/engines/tower-defense/index.ts",
  "water-sort": "src/playable-runtime/engines/water-sort/index.ts",
  "match-3": "src/playable-runtime/engines/match-3/index.ts",
  solitaire: "src/playable-runtime/engines/solitaire/index.ts",
  domino: "src/playable-runtime/engines/domino/index.ts",
  "tappy-plane": "src/playable-runtime/engines/tappy-plane/index.ts",
  "racing-lap": "src/playable-runtime/engines/racing-lap/index.ts",
  "top-down-shooter": "src/playable-runtime/engines/top-down-shooter/index.ts",
  "dress-up": "src/playable-runtime/engines/dress-up/index.ts",
};

function mimeFromUrl(url: string): string {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() || "";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "gif") return "image/gif";
  if (ext === "glb") return "model/gltf-binary";
  if (ext === "gltf") return "model/gltf+json";
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "wav") return "audio/wav";
  if (ext === "ogg") return "audio/ogg";
  if (ext === "m4a") return "audio/mp4";
  if (ext === "mp4") return "video/mp4";
  if (ext === "webm") return "video/webm";
  return "application/octet-stream";
}

function mimeFromBuffer(buf: Buffer, url: string): string {
  const fromUrl = mimeFromUrl(url);
  if (fromUrl !== "application/octet-stream") return fromUrl;
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF") {
    const kind = buf.toString("ascii", 8, 12);
    if (kind === "WAVE") return "audio/wav";
    if (kind === "WEBP") return "image/webp";
  }
  if (buf.length >= 3 && buf.toString("ascii", 0, 3) === "ID3") return "audio/mpeg";
  if (buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return "audio/mpeg";
  if (buf.length >= 8 && buf.toString("ascii", 4, 8) === "ftyp") {
    const brand = buf.toString("ascii", 8, 12);
    if (/m4a|M4A|mp4a/i.test(brand)) return "audio/mp4";
    return "video/mp4";
  }
  if (buf.length >= 4 && buf.toString("ascii", 0, 4) === "OggS") return "audio/ogg";
  if (buf.length >= 4 && buf.toString("ascii", 0, 4) === "glTF") return "model/gltf-binary";
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return "video/webm";
  }
  return fromUrl;
}

function categoryFor(url: string, mime: string): keyof Omit<ExportBreakdown, "htmlShell" | "javascript" | "total"> {
  if (mime.startsWith("video/") || url.match(/\.(mp4|webm)(\?|$)/i)) return "video";
  if (mime.startsWith("audio/") || url.match(/\.(mp3|wav|ogg|m4a)(\?|$)/i)) return "audio";
  if (mime.startsWith("model/") || url.match(/\.(glb|gltf)(\?|$)/i)) return "models";
  return "images";
}

export async function exportPlayableHtml(options: {
  projectData: ProjectData;
  templateId: TemplateId;
  projectName: string;
  networkId?: NetworkId;
}): Promise<ExportResult> {
  const data = ProjectDataSchema.parse(options.projectData);
  if (options.templateId === "triple-match") ensureTripleMatchKitchenChrome(data);
  const networkId = options.networkId ?? "generic";
  const adapter = createNetworkAdapter(networkId);
  const warnings: string[] = [];
  const breakdown: ExportBreakdown = {
    htmlShell: 0,
    javascript: 0,
    images: 0,
    models: 0,
    audio: 0,
    video: 0,
    total: 0,
  };

  const urls = collectAssetUrls(data, options.templateId);
  const assets: Record<string, string> = {};
  let sawVideo = false;

  for (const url of urls) {
    if (!url || url.startsWith("data:")) continue;
    const buf = await readObjectBuffer(url);
    if (!buf) {
      warnings.push(`Missing asset: ${url}`);
      continue;
    }
    const mime = mimeFromBuffer(buf, url);
    assets[url] = `data:${mime};base64,${buf.toString("base64")}`;
    const category = categoryFor(url, mime);
    breakdown[category] += buf.length;
    if (category === "video") sawVideo = true;
  }
  const factory = ENGINE_FACTORY[options.templateId];
  const engineFile = ENGINE_FILE[options.templateId];

  const source = `
import { mountPlayable } from ${JSON.stringify(pathTo("src/playable-runtime/player/mount.ts"))};
import { ${factory} } from ${JSON.stringify(pathTo(engineFile))};
import { createNetworkAdapter } from ${JSON.stringify(pathTo("src/playable-runtime/networks/index.ts"))};

const config = window.__PLAYABLE_CONFIG__;
const root = document.getElementById("playable-root");
if (root && config) {
  const engine = ${factory}();
  const network = createNetworkAdapter(config.networkId || "generic");
  mountPlayable(root, {
    data: config.data,
    templateId: config.templateId,
    engine,
    network,
    assets: config.assets || {},
  });
}
`;

  const result = await build({
    stdin: {
      contents: source,
      resolveDir: process.cwd(),
      sourcefile: "playable-entry.ts",
      loader: "ts",
    },
    bundle: true,
    minify: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: ["es2018"],
    logLevel: "silent",
    alias: {
      "@": path.join(process.cwd(), "src"),
    },
  });

  const js = result.outputFiles[0]?.text || "";
  breakdown.javascript = Buffer.byteLength(js);

  const configJson = JSON.stringify({
    data,
    templateId: options.templateId,
    networkId,
    assets,
  });

  const shell = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"/>
<meta name="ad.size" content="width=320,height=480"/>
<title>${escapeHtml(options.projectName)}</title>
<style>
html,body,#playable-root{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#12141a;touch-action:manipulation}
button{font-family:system-ui,sans-serif}
</style>
</head>
<body>
<div id="playable-root"></div>
<script>window.__PLAYABLE_CONFIG__=${configJson};</script>
<script>${js}</script>
</body>
</html>`;

  const html = adapter.wrapHtml(shell);
  breakdown.htmlShell = Buffer.byteLength(html) - breakdown.javascript - Buffer.byteLength(configJson);
  breakdown.total = Buffer.byteLength(html);

  if (sawVideo) {
    warnings.push("Video assets dominate playable size budgets. Prefer a short loop or a poster image.");
  }
  const limit = NETWORK_LIMITS[networkId];
  if (breakdown.total > limit) {
    warnings.push(`${adapter.name} limit is ${Math.round(limit / 1024 / 1024)} MB; this file is ${(breakdown.total / 1024 / 1024).toFixed(2)} MB.`);
  }
  if (networkId === "meta" && !html.includes(META_CTA_CALL)) {
    warnings.push("Meta/Moloco require a parameterless FbPlayableAd.onCTAClick() call in the HTML; it is missing from this export.");
  }

  return { html, size: breakdown.total, networkId, breakdown, warnings: [...new Set(warnings)] };
}

function pathTo(rel: string) {
  return path.join(process.cwd(), rel);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
