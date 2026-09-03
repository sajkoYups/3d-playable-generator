import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const { pathname } = request.nextUrl;

  const isProtected =
    pathname.startsWith("/projects") ||
    pathname.startsWith("/brands") ||
    pathname.startsWith("/api/projects") ||
    pathname.startsWith("/api/brands") ||
    pathname.startsWith("/api/assets") ||
    pathname.startsWith("/api/export");

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
    "/api/projects",
    "/api/projects/:path*",
    "/api/brands",
    "/api/brands/:path*",
    "/api/assets",
    "/api/export/:path*",
  ],
};
