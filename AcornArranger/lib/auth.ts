import { createClient } from "./supabase/server";

/**
 * Application role hierarchy for AcornArranger.
 * Order matters: roles later in the array have all permissions of earlier roles.
 * 
 * - 'authenticated': Default role for new signups, limited access (awaiting activation)
 * - 'authorized_user': Activated users with full app access
 * 
 * Future: Can add 'admin' role by extending this array
 */
const ROLE_ORDER = ['authenticated', 'authorized_user'] as const;

export type Role = typeof ROLE_ORDER[number];

/**
 * Get the current user's session.
 * 
 * @returns The Supabase session or null if not authenticated
 */
export async function getSession() {
  const supabase = await createClient();
  return supabase.auth.getSession();
}

/**
 * Get the current user's role from JWT claims.
 * No database queries - reads directly from the JWT token.
 * 
 * @returns The user's role, defaulting to 'authenticated' if claim is missing/invalid
 * @throws {Error} 'UNAUTH' if no session exists
 */
export async function getCurrentRole(): Promise<Role> {
  const supabase = await createClient();
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('UNAUTH');
  }

  const { data: claimsData } = await supabase.auth.getClaims();
  const userRoleClaim = (claimsData?.claims as any)?.user_role as string | undefined;

  // Validate the claim against our known roles
  if (userRoleClaim && ROLE_ORDER.includes(userRoleClaim as Role)) {
    return userRoleClaim as Role;
  }

  // Default to 'authenticated' if claim is missing or invalid
  return 'authenticated';
}

/**
 * Check if a role has at least the permissions of a required role.
 * Based on role hierarchy: later roles in ROLE_ORDER have more permissions.
 * 
 * @param current - The user's current role
 * @param required - The minimum required role
 * @returns true if current role meets or exceeds required role
 * 
 * @example
 * hasAtLeastRole('authorized_user', 'authenticated') // true
 * hasAtLeastRole('authenticated', 'authorized_user') // false
 */
export function hasAtLeastRole(current: Role, required: Role): boolean {
  return ROLE_ORDER.indexOf(current) >= ROLE_ORDER.indexOf(required);
}

/**
 * Require a minimum role for accessing a resource.
 * Used for UX-level gating on server-rendered routes/components.
 * 
 * Note: This is for user experience (routing, showing helpful errors).
 * Security is enforced at the database layer via RLS policies.
 * 
 * @param minRole - The minimum role required
 * @returns Object containing the user's role
 * @throws {Error} 'FORBIDDEN' if user's role is insufficient
 * @throws {Error} 'UNAUTH' if no session exists
 */
export async function requireMinRole(minRole: Role) {
  const role = await getCurrentRole();
  
  if (!hasAtLeastRole(role, minRole)) {
    throw new Error('FORBIDDEN');
  }
  
  return { role };
}

/**
 * Get the user's role for client-side components.
 * Returns null if not authenticated, for graceful UX handling.
 * 
 * @returns The user's role or null if not authenticated
 */
export async function getClientRole(): Promise<Role | null> {
  try {
    return await getCurrentRole();
  } catch (err) {
    if ((err as Error).message === 'UNAUTH') {
      return null;
    }
    throw err;
  }
}

