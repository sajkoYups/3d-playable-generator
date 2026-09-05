import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const { pathname } = request.nextUrl;

  const isProtected =
    pathname.startsWith("/projects") ||
    pathname.startsWith("/brands") ||
    pathname.startsWith("/templates") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/pending-access") ||
    pathname.startsWith("/api/projects") ||
    pathname.startsWith("/api/brands") ||
    pathname.startsWith("/api/templates") ||
    pathname.startsWith("/api/app-brands") ||
    pathname.startsWith("/api/assets") ||
    pathname.startsWith("/api/export") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/team") ||
    pathname.startsWith("/api/storage") ||
    pathname.startsWith("/api/invitations");

  if (isProtected && !sessionCookie) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/projects",
    "/projects/:path*",
    "/brands",
    "/brands/:path*",
    "/templates",
    "/templates/:path*",
    "/admin",
    "/admin/:path*",
    "/settings",
    "/settings/:path*",
    "/pending-access",
    "/api/projects",
    "/api/projects/:path*",
    "/api/brands",
    "/api/brands/:path*",
    "/api/templates",
    "/api/templates/:path*",
    "/api/app-brands",
    "/api/app-brands/:path*",
    "/api/assets",
    "/api/assets/:path*",
    "/api/export/:path*",
    "/api/admin/:path*",
    "/api/team",
    "/api/team/:path*",
    "/api/storage/:path*",
    "/api/invitations/:path*",
  ],
};
