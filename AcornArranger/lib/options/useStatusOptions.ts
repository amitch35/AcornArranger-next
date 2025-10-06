import { useQuery, keepPreviousData } from "@tanstack/react-query";

type Entity = "appointments" | "properties" | "staff";

function getEndpoint(entity: Entity) {
  switch (entity) {
    case "appointments":
      return "/api/options/appointment-status";
    case "properties":
      return "/api/options/property-status";
    case "staff":
      return "/api/options/staff-status";
  }
}

export interface OptionItem { id: number | string; label: string }

export function useStatusOptions(entity: Entity) {
  return useQuery<{ options: OptionItem[] }>({
    queryKey: ["status-options", entity],
    queryFn: async () => {
      try {
        const res = await fetch(getEndpoint(entity), { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load status options");
        return res.json();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("useStatusOptions error:", err);
        throw err;
      }
    },
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
    retry: 1,
  });
}


