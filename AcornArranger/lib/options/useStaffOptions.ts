import { useQuery, keepPreviousData } from "@tanstack/react-query";

export interface StaffOptionsParams {
  q?: string;
  page?: number;
  pageSize?: number;
  statusIds?: number[]; // default [1]
  canClean?: boolean;   // default true
  canLeadTeam?: boolean;
  excludePlanId?: number;
}

export interface OptionItem { id: number | string; label: string }

function buildQuery(params: StaffOptionsParams): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.page) sp.set("page", String(params.page));
  if (params.pageSize) sp.set("pageSize", String(params.pageSize));
  if (params.statusIds?.length) sp.set("statusIds", params.statusIds.join(","));
  if (params.canClean === true) sp.set("canClean", "true");
  if (params.canLeadTeam === true) sp.set("canLeadTeam", "true");
  if (params.excludePlanId != null) sp.set("excludePlanId", String(params.excludePlanId));
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export function useStaffOptions(params: StaffOptionsParams = { statusIds: [1], canClean: true }) {
  const p = { statusIds: [1], canClean: true, ...params };
  const qs = buildQuery(p);
  return useQuery<{ options: OptionItem[]; total: number }>({
    queryKey: ["staff-options", p],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/options/staff${qs}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load staff options");
        return res.json();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("useStaffOptions error:", err);
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
    retry: 1,
  });
}


