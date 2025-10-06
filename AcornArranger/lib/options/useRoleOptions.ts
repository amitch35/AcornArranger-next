import { useQuery, keepPreviousData } from "@tanstack/react-query";

export interface OptionItem { id: number | string; label: string }

export function useRoleOptions() {
  return useQuery<{ options: OptionItem[] }>({
    queryKey: ["role-options"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/options/roles", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load role options");
        return res.json();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("useRoleOptions error:", err);
        throw err;
      }
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
    retry: 1,
  });
}


