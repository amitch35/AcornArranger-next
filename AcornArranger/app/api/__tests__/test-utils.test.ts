import { describe, it, expect } from "vitest";
import { createMockSupabaseClient } from "./test-utils";

/**
 * Test utilities tests
 * 
 * Verifies that mock Supabase clients correctly support query chaining
 */

describe("Test Utilities", () => {
  describe("createMockSupabaseClient", () => {
    it("should support chaining methods in success path", async () => {
      const mockClient = createMockSupabaseClient({
        data: [{ id: 1, name: "Test" }],
        count: 1,
      });

      // Should not throw - all methods return chainable query
      const query = mockClient
        .from("test")
        .select("*")
        .eq("id", 1)
        .in("status", [1, 2])
        .ilike("name", "%test%")
        .order("name", { ascending: true });

      const result = await query.range(0, 10);

      expect(result.data).toHaveLength(1);
      expect(result.error).toBeNull();
    });

    it("should support chaining methods in error path", async () => {
      const mockError = new Error("Database error");
      const mockClient = createMockSupabaseClient({ error: mockError });

      // Should not throw - eq() should return chainable query, not plain object
      const query = mockClient
        .from("test")
        .select("*")
        .eq("id", 1)         // This was broken - returned { maybeSingle } instead of query
        .in("status", [1, 2]) // This would fail if eq() doesn't return query
        .order("name", { ascending: true });

      const result = await query.range(0, 10);

      expect(result.data).toBeNull();
      expect(result.error).toBe(mockError);
    });

    it("should support eq().maybeSingle() pattern in error path", async () => {
      const mockError = new Error("Not found");
      const mockClient = createMockSupabaseClient({ error: mockError });

      // Should support terminal .maybeSingle() after .eq()
      const result = await mockClient
        .from("test")
        .select("*")
        .eq("id", 1)
        .maybeSingle();

      expect(result.data).toBeNull();
      expect(result.error).toBe(mockError);
    });

    it("should support complex query chains in error path", async () => {
      const mockError = new Error("Complex error");
      const mockClient = createMockSupabaseClient({ error: mockError });

      // Real-world complex chain
      const result = await mockClient
        .from("rc_staff")
        .select("*")
        .in("status_id", [1, 2])
        .eq("roles.can_clean", true)
        .eq("roles.can_lead_team", true)
        .ilike("name", "%john%")
        .order("name", { ascending: true })
        .order("status_id", { ascending: false })
        .range(0, 24);

      expect(result.error).toBe(mockError);
    });

    it("should allow explicit count: 0", async () => {
      // Bug fix: count: 0 was being overridden to dataArray.length
      const mockClient = createMockSupabaseClient({
        data: [{ id: 1 }, { id: 2 }],
        count: 0, // Explicitly set to 0
      });

      const result = await mockClient
        .from("test")
        .select("*")
        .range(0, 10);

      expect(result.data).toHaveLength(2);
      expect(result.count).toBe(0); // Should respect explicit 0, not override to 2
    });

    it("should default count to dataArray.length when count is undefined", async () => {
      const mockClient = createMockSupabaseClient({
        data: [{ id: 1 }, { id: 2 }, { id: 3 }],
        // count: undefined (not provided)
      });

      const result = await mockClient
        .from("test")
        .select("*")
        .range(0, 10);

      expect(result.data).toHaveLength(3);
      expect(result.count).toBe(3); // Should default to dataArray.length
    });
  });
});
