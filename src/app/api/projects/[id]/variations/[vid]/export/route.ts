import { NextRequest, NextResponse } from "next/server";
import { getAccessibleVariation, requireApiSession } from "@/lib/api-auth";
import { exportPlayableHtml } from "@/lib/export-playable";
import { resolveVariationPlayable } from "@/lib/resolve-variation";
import type { NetworkId, TemplateId } from "@/types/project";
import { prisma } from "@/lib/db";
import JSZip from "jszip";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; vid: string }> },
) {
  const session = await requireApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, vid } = await context.params;
  const access = await getAccessibleVariation(id, vid, session.user.id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    networkId?: NetworkId;
    networks?: NetworkId[];
  };

  const networks = body.networks?.length
    ? body.networks
    : [body.networkId || "generic"];

  const projectData = await resolveVariationPlayable({
    projectData: access.variation.projectData,
    templateId: access.project.templateId,
    brandId: access.variation.brandId,
    overrides: access.variation.overrides,
  });

  const results = [];
  for (const networkId of networks) {
    const result = await exportPlayableHtml({
      projectData,
      templateId: access.project.templateId as TemplateId,
      projectName: access.variation.name || access.project.name,
      networkId,
    });
    results.push(result);
  }

  await prisma.variation.update({
    where: { id: vid },
    data: { status: "exported" },
  });

  if (results.length === 1) {
    return NextResponse.json(results[0]);
  }

  const zip = new JSZip();
  const slug = (access.variation.name || access.project.name).replace(/[^a-z0-9-_]+/gi, "-").toLowerCase() || "playable";
  for (const r of results) {
    zip.file(`${slug}-${r.networkId}.html`, r.html);
  }
  const zipBuf = await zip.generateAsync({ type: "nodebuffer" });
  const total = results.reduce((n, r) => n + r.size, 0);
  return NextResponse.json({
    zipBase64: zipBuf.toString("base64"),
    results,
    size: zipBuf.length,
    warnings: results.flatMap((r) => r.warnings),
    breakdown: {
      htmlShell: 0,
      javascript: total,
      images: 0,
      models: 0,
      audio: 0,
      video: 0,
      total,
    },
  });
}
