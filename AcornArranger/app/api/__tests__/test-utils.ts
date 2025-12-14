import { vi } from "vitest";

/**
 * Test utilities for API route testing
 * 
 * Provides mocks for Supabase client and auth guards
 */

/**
 * Create a mock Supabase query builder chain
 * Supports: from().select().eq().in().ilike().order().range()
 */
export function createMockSupabaseQuery(mockData: any[] = [], mockCount: number = 0) {
  const mockRange = vi.fn().mockResolvedValue({
    data: mockData,
    error: null,
    status: 200,
    count: mockCount,
  });

  const mockMaybeSingle = vi.fn().mockResolvedValue({
    data: mockData[0] || null,
    error: null,
    status: mockData[0] ? 200 : 404,
  });

  // Create a chainable query object that can be called multiple times
  const createChainableQuery = () => {
    const query: any = {
      eq: vi.fn(() => query), // Return self for chaining
      in: vi.fn(() => query),
      ilike: vi.fn(() => query),
      order: vi.fn(() => query),
      range: mockRange,
      maybeSingle: mockMaybeSingle,
      single: mockMaybeSingle,
    };
    return query;
  };

  const mockSelect = vi.fn(() => createChainableQuery());

  const mockFrom = vi.fn(() => ({
    select: mockSelect,
  }));

  return {
    from: mockFrom,
    mockData,
    mockCount,
    // Expose mocks for assertions
    _mocks: {
      from: mockFrom,
      select: mockSelect,
      range: mockRange,
      maybeSingle: mockMaybeSingle,
    },
  };
}

/**
 * Create a full mock Supabase client
 */
export function createMockSupabaseClient(options: {
  data?: any[];
  count?: number;
  error?: Error | null;
} = {}) {
  const { data = [], count = 0, error = null } = options;

  if (error) {
    // Return error mock with chainable query
    const mockRange = vi.fn().mockResolvedValue({
      data: null,
      error,
      status: 500,
      count: 0,
    });

    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error,
      status: 500,
    });

    const createErrorQuery = () => {
      const query: any = {
        eq: vi.fn(() => query), // Return self for chaining, consistent with success path
        in: vi.fn(() => query),
        ilike: vi.fn(() => query),
        order: vi.fn(() => query),
        range: mockRange,
        maybeSingle: mockMaybeSingle,
      };
      return query;
    };

    return {
      from: vi.fn(() => ({
        select: vi.fn(() => createErrorQuery()),
      })),
      auth: {
        getClaims: vi.fn(),
        getSession: vi.fn(),
        getUser: vi.fn(),
      },
    };
  }

  // Return success mock
  return createMockSupabaseQuery(data, count);
}

/**
 * Mock data generators for staff
 */
export function generateMockStaff(count: number = 10) {
  return Array.from({ length: count }, (_, i) => ({
    user_id: i + 1,
    name: `Staff ${i + 1}`,
    first_name: `First${i + 1}`,
    last_name: `Last${i + 1}`,
    hb_user_id: i % 5 === 0 ? 1000 + i : null,
    role: {
      id: (i % 3) + 1,
      title: ["Housekeeper", "Lead Housekeeper", "Manager"][i % 3],
      description: null,
      priority: [3, 2, 4][i % 3],
      can_clean: i % 3 === 0 || i % 3 === 1,
      can_lead_team: i % 3 === 1 || i % 3 === 2,
    },
    status: {
      status_id: ((i % 3) + 1) as 1 | 2 | 3,
      status: ["Active", "Inactive", "Unverified"][i % 3] as "Active" | "Inactive" | "Unverified",
    },
  }));
}

/**
 * Setup API route test mocks
 * Call this before running API route tests
 */
export function setupApiRouteMocks() {
  // Mock the auth guard to bypass authentication
  vi.mock("@/lib/apiGuard", () => ({
    withAuth: (handler: any) => handler, // Pass through without auth check
  }));

  // Mock Supabase server client
  vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(),
  }));

  // Mock sort utility
  vi.mock("@/lib/api/sort", async () => {
    const actual = await vi.importActual("@/lib/api/sort");
    return actual;
  });
}
