import { getCurrentRole, type Role } from "./auth";

/**
 * Context object passed to authenticated API handlers
 */
export interface AuthContext {
  role: Role;
}

/**
 * Handler function signature for authenticated API routes
 * Accepts any additional context (like Next.js params) alongside role
 * TReq allows using NextRequest or other Request subtypes
 */
export type AuthenticatedHandler<TContext = unknown, TReq extends Request = Request> = (
  req: TReq,
  context: AuthContext & TContext
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
 * @returns Wrapped handler that ensures authentication and forwards params
 * 
 * @example
 * export const GET = withAuth(async (req, { role }) => {
 *   // role is available for UX decisions
 *   // Database queries automatically respect RLS policies
 *   return Response.json({ message: `Hello, ${role}!` });
 * });
 * 
 * @example
 * // With dynamic params
 * export const GET = withAuth(async (req, { role, params }) => {
 *   const id = params.id; // params forwarded from Next.js
 *   return Response.json({ id, role });
 * });
 */
export function withAuth<TContext = unknown, TReq extends Request = Request>(
  handler: AuthenticatedHandler<TContext, TReq>
) {
  return async (req: TReq, context?: TContext): Promise<Response> => {
    try {
      const role = await getCurrentRole();
      
      // Await params if it's a Promise (Next.js 15 behavior for dynamic routes)
      let resolvedContext = context;
      if (context && typeof context === 'object' && 'params' in context) {
        const params = (context as any).params;
        if (params && typeof params === 'object' && 'then' in params) {
          resolvedContext = { ...context, params: await params } as TContext;
        }
      }
      
      return handler(req, { role, ...resolvedContext } as AuthContext & TContext);
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
export function withMinRole<TReq extends Request = Request>(
  handler: AuthenticatedHandler<unknown, TReq>,
  options: { minRole: Role }
) {
  return withAuth<unknown, TReq>(async (req, context) => {
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

