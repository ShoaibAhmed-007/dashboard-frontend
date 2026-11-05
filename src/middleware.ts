import { NextRequest, NextResponse } from "next/server";

// Auth routes — logged-in users should be redirected away from these
const AUTH_ROUTES = ["/signin", "/signup"];

// Routes that are always public AND must never be intercepted regardless of session
const PUBLIC_PREFIXES = [
  "/signin",
  "/signup",
  "/forgot-password",
  "/invite",
  "/verify-otp",
  "/verify-email",
  "/reset-password",
  "/auth/callback", // Google OAuth lands here with refresh_token already set
  "/auth/continue", // handoff from a sign-in on the marketing website (cookie already set)
  "/error-404",
  "/portal-select",
  "/.well-known", // apple-app-site-association + assetlinks.json for mobile Universal Links
];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.some((p) => pathname.startsWith(p));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always let public routes through — never redirect them
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // The httpOnly refresh_token cookie is set by the backend on login/register/OAuth.
  const hasSession = req.cookies.has("refresh_token");

  // If user is logged in and tries to visit signin/signup → redirect to portal select
  if (hasSession && isAuthRoute(pathname)) {
    return NextResponse.redirect(new URL("/portal-select", req.url));
  }

  // Protected-route auth is handled client-side in AdminLayoutClient.
  // It calls refreshSession() on mount, giving the client a chance to restore
  // the session via the refresh_token cookie before deciding to redirect.
  // Blocking here causes a race: the middleware runs before the client can
  // refresh, so users with valid sessions get bounced to /signin on tab reopen.
  return NextResponse.next();
}

export const config = {
  // Run on all routes except Next.js internals and static files
  matcher: ["/((?!_next/static|_next/image|images|favicon.ico).*)"],
};
