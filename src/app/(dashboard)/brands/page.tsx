import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { AppBrandsRoster } from "@/features/app-brands/app-brands-roster";
import { parseAppBrandData } from "@/lib/resolve-playable";

export default async function BrandsPage() {
  const session = await requireSession();
  const brands = await prisma.appBrand.findMany({
    where: { members: { some: { userId: session.user.id } } },
    include: { _count: { select: { variations: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <AppBrandsRoster
      brands={brands.map((b) => {
        const data = parseAppBrandData(b.brandData);
        return {
          id: b.id,
          name: b.name,
          appName: data.appName || b.name,
          geo: data.geo,
          language: data.language,
          primaryColor: data.primaryColor,
          appIconUrl: data.appIconUrl || b.thumbnailUrl || "",
          appStoreUrl: data.appStoreUrl,
          googlePlayUrl: data.googlePlayUrl,
          variationCount: b._count.variations,
          updatedAt: b.updatedAt,
        };
      })}
    />
  );
}
