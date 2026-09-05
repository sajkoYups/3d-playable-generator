import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOrganization } from "@/lib/session";
import { getAccessibleAppBrand } from "@/lib/api-auth";
import { AppBrandForm } from "@/features/app-brands/app-brand-form";
import { parseAppBrandData } from "@/lib/resolve-playable";

export default async function BrandEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { organizationId } = await requireOrganization();
  const { id } = await params;
  const brand = await getAccessibleAppBrand(id, organizationId);
  if (!brand) {
    redirect(`/templates/${id}`);
  }

  const data = parseAppBrandData(brand.brandData);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/brands" className="text-sm text-muted hover:text-foreground">
          ← Brands
        </Link>
        <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">Brand kit</p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
          {data.appName || brand.name}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Linked to {brand.variations.length} {brand.variations.length === 1 ? "playable" : "playables"}.
        </p>
      </div>
      <AppBrandForm brandId={brand.id} initialName={brand.name} initialData={data} />
    </div>
  );
}
