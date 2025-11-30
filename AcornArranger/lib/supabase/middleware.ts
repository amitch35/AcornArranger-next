import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";
import type { Database } from "./types";

/**
 * Application role hierarchy (must match lib/auth.ts)
 */
const ROLE_ORDER = ['authenticated', 'authorized_user'] as const;
type Role = typeof ROLE_ORDER[number];

/**
 * Route protection rules: define which paths require which minimum role.
 * These are for UX routing - actual data access is secured by RLS policies.
 */
const ROUTE_RULES = [
  { prefix: '/dashboard', minRole: 'authorized_user' as Role },
  { prefix: '/api/secure', minRole: 'authorized_user' as Role },
  { prefix: '/profile', minRole: 'authenticated' as Role },
] as const;

/**
 * Check if a role meets the minimum requirement
 */
function hasAtLeastRole(current: Role | null, required: Role): boolean {
  if (!current) return false;
  return ROLE_ORDER.indexOf(current) >= ROLE_ORDER.indexOf(required);
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // If the env vars are not set, skip middleware check. You can remove this
  // once you setup the project.
  if (!hasEnvVars) {
    return supabaseResponse;
  }

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const url = request.nextUrl;
  const pathname = url.pathname;

  // Find matching route rule for this path
  const routeRule = ROUTE_RULES.find(rule => pathname.startsWith(rule.prefix));

  // If this path requires authentication/authorization, check it
  if (routeRule) {
    // No user at all - redirect to login
    if (!user) {
      const loginUrl = url.clone();
      loginUrl.pathname = "/auth/login";
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Extract role from JWT claims
    const userRoleClaim = (user as any)?.user_role as string | undefined;
    const role: Role = 
      userRoleClaim && ROLE_ORDER.includes(userRoleClaim as Role)
        ? (userRoleClaim as Role)
        : 'authenticated';

    // Check if role meets minimum requirement (UX routing only)
    if (!hasAtLeastRole(role, routeRule.minRole)) {
      const welcomeUrl = url.clone();
      welcomeUrl.pathname = "/welcome";
      return NextResponse.redirect(welcomeUrl);
    }
  }

  // Basic authentication check for other protected routes
  if (
    pathname !== "/" &&
    !user &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/auth") &&
    !pathname.startsWith("/welcome")
  ) {
    // no user, potentially respond by redirecting the user to the login page
    const loginUrl = url.clone();
    loginUrl.pathname = "/auth/login";
    return NextResponse.redirect(loginUrl);
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
