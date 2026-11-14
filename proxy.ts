import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSessionToken } from "@/lib/session-token";

// Admin-only areas send signed-out visitors to the admin sign-in; everything else
// (a user's own account and record forms) goes to the normal sign-in with "Create account".
const ADMIN_ONLY = ["/admin", "/admin/admins", "/admin/guide"];

export async function proxy(request: NextRequest) {
  const session = await readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();
  const path = request.nextUrl.pathname.replace(/\/$/, "") || "/";
  const adminOnly = ADMIN_ONLY.some((p) => path === p || (p !== "/admin" && path.startsWith(`${p}/`)));
  return NextResponse.redirect(new URL(adminOnly ? "/login?as=admin" : "/login", request.url));
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/account", "/account/:path*"],
};
