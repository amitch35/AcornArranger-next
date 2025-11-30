import { vi } from 'vitest';
import type { Role } from '../auth';

/**
 * Test utilities for mocking Supabase Auth and JWT claims
 */

/**
 * Mock JWT claims for different roles
 */
export const mockClaims = {
  authenticated: {
    claims: {
      sub: 'test-user-id',
      email: 'test@example.com',
      user_role: 'authenticated',
      aud: 'authenticated',
      role: 'authenticated',
    },
  },
  authorized_user: {
    claims: {
      sub: 'test-user-id',
      email: 'test@example.com',
      user_role: 'authorized_user',
      aud: 'authenticated',
      role: 'authenticated',
    },
  },
  noRole: {
    claims: {
      sub: 'test-user-id',
      email: 'test@example.com',
      aud: 'authenticated',
      role: 'authenticated',
      // no user_role claim
    },
  },
  invalidRole: {
    claims: {
      sub: 'test-user-id',
      email: 'test@example.com',
      user_role: 'invalid_role',
      aud: 'authenticated',
      role: 'authenticated',
    },
  },
};

/**
 * Mock Supabase session
 */
export const mockSession = {
  access_token: 'mock-token',
  refresh_token: 'mock-refresh',
  expires_in: 3600,
  expires_at: Date.now() + 3600000,
  token_type: 'bearer',
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  },
};

/**
 * Create a mock Supabase client for testing
 */
export function createMockSupabaseClient(options: {
  role?: Role;
  hasSession?: boolean;
  claimsError?: boolean;
} = {}) {
  const { role = 'authenticated', hasSession = true, claimsError = false } = options;

  const getClaims = vi.fn().mockResolvedValue(
    claimsError
      ? { data: null, error: new Error('Claims error') }
      : role === 'authenticated'
      ? { data: mockClaims.authenticated, error: null }
      : { data: mockClaims.authorized_user, error: null }
  );

  const getSession = vi.fn().mockResolvedValue(
    hasSession
      ? { data: { session: mockSession }, error: null }
      : { data: { session: null }, error: null }
  );

  const getUser = vi.fn().mockResolvedValue(
    hasSession
      ? { data: { user: mockSession.user }, error: null }
      : { data: { user: null }, error: null }
  );

  return {
    auth: {
      getClaims,
      getSession,
      getUser,
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(),
      })),
    })),
  };
}

/**
 * Mock Next.js router for testing
 */
export function createMockRouter() {
  return {
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    route: '/',
    pathname: '/',
    query: {},
    asPath: '/',
  };
}

/**
 * Mock Next.js cookies for middleware testing
 */
export function createMockCookies(cookieData: Record<string, string> = {}) {
  const cookies = new Map(Object.entries(cookieData));

  return {
    get: vi.fn((name: string) => cookies.get(name)),
    set: vi.fn((name: string, value: string) => cookies.set(name, value)),
    delete: vi.fn((name: string) => cookies.delete(name)),
    getAll: vi.fn(() =>
      Array.from(cookies.entries()).map(([name, value]) => ({ name, value }))
    ),
    has: vi.fn((name: string) => cookies.has(name)),
  };
}

/**
 * Create a mock Next.js request for middleware testing
 */
export function createMockRequest(options: {
  pathname?: string;
  searchParams?: Record<string, string>;
  cookies?: Record<string, string>;
} = {}) {
  const {
    pathname = '/',
    searchParams = {},
    cookies: cookieData = {},
  } = options;

  const url = new URL(pathname, 'http://localhost:3000');
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const cookies = createMockCookies(cookieData);

  return {
    nextUrl: url,
    url: url.toString(),
    cookies: {
      get: cookies.get,
      set: cookies.set,
      delete: cookies.delete,
      getAll: cookies.getAll,
      has: cookies.has,
    },
    headers: new Headers(),
    method: 'GET',
  };
}

