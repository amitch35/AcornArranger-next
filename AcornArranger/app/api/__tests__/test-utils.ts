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

  // Keep track of the most recently created chainable query,
  // so tests can assert which filters were applied.
  let latestQuery: any | null = null;

  // Create a chainable query object that can be called multiple times
  const createChainableQuery = () => {
    const query: any = {};

    // Chainable methods
    query.eq = vi.fn(() => query); // Return self for chaining
    query.in = vi.fn(() => query);
    query.ilike = vi.fn(() => query);
    query.gte = vi.fn(() => query); // Greater than or equal
    query.lte = vi.fn(() => query); // Less than or equal
    query.order = vi.fn(() => query);
    query.select = vi.fn(() => query); // For chaining after update

    // Terminal methods
    query.range = mockRange;
    query.maybeSingle = mockMaybeSingle;
    query.single = mockMaybeSingle;

    latestQuery = query;
    return query;
  };

  const mockSelect = vi.fn(() => createChainableQuery());
  const mockUpdate = vi.fn(() => createChainableQuery());

  const mockFrom = vi.fn(() => ({
    select: mockSelect,
    update: mockUpdate,
  }));

  return {
    from: mockFrom,
    mockData,
    mockCount,
    // Expose mocks for assertions
    _mocks: {
      from: mockFrom,
      select: mockSelect,
      update: mockUpdate,
      range: mockRange,
      maybeSingle: mockMaybeSingle,
      getLatestQuery: () => latestQuery,
    },
  };
}

/**
 * Create a full mock Supabase client
 */
export function createMockSupabaseClient(options: {
  data?: any[] | any | null;
  count?: number;
  error?: Error | null;
  status?: number;
} = {}) {
  const { error = null } = options;
  // Default status: 500 if error present, otherwise 200
  const status = options.status ?? (error ? 500 : 200);
  let { count = 0 } = options;
  let data = options.data;
  
  // Normalize data to always be an array for consistent handling, except for explicit null
  const dataArray = 
    data === null ? [] : 
    Array.isArray(data) ? data : 
    data !== undefined ? [data] : [];
  
  const resolvedData = data === null ? null : dataArray;
  count = count || dataArray.length;

  if (error) {
    // Return error mock with chainable query
    const mockRange = vi.fn().mockResolvedValue({
      data: null,
      error,
      status: status || 500,
      count: 0,
    });

    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error,
      status: status || 500,
    });

    const createErrorQuery = () => {
      const query: any = {
        eq: vi.fn(() => query), // Return self for chaining, consistent with success path
        in: vi.fn(() => query),
        ilike: vi.fn(() => query),
        gte: vi.fn(() => query),
        lte: vi.fn(() => query),
        order: vi.fn(() => query),
        range: mockRange,
        maybeSingle: mockMaybeSingle,
        select: vi.fn(() => query), // For PUT chaining
      };
      return query;
    };

    return {
      from: vi.fn(() => ({
        select: vi.fn(() => createErrorQuery()),
        update: vi.fn(() => createErrorQuery()),
      })),
      auth: {
        getClaims: vi.fn(),
        getSession: vi.fn(),
        getUser: vi.fn(),
      },
    };
  }

  // Return success mock
  return createMockSupabaseQuery(dataArray, count);
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
 * Mock data generators for properties
 */
export function generateMockProperties(count: number = 10) {
  const cities = ["San Diego", "Los Angeles", "San Francisco", "Sacramento", "Oakland"];
  const propertyTypes = ["Beach House", "Mountain Cabin", "City Condo", "Suburban Home", "Downtown Loft"];
  
  return Array.from({ length: count }, (_, i) => ({
    properties_id: i + 1,
    property_name: `${propertyTypes[i % propertyTypes.length]} ${i + 1}`,
    estimated_cleaning_mins: i % 4 === 3 ? null : 60 + (i % 10) * 15, // null every 4th, others 60-195 mins
    double_unit: i % 3 === 0 ? [(i % count) + 2, (i % count) + 3] : null,
    address: {
      city: cities[i % cities.length],
      address: `${100 + i} Main St`,
      country: "USA",
      state_name: "CA",
      postal_code: `9${(2000 + i).toString().slice(-4)}`,
    },
    status: {
      status_id: ((i % 3) + 1) as 1 | 2 | 3,
      status: ["Active", "Inactive", "Pending"][i % 3],
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
