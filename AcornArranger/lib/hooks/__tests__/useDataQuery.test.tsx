// Global test environment is configured in vitest.config.ts (happy-dom)
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from "vitest";
import React, { useImperativeHandle, useRef, forwardRef } from "react";
import { act } from "react";
import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDataQuery } from "../useDataQuery";
import { Schemas } from "../../filters/URLQueryCodec";
import { server, handlers } from "../test-utils/msw";

type TestItem = { id: number };

// testing-library's waitFor is used instead of custom loop

const TestHarness = forwardRef<any, { endpoint: string }>(function TestHarness(
  { endpoint },
  ref
) {
  const last = useRef<any>(null);
  const api = useDataQuery<TestItem[], typeof Schemas.property>({
    endpoint,
    filtersSchema: Schemas.property,
    storageKey: "useDataQuery:test",
    queryRetry: 0,
  });
  useImperativeHandle(ref, () => ({ last, api }));
  last.current = api;
  return null;
});

describe("useDataQuery", () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: 0, staleTime: 0 } } });
    vi.restoreAllMocks();
    // reset storage
    window.localStorage.clear();
  });

  // msw lifecycle
  beforeAll(() => server.listen());
  afterAll(() => server.close());
  afterEach(() => server.resetHandlers());

  it("fetches data and exposes totals with canonical query string", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [{ id: 1 }], total: 1 }), { status: 200 }) as any
    );
    vi.stubGlobal("fetch", fetchMock);

    const rref = React.createRef<any>();
    render(
      <QueryClientProvider client={qc}>
        <TestHarness ref={rref} endpoint="/api/items" />
      </QueryClientProvider>
    );

    await waitFor(() => expect(rref.current!.last.current.status).toBe("success"));

    const v = rref.current.last.current;
    expect(v.status === "success").toBe(true);
    expect(v.data?.length).toBe(1);
    expect(v.total).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = (fetchMock.mock.calls[0]?.[0] as string) || "";
    expect(url.startsWith("/api/items?")).toBe(true);
    expect(url).toContain("page=1");
    expect(url).toContain("pageSize=25");
  });

  it("retry recovers after error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("fail", { status: 500 }) as any)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ id: 1 }, { id: 2 }], total: 2 }), { status: 200 }) as any
      );
    vi.stubGlobal("fetch", fetchMock);

    const rref = React.createRef<any>();
    render(
      <QueryClientProvider client={qc}>
        <TestHarness ref={rref} endpoint="/api/items" />
      </QueryClientProvider>
    );

    await waitFor(() => expect(qc.isFetching()).toBe(0));
    await waitFor(() => expect(rref.current!.last.current.isError).toBe(true));

    rref.current.last.current.retry();
    await waitFor(() => expect(qc.isFetching()).toBe(0));
    await waitFor(() => expect(rref.current!.last.current.isSuccess).toBe(true));
    expect(rref.current.last.current.total).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("persists pageSize to localStorage when storageKey is provided", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [], total: 0 }), { status: 200 }) as any
    );
    vi.stubGlobal("fetch", fetchMock);
    const rref = React.createRef<any>();
    render(
      <QueryClientProvider client={qc}>
        <TestHarness ref={rref} endpoint="/api/items" />
      </QueryClientProvider>
    );
    await waitFor(() => expect(rref.current!.last.current).toBeTruthy());

    await act(async () => {
      rref.current!.last.current.setPageSize(50);
    });
    await waitFor(() =>
      expect(window.localStorage.getItem("useDataQuery:test:pageSize")).toBe("50")
    );
  });

  it("cancel aborts in-flight request and avoids success", async () => {
    server.use(handlers.delayed("/api/slow", 250));
    const rref = React.createRef<any>();
    render(
      <QueryClientProvider client={qc}>
        <TestHarness ref={rref} endpoint="/api/slow" />
      </QueryClientProvider>
    );

    // Immediately cancel
    await waitFor(() => expect(rref.current!.last.current).toBeTruthy());
    rref.current!.last.current.cancel();

    // Ensure not success while fetch was in flight
    await waitFor(() => expect(qc.isFetching()).toBe(0));
    expect(rref.current!.last.current.isSuccess).toBe(false);
  });
});


