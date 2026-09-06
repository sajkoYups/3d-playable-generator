import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/api-auth";

const PatchSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export async function PATCH(req: NextRequest) {
  const session = await requireApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a name" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { name: parsed.data.name },
    select: { id: true, name: true, email: true },
  });

  return NextResponse.json({ user });
}
