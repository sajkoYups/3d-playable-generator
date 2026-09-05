import "dotenv/config";
import { prisma } from "@/lib/db";
import { uniqueOrgSlug } from "@/lib/org";

async function orgNameForUser(user: { name: string; email: string }) {
  const name = user.name.trim() || user.email.split("@")[0] || "Workspace";
  return `${name}'s workspace`;
}

async function main() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  let createdOrgs = 0;
  let stampedProjects = 0;
  let stampedBrands = 0;
  let stampedAppBrands = 0;
  let stampedAssets = 0;

  for (const user of users) {
    let membership = await prisma.member.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });

    if (!membership) {
      const name = await orgNameForUser(user);
      const slug = await uniqueOrgSlug(name);
      const organization = await prisma.organization.create({
        data: {
          name,
          slug,
          members: {
            create: { userId: user.id, role: "owner" },
          },
        },
      });
      membership = await prisma.member.findFirst({
        where: { userId: user.id, organizationId: organization.id },
      });
      createdOrgs += 1;
      console.log(`Created org ${organization.slug} for ${user.email}`);
    }

    if (!membership) continue;
    const organizationId = membership.organizationId;

    const projects = await prisma.project.findMany({
      where: { members: { some: { userId: user.id } } },
      select: { id: true, organizationId: true },
    });
    for (const project of projects) {
      if (project.organizationId === organizationId) continue;
      await prisma.project.update({
        where: { id: project.id },
        data: { organizationId },
      });
      stampedProjects += 1;
    }

    const brands = await prisma.brand.findMany({
      where: { members: { some: { userId: user.id } } },
      select: { id: true, organizationId: true },
    });
    for (const brand of brands) {
      if (brand.organizationId === organizationId) continue;
      await prisma.brand.update({
        where: { id: brand.id },
        data: { organizationId },
      });
      stampedBrands += 1;
    }

    const appBrands = await prisma.appBrand.findMany({
      where: { members: { some: { userId: user.id } } },
      select: { id: true, organizationId: true },
    });
    for (const appBrand of appBrands) {
      if (appBrand.organizationId === organizationId) continue;
      await prisma.appBrand.update({
        where: { id: appBrand.id },
        data: { organizationId },
      });
      stampedAppBrands += 1;
    }

    await prisma.session.updateMany({
      where: { userId: user.id, activeOrganizationId: null },
      data: { activeOrganizationId: organizationId },
    });
  }

  const assets = await prisma.asset.findMany({
    where: { organizationId: null },
    select: {
      id: true,
      project: { select: { organizationId: true } },
      brand: { select: { organizationId: true } },
      appBrand: { select: { organizationId: true } },
    },
  });
  for (const asset of assets) {
    const organizationId =
      asset.project?.organizationId || asset.brand?.organizationId || asset.appBrand?.organizationId;
    if (!organizationId) continue;
    await prisma.asset.update({
      where: { id: asset.id },
      data: { organizationId },
    });
    stampedAssets += 1;
  }

  console.log(
    `Backfill complete. orgs=${createdOrgs} projects=${stampedProjects} brands=${stampedBrands} appBrands=${stampedAppBrands} assets=${stampedAssets}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
