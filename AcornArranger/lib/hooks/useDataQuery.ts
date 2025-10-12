import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  encodeToSearchParams,
  validateBaseFilters,
  DecodeOptions,
} from "../filters/URLQueryCodec";

type QueryStatus = "pending" | "success" | "error";
type FetchStatus = "idle" | "fetching" | "paused";

export type UseDataQueryArgs<TData, TSchema extends z.ZodTypeAny> = {
  endpoint: string;
  filtersSchema: TSchema;
  initialFilters?: Partial<z.infer<TSchema>>;
  allow?: DecodeOptions["allow"];
  enabled?: boolean;
  storageKey?: string; // used to persist pageSize and column visibility
  select?: (raw: unknown) => { data: TData; total: number };
  requestInit?: RequestInit; // extra fetch options (headers, credentials, etc.)
  queryRetry?: number | boolean; // react-query retry option (tests can set 0)
};

export type UseDataQueryReturn<TData, TFilters> = {
  data: TData | undefined;
  total: number | undefined;
  status: QueryStatus;
  fetchStatus: FetchStatus;
  isPending: boolean;
  isFetching: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: unknown;
  isInitialLoading: boolean;
  isRefetching: boolean;
  showSkeleton: boolean;
  disableControls: boolean;
  filters: TFilters;
  setFilters: (updater: (prev: TFilters) => TFilters) => void;
  setSort: (sort: string | undefined) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  clearAll: () => void;
  columnVisibility: Record<string, boolean>;
  setColumnVisibility: (next: Record<string, boolean>) => void;
  refetch: () => void;
  retry: () => void;
  cancel: () => void;
  resetError: () => void;
  queryKey: readonly unknown[];
  queryString: string;
};

function safeParseJson(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return undefined;
  }
}

function defaultSelect<TData>(raw: unknown): { data: TData; total: number } {
  if (raw && typeof raw === "object") {
    const anyRaw = raw as any;
    if (Array.isArray(anyRaw.data) && typeof anyRaw.total === "number") {
      return { data: anyRaw.data as TData, total: anyRaw.total as number };
    }
    if (Array.isArray(anyRaw.items) && typeof anyRaw.total === "number") {
      return { data: anyRaw.items as TData, total: anyRaw.total as number };
    }
  }
  if (Array.isArray(raw)) {
    return { data: raw as unknown as TData, total: (raw as unknown[]).length };
  }
  return { data: undefined as unknown as TData, total: 0 };
}

export function useDataQuery<
  TData,
  TSchema extends z.ZodTypeAny
>(
  args: UseDataQueryArgs<TData, TSchema>
): UseDataQueryReturn<TData, z.infer<TSchema>> {
  type TFilters = z.infer<TSchema>;
  const {
    endpoint,
    filtersSchema,
    initialFilters,
    enabled = true,
    storageKey,
    select,
    requestInit,
    queryRetry,
  } = args;

  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);

  // Initialize filters using schema defaults merged with provided initial
  const [filters, setFiltersState] = useState<TFilters>(() => {
    const base = validateBaseFilters((initialFilters ?? {}) as Record<string, unknown>, filtersSchema);
    // Restore pageSize from storage if available
    if (storageKey && typeof window !== "undefined") {
      const stored = window.localStorage.getItem(`${storageKey}:pageSize`);
      const n = stored ? Number(stored) : undefined;
      if (Number.isFinite(n) && n! >= 1) {
        return { ...(base as any), pageSize: Math.trunc(n!) } as TFilters;
      }
    }
    return base as TFilters;
  });

  const [columnVisibility, setColumnVisibilityState] = useState<Record<string, boolean>>(
    () => {
      if (!storageKey || typeof window === "undefined") return {};
      const raw = window.localStorage.getItem(`${storageKey}:columnVisibility`);
      const parsed = safeParseJson(raw ?? "");
      return (parsed && typeof parsed === "object" ? (parsed as any) : {}) as Record<string, boolean>;
    }
  );

  // Persist pageSize and column visibility
  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    const ps = (filters as any).pageSize;
    if (Number.isFinite(ps) && ps >= 1) {
      window.localStorage.setItem(`${storageKey}:pageSize`, String(Math.trunc(ps)));
    }
  }, [filters, storageKey]);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        `${storageKey}:columnVisibility`,
        JSON.stringify(columnVisibility)
      );
    } catch {
      // ignore storage errors
    }
  }, [columnVisibility, storageKey]);

  // Build canonical query string once per filters change
  const queryString = useMemo(() => {
    const sp = encodeToSearchParams(filters as Record<string, unknown>);
    const qs = sp.toString();
    return qs ? `?${qs}` : "";
  }, [filters]);

  // Deterministic query key for cache
  const queryKey = useMemo(() => ["data-query", endpoint, queryString] as const, [endpoint, queryString]);

  const fetcher = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const res = await fetch(`${endpoint}${queryString}`, {
      signal: controller.signal,
      cache: "no-store",
      ...(requestInit ?? {}),
    });
    if (!res.ok) {
      const message = `Request failed with status ${res.status}`;
      throw new Error(message);
    }
    const raw = await res.json();
    const mapper = select ?? defaultSelect<TData>;
    const { data, total } = mapper(raw);
    return { data, total } as { data: TData; total: number };
  }, [endpoint, queryString, requestInit, select]);

  const query = useQuery<{ data: TData; total: number }>(
    {
      queryKey,
      queryFn: fetcher,
      enabled,
      staleTime: 30_000,
      retry: queryRetry ?? 1,
    }
  );

  const status = query.status as QueryStatus;
  const fetchStatus = query.fetchStatus as FetchStatus;
  const isPending = status === "pending";
  const isFetching = fetchStatus === "fetching";
  const isSuccess = status === "success";
  const isError = status === "error";
  const hasCachedData = query.data != null;
  const isInitialLoading = isPending && !hasCachedData;
  const isRefetching = isFetching && hasCachedData;
  const showSkeleton = isInitialLoading;
  const disableControls = isPending || isFetching;

  const setFilters = useCallback((updater: (prev: TFilters) => TFilters) => {
    setFiltersState((prev) => {
      const next = updater(prev);
      return validateBaseFilters(next as unknown as Record<string, unknown>, filtersSchema) as TFilters;
    });
  }, [filtersSchema]);

  const setSort = useCallback((sort: string | undefined) => {
    setFilters((prev) => ({ ...(prev as any), sort }) as TFilters);
  }, [setFilters]);

  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...(prev as any), page: Math.max(1, Math.trunc(page)) }) as TFilters);
  }, [setFilters]);

  const setPageSize = useCallback((pageSize: number) => {
    const n = Math.max(1, Math.trunc(pageSize));
    setFilters((prev) => ({ ...(prev as any), pageSize: n }) as TFilters);
  }, [setFilters]);

  const clearAll = useCallback(() => {
    const defaults = filtersSchema.parse({});
    setFiltersState(defaults as TFilters);
  }, [filtersSchema]);

  const setColumnVisibility = useCallback((next: Record<string, boolean>) => {
    setColumnVisibilityState(next);
  }, []);

  const refetch = useCallback(() => {
    query.refetch();
  }, [query]);

  const retry = useCallback(() => {
    query.refetch();
  }, [query]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const resetError = useCallback(() => {
    queryClient.resetQueries({ queryKey });
  }, [queryClient, queryKey]);

  return {
    data: query.data?.data,
    total: query.data?.total,
    status,
    fetchStatus,
    isPending,
    isFetching,
    isSuccess,
    isError,
    error: query.error,
    isInitialLoading,
    isRefetching,
    showSkeleton,
    disableControls,
    filters,
    setFilters,
    setSort,
    setPage,
    setPageSize,
    clearAll,
    columnVisibility,
    setColumnVisibility,
    refetch,
    retry,
    cancel,
    resetError,
    queryKey,
    queryString,
  };
}


