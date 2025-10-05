import { useQuery } from "@tanstack/react-query";

export interface OptionItem { id: number | string; label: string }

export function useServiceOptions() {
  return useQuery<{ options: OptionItem[] }>({
    queryKey: ["service-options"],
    queryFn: async () => {
      const res = await fetch("/api/options/services", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load service options");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}


