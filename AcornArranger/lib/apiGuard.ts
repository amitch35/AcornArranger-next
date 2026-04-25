import { getCurrentRole, type Role } from "./auth";

/**
 * Context object passed to authenticated API handlers
 */
export interface AuthContext {
  role: Role;
}

/**
 * Handler function signature for authenticated API routes
 * Accepts any additional context (like Next.js params) alongside role.
 * TReq allows using NextRequest or other Request subtypes.
 *
 * NOTE: Inner handlers receive params as a *sync* object. The wrapper
 * (`withAuth`) awaits the Promise<params> shape that Next.js 15 passes in.
 * Do not declare `params` as `Promise<...>` on inner handlers.
 */
export type AuthenticatedHandler<TContext = unknown, TReq extends Request = Request> = (
  req: TReq,
  context: AuthContext & TContext
) => Promise<Response>;

/**
 * Extract the sync `params` shape from a TContext used by inner handlers
 * (e.g. `{ params: { id: string } }` or `{ params?: { id: string } }`).
 * Falls back to `Record<string, never>` for non-dynamic routes.
 */
type ParamsOf<TContext> = TContext extends { params?: infer P }
  ? Exclude<P, undefined>
  : Record<string, never>;

/**
 * The context shape Next.js 15 passes to the exported route handler.
 * Next.js 15 always supplies `{ params: Promise<...> }`. Tests that invoke
 * route handlers directly must wrap params with `Promise.resolve(...)`.
 *
 * (We can't widen this to `Promise<P> | P` even though it would help tests:
 * Next.js's typed-routes validator checks `params` for assignability to
 * `Promise<any>` directly, not via function-parameter contravariance.)
 */
type NextRouteContext<TContext> = { params: Promise<ParamsOf<TContext>> };

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
  return async (
    req: TReq,
    context: NextRouteContext<TContext>
  ): Promise<Response> => {
    try {
      const role = await getCurrentRole();

      // Next.js 15 passes `{ params: Promise<...> }`; tests sometimes pass a
      // sync object. Normalize both shapes to a resolved sync `params` value
      // before forwarding to the inner handler.
      const resolvedParams = await context.params;

      return handler(req, {
        role,
        params: resolvedParams,
      } as unknown as AuthContext & TContext);
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
export function withMinRole<TContext = unknown, TReq extends Request = Request>(
  handler: AuthenticatedHandler<TContext, TReq>,
  options: { minRole: Role }
) {
  return withAuth<TContext, TReq>(async (req, context) => {
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

