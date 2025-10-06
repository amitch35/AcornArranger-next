import { useQuery, keepPreviousData } from "@tanstack/react-query";

export interface OptionItem { id: number | string; label: string }

export function useServiceOptions() {
  return useQuery<{ options: OptionItem[] }>({
    queryKey: ["service-options"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/options/services", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load service options");
        return res.json();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("useServiceOptions error:", err);
        throw err;
      }
    },
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
    retry: 1,
  });
}


