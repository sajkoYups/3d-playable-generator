import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins";
import { APIError } from "better-auth/api";
import { prisma } from "@/lib/db";
import { isPlatformAdminEmail } from "@/lib/platform";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
  },
  trustedOrigins: [
    process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    "http://localhost:3000",
  ],
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const email = user.email.toLowerCase();
          if (isPlatformAdminEmail(email)) {
            return;
          }
          const invite = await prisma.invitation.findFirst({
            where: {
              email: { equals: email, mode: "insensitive" },
              status: "pending",
              expiresAt: { gt: new Date() },
            },
          });
          if (!invite) {
            throw new APIError("BAD_REQUEST", {
              message: "Signup is invite-only",
            });
          }
        },
      },
    },
  },
  plugins: [
    organization({
      allowUserToCreateOrganization: async (user) => isPlatformAdminEmail(user.email),
      sendInvitationEmail: async () => {
        // Invite links are copied in the UI; email delivery is not configured.
      },
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
