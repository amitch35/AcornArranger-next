import { getCurrentRole, type Role } from "./auth";

/**
 * Context object passed to authenticated API handlers
 */
export interface AuthContext {
  role: Role;
}

/**
 * Handler function signature for authenticated API routes
 */
export type AuthenticatedHandler = (
  req: Request,
  context: AuthContext
) => Promise<Response>;

/**
 * Minimal authentication wrapper for API routes.
 * 
 * This wrapper ensures a session exists and provides the user's role
 * for UX decisions (e.g., tailoring responses, providing helpful messages).
 * 
 * **Security Note**: This does NOT enforce data access permissions.
 * All security is handled by Postgres RLS policies at the database layer.
 * 
 * @param handler - The API route handler to wrap
 * @returns Wrapped handler that ensures authentication
 * 
 * @example
 * export const GET = withAuth(async (req, { role }) => {
 *   // role is available for UX decisions
 *   // Database queries automatically respect RLS policies
 *   return Response.json({ message: `Hello, ${role}!` });
 * });
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (req: Request): Promise<Response> => {
    try {
      const role = await getCurrentRole();
      return handler(req, { role });
    } catch (err) {
      const error = err as Error;
      
      if (error.message === 'UNAUTH') {
        return new Response(
          JSON.stringify({ 
            error: 'Unauthorized',
            message: 'You must be logged in to access this resource'
          }),
          { 
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      
      // For any other errors, return a generic 500
      console.error('API auth error:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Internal Server Error',
          message: error.message || 'An unexpected error occurred'
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  };
}

/**
 * Optional: Wrapper for API routes that require a specific minimum role.
 * 
 * Use this sparingly - only for UX purposes (e.g., early 403 with helpful message).
 * The database RLS policies are still the actual security enforcement.
 * 
 * @param handler - The API route handler to wrap
 * @param options - Configuration object
 * @param options.minRole - Minimum role required (for UX gating)
 * @returns Wrapped handler that checks minimum role
 * 
 * @example
 * export const POST = withMinRole(
 *   async (req, { role }) => {
 *     // Only authorized_user can reach here
 *     return Response.json({ success: true });
 *   },
 *   { minRole: 'authorized_user' }
 * );
 */
export function withMinRole(
  handler: AuthenticatedHandler,
  options: { minRole: Role }
) {
  return withAuth(async (req, context) => {
    const { hasAtLeastRole } = await import('./auth');
    
    if (!hasAtLeastRole(context.role, options.minRole)) {
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: `This action requires ${options.minRole} role or higher`,
          userRole: context.role
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    return handler(req, context);
  });
}

