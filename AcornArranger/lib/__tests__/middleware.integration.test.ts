import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { createMockRequest, mockClaims } from './test-utils';

// Mock the Supabase SSR module
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn((url, key, options) => {
    // Store the options for assertions
    const client = {
      _options: options,
      auth: {
        getClaims: vi.fn(),
        getUser: vi.fn(),
      },
    };
    return client;
  }),
}));

// Ensure middleware is enabled in tests
vi.mock('../utils', () => ({
  hasEnvVars: true,
}));

// Import after mocking
import { createServerClient } from '@supabase/ssr';
import { updateSession } from '../supabase/middleware';

describe('Middleware Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Route Protection', () => {
    it('should redirect unauthenticated users to login for protected routes', async () => {
      const mockSupabase = {
        auth: {
          getClaims: vi.fn().mockResolvedValue({
            data: { claims: null },
            error: null,
          }),
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
      };

      vi.mocked(createServerClient).mockReturnValue(mockSupabase as any);

      const request = new NextRequest('http://localhost:3000/dashboard');
      const response = await updateSession(request);

      expect(response.status).toBe(307); // Redirect
      expect(response.headers.get('location')).toContain('/auth/login');
      expect(response.headers.get('location')).toContain('redirect=%2Fdashboard');
    });

    it('should allow authenticated users with sufficient role to access protected routes', async () => {
      const mockSupabase = {
        auth: {
          getClaims: vi.fn().mockResolvedValue({
            data: mockClaims.authorized_user,
            error: null,
          }),
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'test-user' } },
            error: null,
          }),
        },
      };

      vi.mocked(createServerClient).mockReturnValue(mockSupabase as any);

      const request = new NextRequest('http://localhost:3000/dashboard');
      const response = await updateSession(request);

      expect(response.status).toBe(200);
    });

    it('should redirect authenticated users with insufficient role to welcome', async () => {
      const mockSupabase = {
        auth: {
          getClaims: vi.fn().mockResolvedValue({
            data: mockClaims.authenticated,
            error: null,
          }),
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'test-user' } },
            error: null,
          }),
        },
      };

      vi.mocked(createServerClient).mockReturnValue(mockSupabase as any);

      const request = new NextRequest('http://localhost:3000/dashboard');
      const response = await updateSession(request);

      expect(response.status).toBe(307); // Redirect
      expect(response.headers.get('location')).toContain('/welcome');
    });

    it('should allow authenticated users to access profile', async () => {
      const mockSupabase = {
        auth: {
          getClaims: vi.fn().mockResolvedValue({
            data: mockClaims.authenticated,
            error: null,
          }),
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'test-user' } },
            error: null,
          }),
        },
      };

      vi.mocked(createServerClient).mockReturnValue(mockSupabase as any);

      const request = new NextRequest('http://localhost:3000/profile');
      const response = await updateSession(request);

      expect(response.status).toBe(200);
    });

    it('should allow public routes without authentication', async () => {
      const mockSupabase = {
        auth: {
          getClaims: vi.fn().mockResolvedValue({
            data: { claims: null },
            error: null,
          }),
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
      };

      vi.mocked(createServerClient).mockReturnValue(mockSupabase as any);

      const request = new NextRequest('http://localhost:3000/');
      const response = await updateSession(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Role Fallback Behavior', () => {
    it('should treat users with missing user_role claim as authenticated', async () => {
      const mockSupabase = {
        auth: {
          getClaims: vi.fn().mockResolvedValue({
            data: {
              claims: {
                sub: 'test-user',
                email: 'test@example.com',
                // No user_role claim
              },
            },
            error: null,
          }),
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'test-user' } },
            error: null,
          }),
        },
      };

      vi.mocked(createServerClient).mockReturnValue(mockSupabase as any);

      // Try to access dashboard (requires authorized_user)
      const request = new NextRequest('http://localhost:3000/dashboard');
      const response = await updateSession(request);

      // Should redirect to welcome (insufficient role)
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/welcome');
    });

    it('should treat users with invalid user_role claim as authenticated', async () => {
      const mockSupabase = {
        auth: {
          getClaims: vi.fn().mockResolvedValue({
            data: {
              claims: {
                sub: 'test-user',
                email: 'test@example.com',
                user_role: 'invalid_role',
              },
            },
            error: null,
          }),
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'test-user' } },
            error: null,
          }),
        },
      };

      vi.mocked(createServerClient).mockReturnValue(mockSupabase as any);

      // Try to access dashboard (requires authorized_user)
      const request = new NextRequest('http://localhost:3000/dashboard');
      const response = await updateSession(request);

      // Should redirect to welcome (invalid role treated as authenticated)
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/welcome');
    });
  });

  describe('Redirect Parameter Handling', () => {
    it('should preserve original URL in redirect parameter', async () => {
      const mockSupabase = {
        auth: {
          getClaims: vi.fn().mockResolvedValue({
            data: { claims: null },
            error: null,
          }),
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
      };

      vi.mocked(createServerClient).mockReturnValue(mockSupabase as any);

      const originalPath = '/dashboard/settings/advanced';
      const request = new NextRequest(`http://localhost:3000${originalPath}`);
      const response = await updateSession(request);

      expect(response.headers.get('location')).toContain(
        `redirect=${encodeURIComponent(originalPath)}`
      );
    });
  });
});

