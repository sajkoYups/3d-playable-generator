import "dotenv/config";
import { prisma } from "@/lib/db";

/**
 * Copy leftover projects that have no Variation rows.
 * After the schema drop, legacy Project.projectData is gone — those rows
 * must already have been copied. This is a no-op guard for later runs.
 */
async function main() {
  const projects = await prisma.project.findMany({
    include: { variations: { select: { id: true } } },
  });

  let skipped = 0;
  let missing = 0;

  for (const project of projects) {
    if (project.variations.length > 0) {
      skipped += 1;
      continue;
    }
    missing += 1;
    console.warn(`Project ${project.id} (${project.name}) has no variations.`);
  }

  console.log(`Backfill check complete. ${skipped} already migrated, ${missing} missing.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
