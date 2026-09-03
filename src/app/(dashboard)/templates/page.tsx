import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { BrandsDashboard } from "@/features/brands/brands-dashboard";
import { parseBrandData } from "@/lib/resolve-playable";

export default async function TemplatesPage() {
  const session = await requireSession();
  const brands = await prisma.brand.findMany({
    where: { members: { some: { userId: session.user.id } } },
    include: { _count: { select: { variations: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <BrandsDashboard
      brands={brands.map((b) => {
        let logoUrl: string | null = b.thumbnailUrl;
        try {
          const data = parseBrandData(b.brandData);
          logoUrl = data.startScreen.elements.find((el) => el.id === "app-logo")?.content.imageUrl || logoUrl;
        } catch {
          // keep thumbnail
        }
        return {
          id: b.id,
          name: b.name,
          thumbnailUrl: b.thumbnailUrl,
          updatedAt: b.updatedAt,
          variationCount: b._count.variations,
          logoUrl,
        };
      })}
    />
  );
}
