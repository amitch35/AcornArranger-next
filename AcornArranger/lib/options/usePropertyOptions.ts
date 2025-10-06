import { useQuery, keepPreviousData } from "@tanstack/react-query";

export interface PropertyOptionsParams {
  q?: string;
  page?: number;
  limit?: number;
  city?: string;
  statusIds?: number[];
}

export interface OptionItem { id: number | string; label: string }

function buildQuery(params: PropertyOptionsParams): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.city) sp.set("city", params.city);
  if (params.statusIds?.length) sp.set("filter_status_ids", params.statusIds.join(","));
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export function usePropertyOptions(params: PropertyOptionsParams = {}) {
  const qs = buildQuery(params);
  return useQuery<{ options: OptionItem[]; total: number }>({
    queryKey: ["property-options", params],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/options/properties${qs}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load property options");
        return res.json();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("usePropertyOptions error:", err);
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
    retry: 1,
  });
}


