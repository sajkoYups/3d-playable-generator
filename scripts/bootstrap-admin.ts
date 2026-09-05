import "dotenv/config";
import { auth } from "@/lib/auth";
import { isPlatformAdminEmail } from "@/lib/platform";

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  const name = process.argv.slice(4).join(" ") || "Platform admin";

  if (!email || !password) {
    console.error("Usage: npx tsx scripts/bootstrap-admin.ts <email> <password> [name]");
    process.exit(1);
  }
  if (!isPlatformAdminEmail(email)) {
    console.error("Add this email to PLATFORM_ADMIN_EMAILS in .env before bootstrapping.");
    process.exit(1);
  }

  await auth.api.signUpEmail({
    body: {
      email,
      password,
      name,
    },
  });
  console.log(`Created platform admin ${email}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
